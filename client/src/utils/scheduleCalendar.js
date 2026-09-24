import { branchesMatch } from "./stringUtils";
import { ACTIVE_RESERVATION_STATUSES } from "../services/reservationService";

export const IN_CLINIC_STATUSES = ["checked_in", "with_doctor", "in_consultation"];
export const CLINIC_CANCELLABLE_STATUSES = [
  "reserved",
  "waiting",
  "validation_open",
  "waiting_for_window",
];

export function slotsTaken(schedule, reservations = []) {
  if (schedule?.booking && schedule.booking.activeSlotCount != null) {
    return Number(schedule.booking.activeSlotCount) || 0;
  }
  return reservations.filter(
    (reservation) =>
      reservation.scheduleId === schedule?.id &&
      ACTIVE_RESERVATION_STATUSES.includes(reservation.status)
  ).length;
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

const LIVE_QUEUE_STATUSES = ["active", "paused", "closed"];

export function schedulesReadyToStart(schedules, today) {
  const list = Array.isArray(schedules) ? schedules : Object.values(schedules || {});
  const liveRunning = list.some(
    (schedule) =>
      schedule?.status === "published" &&
      !schedule.dayClosed &&
      LIVE_QUEUE_STATUSES.includes(schedule.queueStatus)
  );
  if (liveRunning) return [];
  return list.filter(
    (schedule) =>
      schedule?.status === "published" &&
      schedule.clinicDate === today &&
      !schedule.dayClosed &&
      !LIVE_QUEUE_STATUSES.includes(schedule.queueStatus) &&
      schedule.queueStatus !== "ended" &&
      schedule.queueStatus !== "completed"
  );
}

export function queueHasEnded(schedule) {
  if (!schedule) return false;
  return (
    schedule.status === "completed" ||
    ["closed", "ended", "completed"].includes(schedule.queueStatus)
  );
}

function formatClinicClock(time) {
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
