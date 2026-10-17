const { databaseFor } = require("./rtdbRouter");
const { manilaDateString, manilaNowMinutes } = require("./manilaDate");

const STAFF_ROLES = new Set(["doctor", "secretary"]);
const LIVE_QUEUE_STATUSES = new Set(["active", "paused", "closed"]);
const ALLOWED_QUEUE_STATUSES = new Set(["active", "paused", "closed"]);
const ACTIVE_RESERVATION_STATUSES = new Set([
  "reserved",
  "checked_in",
  "waiting",
  "in_consultation",
  "with_doctor",
  "validation_open",
  "waiting_for_window",
]);
const FINAL_RESERVATION_STATUSES = new Set([
  "cancelled",
  "cancelled_by_clinic",
  "completed",
  "consultation_completed",
  "forfeited",
  "penalized",
  "late_limit_reached",
  "expired",
  "validation_expired",
]);

const MIN_SLOT_CAPACITY = 0;
const MAX_SLOT_CAPACITY = 200;

function coded(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function namesMatch(left, right) {
  const clean = (value) => String(value || "").toLowerCase().replace(/\s*branch\s*$/i, "").trim();
  const a = clean(left);
  const b = clean(right);
  return Boolean(a) && a === b;
}

function staffOwnsSchedule(user, schedule) {
  if (user.role === "doctor") return true;
  if (user.role !== "secretary") return false;
  if (user.assignedBranchId && schedule.branchId) return user.assignedBranchId === schedule.branchId;
  if (user.assignedBranch && schedule.branch) return namesMatch(user.assignedBranch, schedule.branch);
  return false;
}

function listFrom(snap) {
  if (!snap.exists()) return [];
  return Object.entries(snap.val() || {}).map(([id, value]) => ({ id, ...value }));
}

async function writeSessionAudit(db, entry) {
  const auditRef = db.ref("auditLogs").push();
  await auditRef.set({
    timestamp: Date.now(),
    ...entry,
  });
  return auditRef.key;
}

async function assertStaffCaller(db, callerUid) {
  if (!callerUid) throw coded("unauthenticated", "You must be signed in.");
  const userSnap = await db.ref(`users/${callerUid}`).once("value");
  if (!userSnap.exists()) throw coded("permission-denied", "Account is not active.");
  const user = userSnap.val() || {};
  if (user.isDeleted === true || (user.status && user.status !== "active")) {
    throw coded("permission-denied", "Account is not active.");
  }
  if (!STAFF_ROLES.has(user.role)) {
    throw coded("permission-denied", "Only a doctor or secretary can manage the clinic session.");
  }
  return {
    uid: callerUid,
    name: user.name || user.displayName || "Unknown User",
    role: user.role,
    assignedBranchId: user.assignedBranchId || null,
    assignedBranch: user.assignedBranch || null,
  };
}

async function loadSchedule(db, scheduleId) {
  if (!scheduleId || typeof scheduleId !== "string") {
    throw coded("invalid-argument", "Schedule id is required.");
  }
  const snap = await db.ref(`schedules/${scheduleId}`).once("value");
  if (!snap.exists()) throw coded("not-found", "Schedule not found.");
  return { id: scheduleId, ...snap.val() };
}

function branchIdFor(schedule) {
  return schedule.branchId || schedule.branch || null;
}

function scheduleCanStart(schedule, today) {
  return Boolean(
    schedule &&
      schedule.status === "published" &&
      schedule.clinicDate &&
      schedule.clinicDate >= today &&
      !schedule.dayClosed &&
      !LIVE_QUEUE_STATUSES.has(schedule.queueStatus) &&
      !["ended", "completed"].includes(schedule.queueStatus) &&
      schedule.status !== "completed"
  );
}

function anyQueueLive(schedules, exceptId) {
  return schedules.some(
    (schedule) =>
      schedule.id !== exceptId &&
      schedule.status === "published" &&
      !schedule.dayClosed &&
      LIVE_QUEUE_STATUSES.has(schedule.queueStatus)
  );
}

async function countActiveReservations(db, scheduleId) {
  const snap = await db.ref("reservations").orderByChild("scheduleId").equalTo(scheduleId).once("value");
  if (!snap.exists()) return 0;
  return Object.values(snap.val() || {}).filter((row) => ACTIVE_RESERVATION_STATUSES.has(row?.status)).length;
}

function minutesFromTime(value) {
  const match = String(value || "").match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function isStartBeforeHours(schedule, today, nowMinutes) {
  if (!schedule?.clinicDate || schedule.clinicDate !== today) return false;
  const opening = minutesFromTime(schedule.openingTime);
  if (opening == null || nowMinutes == null) return false;
  return nowMinutes < opening;
}

/**
 * Pause / resume / close / start the clinic queue. Writes an audit entry after a successful change.
 */
async function updateQueueSessionStatus({
  admin,
  callerUid,
  scheduleId,
  queueStatus,
  now = new Date(),
}) {
  const db = databaseFor(admin);
  const actor = await assertStaffCaller(db, callerUid);
  const nextStatus = String(queueStatus || "");
  if (!ALLOWED_QUEUE_STATUSES.has(nextStatus)) {
    throw coded("invalid-argument", "Queue status must be active, paused, or closed.");
  }

  const schedule = await loadSchedule(db, scheduleId);
  if (!staffOwnsSchedule(actor, schedule)) {
    throw coded("permission-denied", "You can only manage the queue for your assigned branch.");
  }
  if (schedule.dayClosed) {
    throw coded("failed-precondition", "Cannot change queue status on a closed clinic day.");
  }
  if (["ended", "completed"].includes(schedule.queueStatus) || schedule.status === "completed") {
    throw coded("failed-precondition", "This clinic queue has already ended.");
  }

  const previousStatus = schedule.queueStatus || "not_started";
  if (previousStatus === nextStatus) {
    return { unchanged: true, scheduleId, queueStatus: previousStatus };
  }

  const today = manilaDateString(now);
  const updates = {
    queueStatus: nextStatus,
    queueStatusUpdatedAt: now.getTime(),
  };
  let isFirstStart = false;

  if (nextStatus === "active" && !schedule.queueStartedAt) {
    if (schedule.status !== "published") {
      throw coded("failed-precondition", "Only a published schedule can be started.");
    }
    if (!schedule.clinicDate || schedule.clinicDate < today) {
      throw coded("failed-precondition", "This clinic date has already passed.");
    }
    if (!scheduleCanStart(schedule, today)) {
      throw coded("failed-precondition", "This queue has already been started.");
    }
    const allSchedules = listFrom(await db.ref("schedules").once("value"));
    if (anyQueueLive(allSchedules, scheduleId)) {
      throw coded(
        "failed-precondition",
        "Another clinic queue is still running. Complete it before starting this one."
      );
    }
    updates.queueStartedAt = now.getTime();
    updates.queueStartedBeforeHours = isStartBeforeHours(schedule, today, manilaNowMinutes(now));
    isFirstStart = true;
  }

  await db.ref(`schedules/${scheduleId}`).update(updates);

  let action = null;
  let description = "";
  if (nextStatus === "active") {
    action = isFirstStart ? "QUEUE_STARTED" : "QUEUE_RESUMED";
    description = isFirstStart
      ? `Started the clinic queue for ${schedule.clinicDate || "an unknown date"} (scheduled ${schedule.openingTime || "?"}–${schedule.closingTime || "?"})${updates.queueStartedBeforeHours ? " before scheduled hours" : ""}`
      : `Resumed the clinic queue for ${schedule.branch || "branch"} on ${schedule.clinicDate || "unknown date"}`;
  } else if (nextStatus === "paused") {
    action = "QUEUE_PAUSED";
    description = `Paused the clinic queue for ${schedule.branch || "branch"} on ${schedule.clinicDate || "unknown date"}`;
  } else if (nextStatus === "closed") {
    action = "QUEUE_CLOSED";
    description = `Closed the clinic queue for ${schedule.branch || "branch"} on ${schedule.clinicDate || "unknown date"}`;
  }

  await writeSessionAudit(db, {
    action,
    category: "queue_operations",
    actorUid: actor.uid,
    actorName: actor.name,
    actorRole: actor.role,
    description,
    targetType: "schedule",
    targetId: scheduleId,
    branchId: branchIdFor(schedule),
    metadata: {
      previousStatus,
      queueStatus: nextStatus,
      clinicDate: schedule.clinicDate || null,
      branchName: schedule.branch || null,
      isFirstStart,
    },
  });

  return {
    unchanged: false,
    scheduleId,
    queueStatus: nextStatus,
    isFirstStart,
    needsRecalculate: nextStatus === "active" || LIVE_QUEUE_STATUSES.has(nextStatus),
  };
}

/**
 * End the clinic session (complete schedule + leftover reservations). Audited after success.
 */
async function endClinicSession({ admin, callerUid, scheduleId }) {
  const db = databaseFor(admin);
  const actor = await assertStaffCaller(db, callerUid);
  const schedule = await loadSchedule(db, scheduleId);
  if (!staffOwnsSchedule(actor, schedule)) {
    throw coded("permission-denied", "You can only end the session for your assigned branch.");
  }
  if (schedule.status === "completed" || ["ended", "completed"].includes(schedule.queueStatus)) {
    return { unchanged: true, scheduleId };
  }

  const now = Date.now();
  const updates = {
    [`schedules/${scheduleId}/status`]: "completed",
    [`schedules/${scheduleId}/queueStatus`]: "completed",
    [`schedules/${scheduleId}/completedAt`]: now,
    [`schedules/${scheduleId}/scheduleCompletedAt`]: now,
    [`schedules/${scheduleId}/queueStatusUpdatedAt`]: now,
  };

  const reservations = listFrom(
    await db.ref("reservations").orderByChild("scheduleId").equalTo(scheduleId).once("value")
  );
  let completedReservations = 0;
  for (const reservation of reservations) {
    if (FINAL_RESERVATION_STATUSES.has(reservation.status)) continue;
    updates[`reservations/${reservation.id}/status`] = "completed";
    updates[`reservations/${reservation.id}/completedAt`] = now;
    completedReservations += 1;
  }

  await db.ref().update(updates);

  await writeSessionAudit(db, {
    action: "SCHEDULE_COMPLETED",
    category: "schedule_management",
    actorUid: actor.uid,
    actorName: actor.name,
    actorRole: actor.role,
    description: `Ended clinic session for ${schedule.branch || "branch"} on ${schedule.clinicDate || "unknown date"}`,
    targetType: "schedule",
    targetId: scheduleId,
    branchId: branchIdFor(schedule),
    metadata: {
      clinicDate: schedule.clinicDate || null,
      branchName: schedule.branch || null,
      previousQueueStatus: schedule.queueStatus || null,
      completedReservations,
    },
  });

  return { unchanged: false, scheduleId, completedReservations };
}

/**
 * Update published schedule slot capacity. Audited after a successful change.
 */
async function updateScheduleSlotCapacity({ admin, callerUid, scheduleId, slotCapacity }) {
  const db = databaseFor(admin);
  const actor = await assertStaffCaller(db, callerUid);
  const schedule = await loadSchedule(db, scheduleId);
  if (!staffOwnsSchedule(actor, schedule)) {
    throw coded("permission-denied", "You can only change slots for your assigned branch.");
  }
  if (schedule.dayClosed) {
    throw coded("failed-precondition", "Cannot change capacity on a closed clinic day.");
  }
  if (schedule.status === "completed" || ["ended", "completed"].includes(schedule.queueStatus)) {
    throw coded("failed-precondition", "Cannot change capacity after the session has ended.");
  }

  const next = Number(slotCapacity);
  if (!Number.isInteger(next) || next < MIN_SLOT_CAPACITY) {
    throw coded("invalid-argument", "Capacity must be a whole number of at least 0.");
  }
  if (next > MAX_SLOT_CAPACITY) {
    throw coded("invalid-argument", `Capacity cannot exceed ${MAX_SLOT_CAPACITY}.`);
  }

  const before = Number(schedule.slotCapacity || 0);
  if (before === next) {
    return { unchanged: true, scheduleId, slotCapacity: before };
  }

  const taken = await countActiveReservations(db, scheduleId);
  const counter =
    schedule.booking && schedule.booking.activeSlotCount != null
      ? Number(schedule.booking.activeSlotCount) || 0
      : null;
  const occupied = counter == null ? taken : Math.min(counter, taken);
  if (next < occupied) {
    throw coded(
      "failed-precondition",
      `Cannot reduce capacity below the ${occupied} already reserved.`
    );
  }

  await db.ref(`schedules/${scheduleId}`).update({
    slotCapacity: next,
    slotCapacityUpdatedAt: Date.now(),
  });

  await writeSessionAudit(db, {
    action: "SLOT_CAPACITY_UPDATED",
    category: "schedule_management",
    actorUid: actor.uid,
    actorName: actor.name,
    actorRole: actor.role,
    description: `Changed slot capacity for ${schedule.branch || "branch"} on ${schedule.clinicDate || "unknown date"} from ${before} to ${next}`,
    targetType: "schedule",
    targetId: scheduleId,
    branchId: branchIdFor(schedule),
    metadata: {
      before: { slotCapacity: before },
      after: { slotCapacity: next },
      clinicDate: schedule.clinicDate || null,
      branchName: schedule.branch || null,
      occupied,
    },
  });

  return { unchanged: false, scheduleId, slotCapacity: next, before, occupied };
}

module.exports = {
  updateQueueSessionStatus,
  endClinicSession,
  updateScheduleSlotCapacity,
};
