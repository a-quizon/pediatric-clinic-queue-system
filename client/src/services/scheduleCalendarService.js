import { getDb } from "../firebase/database";
import { auth } from "../firebase/auth";
import { ref, push, set, get, update, remove } from "firebase/database";
import { subscribeOnValue } from "../firebase/rtdbSubscribe";
import { getPushApiBase } from "./pushService";
import { getBranchConfigurations } from "./branchConfigurationService";
import { getReservationsBySchedule, ACTIVE_RESERVATION_STATUSES } from "./reservationService";
import { deleteSchedule } from "./scheduleService";
import { logAuditEvent, AUDIT_ACTIONS, AUDIT_CATEGORIES } from "./auditService";
import { recalculateEntireQueue } from "./queueEngine";
import { recalculateRollingValidation } from "./rollingValidationService";
import { branchesMatch } from "../utils/stringUtils";
import { closureReasonLabel } from "../utils/closureReasons";
import { manilaDateString, eachDateInclusive, addManilaDays } from "../utils/manilaDate";
import {
  IN_CLINIC_STATUSES,
  CLINIC_CANCELLABLE_STATUSES,
  closureForDate,
  sameBranch,
} from "../utils/scheduleCalendar";
import { checkScheduleOpening } from "../utils/scheduleOpeningRules";

const closuresRef = () => ref(getDb(), "clinicClosures");

// SCHEDULE_AVAILABLE parent broadcast removed (audit M1). Publish stays quiet for parents.

export const subscribeToClinicClosures = (callback) => {
  if (typeof callback !== "function") return () => {};
  return subscribeOnValue(closuresRef(), (snapshot) => {
    if (!snapshot.exists()) {
      callback([]);
      return;
    }
    const data = snapshot.val();
    callback(Object.entries(data).map(([id, value]) => ({ id, ...value })));
  });
};

const loadSchedules = async () => {
  const snapshot = await get(ref(getDb(), "schedules"));
  if (!snapshot.exists()) return [];
  return Object.entries(snapshot.val()).map(([id, value]) => ({ id, ...value }));
};

const branchRecord = (branches, branchId, branchName) =>
  branches.find((branch) => branch.id === branchId || branchesMatch(branch.name, branchName));

/** User-facing reason a date cannot be posted, or null when it can. */
export function explainDateSkip({
  dateStr,
  branch,
  branchId,
  branchName,
  schedules,
  closures,
  today = manilaDateString(),
}) {
  const check = checkScheduleOpening({ dateStr, branch, branchId, branchName, schedules, closures, today });
  return check.ok ? null : check.message;
}

const callPublishClinicDays = async (payload) => {
  const current = auth.currentUser;
  if (!current) throw new Error("You must be signed in.");
  const token = await current.getIdToken();
  let response;
  try {
    response = await fetch(`${getPushApiBase()}/api/schedules/publish`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    const wrapped = new Error("Unable to reach the clinic server. Please try again.");
    wrapped.cause = error;
    throw wrapped;
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const wrapped = new Error(body.message || "Could not post this day.");
    wrapped.cause = body;
    throw wrapped;
  }
  return body;
};

async function contextForBranch(branchId, branchName) {
  const branches = await getBranchConfigurations();
  const branch = branchRecord(branches, branchId, branchName);
  const schedules = await loadSchedules();
  const closureSnap = await get(closuresRef());
  const closures = closureSnap.exists()
    ? Object.entries(closureSnap.val()).map(([id, value]) => ({ id, ...value }))
    : [];
  return { branch, schedules, closures, branches };
}

export async function previewPublishDates({ branchId, branchName, dates }) {
  const { branch, schedules, closures } = await contextForBranch(branchId, branchName);
  return dates.map((dateStr) => ({
    dateStr,
    skip: explainDateSkip({
      dateStr,
      branch,
      branchId,
      branchName: branch?.name || branchName,
      schedules,
      closures,
    }),
  }));
}

export async function publishSingleDay({ branchId, branchName, dateStr, slotCapacity }) {
  const result = await callPublishClinicDays({
    mode: "single",
    branchId,
    branchName,
    days: [{ dateStr, slotCapacity: Number(slotCapacity) }],
  });
  const scheduleId = result.posted?.[0]?.scheduleId || null;
  logAuditEvent({
    action: AUDIT_ACTIONS.SCHEDULE_PUBLISHED,
    category: AUDIT_CATEGORIES.SCHEDULE_MANAGEMENT,
    description: `Published schedule for ${result.branchName || branchName} on ${dateStr}`,
    targetType: "schedule",
    targetId: scheduleId,
    branchId: result.branchName || branchName,
  });
  return scheduleId;
}

export async function publishDateRange({ branchId, branchName, startDate, endDate, slotCapacity }) {
  const dates = eachDateInclusive(startDate, endDate);
  if (dates.length === 0) {
    throw new Error("No days in that range can be posted.");
  }
  let result;
  try {
    result = await callPublishClinicDays({
      mode: "bulk",
      branchId,
      branchName,
      days: dates.map((dateStr) => ({ dateStr, slotCapacity: Number(slotCapacity) })),
    });
  } catch (error) {
    if (error.cause?.error === "failed-precondition") {
      throw new Error("No days in that range can be posted.", { cause: error });
    }
    throw error;
  }
  logAuditEvent({
    action: AUDIT_ACTIONS.SCHEDULE_RANGE_PUBLISHED,
    category: AUDIT_CATEGORIES.SCHEDULE_MANAGEMENT,
    description: `Published ${result.posted.length} day(s) for ${result.branchName || branchName} from ${startDate} to ${endDate}`,
    targetType: "schedule",
    branchId: result.branchId || branchId,
  });
  return { posted: result.posted.map((item) => item.dateStr), skipped: result.skipped || [] };
}

export async function copyPreviousWeek({ branchId, branchName, weekStart }) {
  const sourceStart = addManilaDays(weekStart, -7);
  const { branch, schedules, closures } = await contextForBranch(branchId, branchName);
  const name = branch?.name || branchName;
  const copies = [];
  const skipped = [];
  for (let offset = 0; offset < 7; offset += 1) {
    const sourceDate = addManilaDays(sourceStart, offset);
    const targetDate = addManilaDays(weekStart, offset);
    const source = schedules.find(
      (schedule) =>
        schedule.clinicDate === sourceDate &&
        schedule.status === "published" &&
        sameBranch(schedule, branchId, name)
    );
    if (!source) continue;
    const skip = explainDateSkip({
      dateStr: targetDate,
      branch,
      branchId,
      branchName: name,
      schedules,
      closures,
    });
    if (skip) {
      skipped.push({ dateStr: targetDate, skip });
      continue;
    }
    copies.push({ dateStr: targetDate, slotCapacity: Number(source.slotCapacity || 0) });
  }
  if (copies.length === 0) {
    throw new Error("Nothing from the previous week can be copied onto this week.");
  }
  let result;
  try {
    result = await callPublishClinicDays({ mode: "bulk", branchId, branchName: name, days: copies });
  } catch (error) {
    if (error.cause?.error === "failed-precondition") {
      throw new Error("Nothing from the previous week can be copied onto this week.", { cause: error });
    }
    throw error;
  }
  logAuditEvent({
    action: AUDIT_ACTIONS.SCHEDULE_RANGE_PUBLISHED,
    category: AUDIT_CATEGORIES.SCHEDULE_MANAGEMENT,
    description: `Copied ${result.posted.length} posted day(s) into the week of ${weekStart} for ${name}`,
    targetType: "schedule",
    branchId: branch?.id || branchId,
  });
  return { posted: result.posted, skipped: [...skipped, ...(result.skipped || [])] };
}

const reservationsForSchedule = async (scheduleId) => {
  try {
    return await getReservationsBySchedule(scheduleId);
  } catch (error) {
    console.error(error);
    return [];
  }
};

export async function previewClosure({ branchId, branchName, startDate, endDate, allBranches = false }) {
  const branches = await getBranchConfigurations();
  const targets = allBranches
    ? branches
    : [branchRecord(branches, branchId, branchName)].filter(Boolean);
  const schedules = await loadSchedules();
  const closureSnap = await get(closuresRef());
  const closures = closureSnap.exists()
    ? Object.entries(closureSnap.val()).map(([id, value]) => ({ id, ...value }))
    : [];
  const dates = eachDateInclusive(startDate, endDate);
  const blocking = [];
  const cancellable = [];
  const overlaps = [];

  for (const branch of targets) {
    for (const dateStr of dates) {
      const overlap = closureForDate(closures, dateStr, branch.id, branch.name);
      if (overlap) overlaps.push({ dateStr, branch: branch.name });
      const schedule = schedules.find(
        (item) => item.clinicDate === dateStr && sameBranch(item, branch.id, branch.name)
      );
      if (!schedule) continue;
      const reservations = await reservationsForSchedule(schedule.id);
      reservations.forEach((reservation) => {
        if (IN_CLINIC_STATUSES.includes(reservation.status)) {
          blocking.push(reservation);
        } else if (CLINIC_CANCELLABLE_STATUSES.includes(reservation.status) || ACTIVE_RESERVATION_STATUSES.includes(reservation.status) && !IN_CLINIC_STATUSES.includes(reservation.status)) {
          if (CLINIC_CANCELLABLE_STATUSES.includes(reservation.status)) cancellable.push(reservation);
        }
      });
    }
  }

  return {
    targets,
    dates,
    blocking,
    cancellable,
    overlaps,
  };
}

async function cancelWaitingReservations(schedule, closureId, reasonLabel) {
  const reservations = await reservationsForSchedule(schedule.id);
  const waiting = reservations.filter((reservation) =>
    CLINIC_CANCELLABLE_STATUSES.includes(reservation.status)
  );
  const updates = {};
  waiting.forEach((reservation) => {
    updates[`reservations/${reservation.id}/status`] = "cancelled_by_clinic";
    updates[`reservations/${reservation.id}/cancelledAt`] = Date.now();
    updates[`reservations/${reservation.id}/cancellationReason`] = reasonLabel;
    updates[`reservations/${reservation.id}/closureId`] = closureId;
    if (schedule.clinicDate) {
      updates[`reservations/${reservation.id}/clinicDate`] = schedule.clinicDate;
    }
  });
  if (Object.keys(updates).length > 0) {
    await update(ref(getDb()), updates);
    await recalculateRollingValidation(schedule.id);
    await recalculateEntireQueue(schedule.id);
  }
  return waiting.length;
}

export async function applyClosure({
  branchId,
  branchName,
  startDate,
  endDate,
  reason,
  note,
  user,
  allBranches = false,
}) {
  const preview = await previewClosure({ branchId, branchName, startDate, endDate, allBranches });
  if (preview.targets.length === 0) throw new Error("Branch not found.");
  if (preview.overlaps.length > 0) {
    throw new Error("That range overlaps a closure that is already posted. Remove it first.");
  }
  if (preview.blocking.length > 0) {
    throw new Error("Finish or forfeit patients who are already in the clinic before closing these days.");
  }

  const reasonLabel = closureReasonLabel(reason);
  const schedules = await loadSchedules();
  let cancelled = 0;

  for (const branch of preview.targets) {
    const closureRef = push(closuresRef());
    await set(closureRef, {
      branch: branch.name,
      branchId: branch.id,
      startDate,
      endDate,
      reason,
      note: String(note || "").trim(),
      createdBy: user?.uid || null,
      createdAt: Date.now(),
    });

    let cancelledHere = 0;
    for (const dateStr of preview.dates) {
      const schedule = schedules.find(
        (item) => item.clinicDate === dateStr && sameBranch(item, branch.id, branch.name)
      );
      if (!schedule) continue;
      const reservations = await reservationsForSchedule(schedule.id);
      const hasReservations = reservations.length > 0;
      if (schedule.status === "draft" && !hasReservations) {
        await deleteSchedule(schedule.id);
        continue;
      }
      await update(ref(getDb(), `schedules/${schedule.id}`), {
        dayClosed: true,
        closureId: closureRef.key,
        closureReason: reason,
        closureNote: String(note || "").trim(),
      });
      cancelledHere += await cancelWaitingReservations(
        { ...schedule, clinicDate: dateStr },
        closureRef.key,
        reasonLabel
      );
    }
    cancelled += cancelledHere;

    logAuditEvent({
      action: AUDIT_ACTIONS.CLINIC_DAY_CLOSED,
      category: AUDIT_CATEGORIES.SCHEDULE_MANAGEMENT,
      description: `Closed ${branch.name} from ${startDate} to ${endDate} (${reasonLabel}). Cancelled ${cancelledHere} reservation(s).`,
      targetType: "clinicClosure",
      targetId: closureRef.key,
      branchId: branch.id,
    });
  }

  return { cancelled, branches: preview.targets.length };
}

export async function removeClosure(closureId) {
  const snapshot = await get(ref(getDb(), `clinicClosures/${closureId}`));
  if (!snapshot.exists()) throw new Error("Closure not found.");
  const closure = snapshot.val();
  const today = manilaDateString();
  if (closure.startDate <= today) {
    throw new Error("Only a future closure can be removed.");
  }

  const reservationSnap = await get(ref(getDb(), "reservations"));
  if (reservationSnap.exists()) {
    const cancelled = Object.values(reservationSnap.val()).some(
      (reservation) => reservation.closureId === closureId && reservation.status === "cancelled_by_clinic"
    );
    if (cancelled) {
      throw new Error("This closure already cancelled reservations, so it stays on record.");
    }
  }

  const schedules = await loadSchedules();
  const updates = {};
  schedules.forEach((schedule) => {
    if (schedule.closureId === closureId) {
      updates[`schedules/${schedule.id}/dayClosed`] = false;
      updates[`schedules/${schedule.id}/closureId`] = null;
      updates[`schedules/${schedule.id}/closureReason`] = null;
      updates[`schedules/${schedule.id}/closureNote`] = null;
    }
  });
  if (Object.keys(updates).length > 0) {
    await update(ref(getDb()), updates);
  }
  await remove(ref(getDb(), `clinicClosures/${closureId}`));
  logAuditEvent({
    action: AUDIT_ACTIONS.CLINIC_CLOSURE_REMOVED,
    category: AUDIT_CATEGORIES.SCHEDULE_MANAGEMENT,
    description: `Removed a future closure for ${closure.branch} (${closure.startDate} to ${closure.endDate})`,
    targetType: "clinicClosure",
    targetId: closureId,
    branchId: closure.branchId,
  });
}
