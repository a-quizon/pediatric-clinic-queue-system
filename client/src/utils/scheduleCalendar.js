import { branchesMatch } from "./stringUtils.js";
import { ACTIVE_RESERVATION_STATUSES } from "./reservationStatuses.js";

export const IN_CLINIC_STATUSES = ["checked_in", "with_doctor", "in_consultation"];
export const CLINIC_CANCELLABLE_STATUSES = [
  "reserved",
  "waiting",
  "validation_open",
  "waiting_for_window",
];

export function countActiveReservations(scheduleId, reservations = []) {
  return (reservations || []).filter(
    (reservation) =>
      reservation?.scheduleId === scheduleId &&
      ACTIVE_RESERVATION_STATUSES.includes(reservation.status)
  ).length;
}

/**
 * Slots consumed on a schedule. The live count of active reservations wins
 * whenever it is known (`reservations` loaded or `liveCount` given), because the
 * server-side `booking.activeSlotCount` can lag behind a cancel/forfeit.
 */
export function slotsTaken(schedule, reservations = null, liveCount = null) {
  const counter =
    schedule?.booking && schedule.booking.activeSlotCount != null
      ? Number(schedule.booking.activeSlotCount) || 0
      : null;
  let live = liveCount != null ? Number(liveCount) || 0 : null;
  if (live == null && Array.isArray(reservations)) {
    live = countActiveReservations(schedule?.id, reservations);
  }
  if (live == null) return counter ?? 0;
  if (counter == null) return live;
  return Math.min(counter, live);
}

export function sameBranch(record, branchId, branchName) {
  if (!record) return false;
  if (branchId && record.branchId && record.branchId === branchId) return true;
  if (branchName && record.branch && branchesMatch(record.branch, branchName)) return true;
  return false;
}

export function closureForDate(closures, dateStr, branchId, branchName) {
  return (closures || []).find((closure) => {
    if (!closure?.startDate || !closure?.endDate) return false;
    if (dateStr < closure.startDate || dateStr > closure.endDate) return false;
    return sameBranch(closure, branchId, branchName);
  }) || null;
}

export function scheduleForDate(schedules, dateStr, branchId, branchName) {
  return (schedules || []).find(
    (schedule) => schedule.clinicDate === dateStr && sameBranch(schedule, branchId, branchName)
  ) || null;
}

export const LIVE_QUEUE_STATUSES = ["active", "paused", "closed"];

function scheduleList(schedules) {
  return Array.isArray(schedules) ? schedules : Object.values(schedules || {});
}

export function anyQueueLive(schedules) {
  return scheduleList(schedules).some(
    (schedule) =>
      schedule?.status === "published" &&
      !schedule.dayClosed &&
      LIVE_QUEUE_STATUSES.includes(schedule.queueStatus)
  );
}

/** A single schedule's own start preconditions; time of day is intentionally not checked. */
export function scheduleCanStart(schedule, today) {
  return Boolean(
    schedule &&
      schedule.status === "published" &&
      schedule.clinicDate &&
      schedule.clinicDate >= today &&
      !schedule.dayClosed &&
      !LIVE_QUEUE_STATUSES.includes(schedule.queueStatus) &&
      schedule.queueStatus !== "ended" &&
      schedule.queueStatus !== "completed"
  );
}

/**
 * Published sessions from today onward that can be started now, nearest first.
 * Returns nothing while any queue is live (one doctor serves every branch).
 */
export function schedulesStartable(schedules, today) {
  const list = scheduleList(schedules);
  if (anyQueueLive(list)) return [];
  return list
    .filter((schedule) => scheduleCanStart(schedule, today))
    .sort((a, b) => {
      if (a.clinicDate !== b.clinicDate) return a.clinicDate < b.clinicDate ? -1 : 1;
      return String(a.openingTime || "").localeCompare(String(b.openingTime || ""));
    });
}

/** Groups startable schedules by clinic date; `defaultDate` is the nearest one. */
export function groupStartableByDate(startable) {
  const byDate = {};
  (startable || []).forEach((schedule) => {
    if (!byDate[schedule.clinicDate]) byDate[schedule.clinicDate] = [];
    byDate[schedule.clinicDate].push(schedule);
  });
  const dates = Object.keys(byDate).sort();
  return { dates, byDate, defaultDate: dates[0] || null };
}

/** True when starting now is ahead of the session's scheduled date or opening time. */
export function isStartBeforeHours(schedule, today, nowMinutes) {
  if (!schedule?.clinicDate) return false;
  if (schedule.clinicDate > today) return true;
  if (schedule.clinicDate < today) return false;
  const [hours, minutes] = String(schedule.openingTime || "").split(":").map(Number);
  if (Number.isNaN(hours)) return false;
  return nowMinutes < hours * 60 + (Number.isNaN(minutes) ? 0 : minutes);
}

export function queueHasEnded(schedule) {
  if (!schedule) return false;
  return (
    schedule.status === "completed" ||
    ["closed", "ended", "completed"].includes(schedule.queueStatus)
  );
}

export function formatClinicClock(time) {
  if (!time) return "";
  const [hours, minutes] = String(time).split(":");
  const hour = parseInt(hours, 10);
  if (Number.isNaN(hour)) return String(time);
  const suffix = hour >= 12 ? "PM" : "AM";
  return `${hour % 12 || 12}:${minutes || "00"} ${suffix}`;
}

/** Copy for the Start Queue confirmation shown to secretary/doctor. */
export function startQueueConfirmMessage(schedule, { formatDate, formatBranch } = {}) {
  const branch = formatBranch
    ? formatBranch(schedule?.branch)
    : String(schedule?.branch || "this branch").replace(/\s*branch\s*$/i, "").trim();
  const dateLabel = formatDate
    ? formatDate(schedule?.clinicDate)
    : schedule?.clinicDate || "today";
  const open = formatClinicClock(schedule?.openingTime);
  const close = formatClinicClock(schedule?.closingTime);
  const hours = open && close ? `${open} – ${close}` : open || close || "clinic hours not set";
  return `You are about to start this clinic queue:\n\nBranch: ${branch}\nDate: ${dateLabel}\nHours: ${hours}\n\nParents with reservations for this day will be notified that the queue has started.`;
}

export function parentCellKind({ dateStr, today, horizonEnd, schedule, closure, taken, owned }) {
  if (dateStr < today) return "past";
  if (closure || schedule?.dayClosed) return "closed";
  if (owned) return "owned";
  if (!schedule || schedule.status !== "published") return "not_posted";
  if (queueHasEnded(schedule)) return "ended";
  if (dateStr > horizonEnd) return "not_posted";
  if (taken >= Number(schedule.slotCapacity || 0)) return "full";
  return "available";
}
