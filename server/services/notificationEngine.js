const { getDb } = require("./firebaseAdmin");
const { sendPushToParent, sanitizeKey } = require("./webPushService");
const {
  deliverSmsForNotification,
  enrichSmsContext,
  computeAheadOfYouForSms,
} = require("./smsNotificationService");

const ACTIVE_RESERVATION_STATUSES = [
  "reserved",
  "checked_in",
  "waiting",
  "in_consultation",
  "with_doctor",
  "validation_open",
  "waiting_for_window",
];

/** Patients ahead that triggers the one-time nearing-turn SMS. */
const NEARING_TURN_AHEAD_COUNT = 3;

const NOTIFICATION_CONFIG = {
  SCHEDULE_AVAILABLE: {
    type: "info",
    title: "Schedule Available",
    message: "New clinic schedule is now available for reservation.",
    url: "/parent/reserve",
  },
  SLOT_RESERVED: {
    type: "success",
    title: "Reservation Confirmed",
    message: "Your clinic slot has been reserved successfully.",
    url: "/parent/reservations",
  },
  QUEUE_STARTED: {
    type: "info",
    title: "Queue Started",
    message: "The clinic queue has started.",
    url: "/parent/notifications",
  },
  NEARING_TURN: {
    type: "warning",
    title: "Your Turn Is Near",
    message: "There are only 3 patients ahead of you. Please proceed to the clinic.",
    url: "/parent/reservations",
  },
  QUEUE_PAUSED: {
    type: "warning",
    title: "Queue Paused",
    message: "The clinic queue has been paused.",
    url: "/parent/notifications",
  },
  QUEUE_RESUMED: {
    type: "info",
    title: "Queue Resumed",
    message: "The clinic queue has resumed.",
    url: "/parent/notifications",
  },
  QUEUE_CLOSED: {
    type: "warning",
    title: "Queue Closed",
    message: "Reservations are now closed for today's clinic.",
    url: "/parent/notifications",
  },
  CLINIC_SESSION_ENDED: {
    type: "warning",
    title: "Clinic Session Ended",
    message: "Today's clinic session has ended.",
    url: "/parent/notifications",
  },
  ALMOST_NEXT: {
    type: "warning",
    title: "Almost Next",
    message: "Your turn is approaching soon. Please be ready.",
    url: "/parent/reservations",
  },
  YOU_ARE_NEXT: {
    type: "warning",
    title: "You're Next",
    message: "You're next in line for consultation. Please prepare your QR code.",
    url: "/parent/reservations",
  },
  QR_VERIFIED: {
    type: "success",
    title: "Arrival Verified",
    message: "Your arrival has been verified.",
    url: "/parent/reservations",
  },
  CONSULTATION_STARTED: {
    type: "success",
    title: "With Doctor",
    message: "You are now with the doctor.",
    url: "/parent/reservations",
  },
  CONSULTATION_COMPLETED: {
    type: "success",
    title: "Consultation Completed",
    message: "Your consultation has been completed.",
    url: "/parent/notifications",
  },
  PENALIZED: {
    type: "error",
    title: "Queue Position Adjusted",
    message: "You were moved back in today's queue because you were unavailable.",
    url: "/parent/reservations",
  },
  FORFEITED: {
    type: "error",
    title: "Reservation Forfeited",
    message: "Your reservation has been forfeited after exceeding the clinic's late arrival limit.",
    url: "/parent/notifications",
  },
  CHECK_IN_REQUESTED: {
    type: "info",
    title: "Check-In Requested",
    message: "Please proceed to the clinic and have your QR Code validated by the secretary.",
    url: "/parent/reservations",
  },
};

function computeReservationState(reservation, allReservations = []) {
  if (!reservation) return null;
  if (reservation.status === "cancelled") return "CANCELLED";
  if (["forfeited", "penalized", "late_limit_reached"].includes(reservation.status)) return "FORFEITED";
  if (["completed", "consultation_completed"].includes(reservation.status)) return "COMPLETED";
  if (["with_doctor", "in_consultation"].includes(reservation.status)) return "WITH_DOCTOR";

  const hasConsultationStarted = allReservations.some(
    (item) =>
      item.scheduleId === reservation.scheduleId &&
      (["with_doctor", "in_consultation", "completed", "consultation_completed"].includes(item.status) ||
        item.sentToDoctorAt)
  );

  if (!hasConsultationStarted) {
    if (reservation.status === "checked_in") return "CHECKED_IN";
    return "WAITING";
  }

  const activeWaiting = allReservations
    .filter(
      (item) =>
        item.scheduleId === reservation.scheduleId &&
        ["reserved", "waiting", "validation_open", "waiting_for_window", "checked_in"].includes(item.status)
    )
    .sort((a, b) => (a.sortTimestamp || a.createdAt || 0) - (b.sortTimestamp || b.createdAt || 0));

  const index = activeWaiting.findIndex((item) => item.id === reservation.id);
  if (index === 0) return "YOU_ARE_NEXT";
  if (index === 1) return "ALMOST_NEXT";
  if (reservation.status === "checked_in") return "CHECKED_IN";
  return "WAITING";
}

async function isParent(uid) {
  if (!uid) return false;
  const snap = await getDb().ref(`users/${uid}`).once("value");
  if (!snap.exists()) return false;
  const user = snap.val() || {};
  return user.role === "parent" && user.status !== "inactive" && user.isDeleted !== true;
}

async function deliverNotification(eventId, context = {}) {
  const config = NOTIFICATION_CONFIG[eventId];
  if (!config || !context.parentId) return false;
  if (!(await isParent(context.parentId))) return false;

  const key = sanitizeKey(context.dedupeKey || `${eventId}_${Date.now()}`);
  const body = context.customMessage || config.message;
  const notification = {
    id: key,
    parentId: context.parentId,
    type: eventId,
    title: config.title,
    body,
    message: body,
    severity: config.type,
    createdAt: Date.now(),
    read: false,
    reservationId: context.reservationId || context.entityId || null,
    branchId: context.branchId || null,
    metadata: context.metadata || null,
    dedupeKey: context.dedupeKey || key,
    url: config.url,
  };

  const notifRef = getDb().ref(`notifications/${context.parentId}/${key}`);
  const existing = await notifRef.once("value");
  if (!existing.exists()) {
    await notifRef.update(notification);
  }
  await sendPushToParent(context.parentId, existing.exists() ? existing.val() : notification, { notificationId: key });

  try {
    const smsContext = await enrichSmsContext(eventId, context);
    await deliverSmsForNotification(eventId, smsContext, key);
  } catch (err) {
    console.error(`[notificationEngine] SMS delivery failed for ${eventId}:`, err.message);
  }

  return true;
}

function eventsFromReservationChange(before, after) {
  const events = [];
  if (!after?.parentId) return events;

  const id = after.id;
  const prevStatus = before?.status;
  const currStatus = after.status;
  const prevPenalty = before?.penaltyCount || 0;
  const currPenalty = after.penaltyCount || 0;
  const prevCheckInReq = before?.checkInRequestedAt || 0;
  const currCheckInReq = after.checkInRequestedAt || 0;
  const branchId = after.branchId || after.branch || null;

  // New reservation (create) — Slot Reserved SMS/notification
  if (!before && currStatus === "reserved") {
    events.push({
      eventId: "SLOT_RESERVED",
      parentId: after.parentId,
      reservationId: id,
      scheduleId: after.scheduleId || null,
      branchId,
      queueNumber: after.queueNumber ?? after.originalQueueNumber ?? after.queuePosition,
      dedupeKey: `slot_reserved_${id}`,
    });
  }

  if (currCheckInReq > prevCheckInReq) {
    events.push({
      eventId: "CHECK_IN_REQUESTED",
      parentId: after.parentId,
      reservationId: id,
      branchId,
      dedupeKey: `check_in_req_${id}_${currCheckInReq}`,
    });
  }

  if (currPenalty > prevPenalty && currStatus !== "forfeited") {
    events.push({
      eventId: "PENALIZED",
      parentId: after.parentId,
      reservationId: id,
      branchId,
      dedupeKey: `penalized_${id}_${currPenalty}`,
    });
  }

  if (prevStatus !== currStatus) {
    if (currStatus === "checked_in") {
      events.push({
        eventId: "QR_VERIFIED",
        parentId: after.parentId,
        reservationId: id,
        branchId,
        dedupeKey: `checked_in_${id}`,
      });
    } else if (currStatus === "in_consultation" || currStatus === "with_doctor") {
      events.push({
        eventId: "CONSULTATION_STARTED",
        parentId: after.parentId,
        reservationId: id,
        branchId,
        dedupeKey: `consult_start_${id}`,
      });
    } else if (currStatus === "completed" || currStatus === "consultation_completed") {
      events.push({
        eventId: "CONSULTATION_COMPLETED",
        parentId: after.parentId,
        reservationId: id,
        branchId,
        dedupeKey: `consult_complete_${id}`,
      });
    } else if (currStatus === "forfeited") {
      events.push({
        eventId: "FORFEITED",
        parentId: after.parentId,
        reservationId: id,
        branchId,
        dedupeKey: `forfeited_${id}`,
      });
    }
  }

  return events;
}

function eventsFromScheduleChange(before, after, activeParentIds) {
  const events = [];
  if (!after?.id) return events;

  const schedId = after.id;
  const prevPublished = before?.status === "published";
  const currPublished = after.status === "published";

  if (!prevPublished && currPublished) {
    activeParentIds.allParents.forEach((parentId) => {
      events.push({
        eventId: "SCHEDULE_AVAILABLE",
        parentId,
        entityId: schedId,
        branchId: after.branch || null,
        dedupeKey: `sched_avail_${schedId}`,
      });
    });
    return events;
  }

  const prevStatus = before?.queueStatus;
  const currStatus = after.queueStatus;
  if (prevStatus === currStatus) return events;

  const recipients = activeParentIds.forSchedule || [];
  if (!recipients.length) return events;

  const clinicDate = after.clinicDate || "unknown";
  const base = { entityId: schedId, branchId: after.branch || null };

  if ((prevStatus === "not_started" || !prevStatus) && currStatus === "active") {
    recipients.forEach((parentId) =>
      events.push({
        ...base,
        eventId: "QUEUE_STARTED",
        parentId,
        scheduleId: schedId,
        clinicDate,
        branchName: after.branch || null,
        dedupeKey: `queue_start_${schedId}_${clinicDate}`,
      })
    );
  } else if (prevStatus === "active" && currStatus === "paused") {
    const ts = after.queueStatusUpdatedAt || after.updatedAt || 0;
    recipients.forEach((parentId) =>
      events.push({
        ...base,
        eventId: "QUEUE_PAUSED",
        parentId,
        dedupeKey: `queue_paused_${schedId}_${clinicDate}_${ts}`,
      })
    );
  } else if (prevStatus === "paused" && currStatus === "active") {
    const ts = after.queueStatusUpdatedAt || after.updatedAt || 0;
    recipients.forEach((parentId) =>
      events.push({
        ...base,
        eventId: "QUEUE_RESUMED",
        parentId,
        dedupeKey: `queue_resumed_${schedId}_${clinicDate}_${ts}`,
      })
    );
  } else if (currStatus === "closed" && prevStatus !== "closed") {
    recipients.forEach((parentId) =>
      events.push({
        ...base,
        eventId: "QUEUE_CLOSED",
        parentId,
        dedupeKey: `queue_closed_${schedId}_${clinicDate}`,
      })
    );
  } else if (
    (currStatus === "ended" || currStatus === "completed" || after.status === "completed") &&
    prevStatus !== "ended" &&
    prevStatus !== "completed" &&
    before?.status !== "completed"
  ) {
    recipients.forEach((parentId) =>
      events.push({
        ...base,
        eventId: "CLINIC_SESSION_ENDED",
        parentId,
        dedupeKey: `clinic_ended_${schedId}_${clinicDate}`,
      })
    );
  }

  return events;
}

async function getReservationsBySchedule(scheduleId) {
  const snap = await getDb()
    .ref("reservations")
    .orderByChild("scheduleId")
    .equalTo(scheduleId)
    .once("value");
  if (!snap.exists()) return [];
  return Object.entries(snap.val()).map(([id, value]) => ({ id, ...value }));
}

async function getActiveParentIdsForSchedule(scheduleId) {
  const reservations = await getReservationsBySchedule(scheduleId);
  const ids = new Set();
  reservations.forEach((r) => {
    if (r.parentId && ACTIVE_RESERVATION_STATUSES.includes(r.status)) {
      ids.add(r.parentId);
    }
  });
  return { parentIds: [...ids], reservations };
}

async function getAllParentIds() {
  const snap = await getDb().ref("users").once("value");
  if (!snap.exists()) return [];
  const users = snap.val();
  return Object.entries(users)
    .filter(([, user]) => user && user.role === "parent" && user.status !== "inactive" && user.isDeleted !== true)
    .map(([uid]) => uid);
}

async function evaluatePositionEvents(schedule, reservations) {
  if (!schedule || !["active", "paused", "closed"].includes(schedule.queueStatus)) return;

  const candidates = reservations.filter(
    (r) =>
      r.parentId &&
      !["in_consultation", "with_doctor", "completed", "consultation_completed", "cancelled", "forfeited"].includes(
        r.status
      )
  );

  for (const reservation of candidates) {
    const queueState = computeReservationState(reservation, reservations);
    const aheadOfYou =
      reservation.aheadOfYou != null
        ? Number(reservation.aheadOfYou)
        : computeAheadOfYouForSms(reservation, reservations);

    if (queueState === "YOU_ARE_NEXT") {
      await deliverNotification("YOU_ARE_NEXT", {
        parentId: reservation.parentId,
        reservationId: reservation.id,
        branchId: reservation.branchId || reservation.branch || schedule.branch || null,
        dedupeKey: `you_are_next_${reservation.id}`,
      });
    } else if (queueState === "ALMOST_NEXT") {
      await deliverNotification("ALMOST_NEXT", {
        parentId: reservation.parentId,
        reservationId: reservation.id,
        branchId: reservation.branchId || reservation.branch || schedule.branch || null,
        dedupeKey: `almost_next_${reservation.id}`,
      });
    }

    // Event C — exactly 3 patients ahead; dedupeKey ensures one SMS even if queue pauses
    if (aheadOfYou === NEARING_TURN_AHEAD_COUNT) {
      await deliverNotification("NEARING_TURN", {
        parentId: reservation.parentId,
        reservationId: reservation.id,
        scheduleId: schedule.id,
        branchId: reservation.branchId || reservation.branch || schedule.branch || null,
        queueNumber: reservation.queueNumber ?? reservation.originalQueueNumber,
        clinicDate: schedule.clinicDate,
        dedupeKey: `nearing_turn_${reservation.id}`,
      });
    }
  }
}

async function handleReservationChange(before, after) {
  if (!after) return;

  const events = eventsFromReservationChange(before, after);
  for (const event of events) {
    await deliverNotification(event.eventId, event);
  }

  if (!after.scheduleId) return;
  const scheduleSnap = await getDb().ref(`schedules/${after.scheduleId}`).once("value");
  if (!scheduleSnap.exists()) return;
  const schedule = { id: after.scheduleId, ...scheduleSnap.val() };
  const reservations = await getReservationsBySchedule(after.scheduleId);
  await evaluatePositionEvents(schedule, reservations);
}

async function handleScheduleChange(before, after) {
  if (!after) return;

  const prevPublished = before?.status === "published";
  const currPublished = after.status === "published";
  let allParents = [];
  let forSchedule = [];
  let reservations = [];

  if (!prevPublished && currPublished) {
    allParents = await getAllParentIds();
  } else {
    const active = await getActiveParentIdsForSchedule(after.id);
    forSchedule = active.parentIds;
    reservations = active.reservations;
  }

  const events = eventsFromScheduleChange(before, after, { allParents, forSchedule });
  for (const event of events) {
    await deliverNotification(event.eventId, event);
  }

  if (reservations.length) {
    await evaluatePositionEvents(after, reservations);
  }
}

module.exports = {
  NOTIFICATION_CONFIG,
  ACTIVE_RESERVATION_STATUSES,
  deliverNotification,
  handleReservationChange,
  handleScheduleChange,
  eventsFromReservationChange,
  computeReservationState,
};
