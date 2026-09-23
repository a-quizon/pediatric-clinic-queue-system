import { branchesMatch } from "./stringUtils";
import { ACTIVE_RESERVATION_STATUSES } from "../services/reservationService";

export const IN_CLINIC_STATUSES = ["checked_in", "with_doctor", "in_consultation"];
export const CLINIC_CANCELLABLE_STATUSES = ["reserved", "waiting"];

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

export function queueHasEnded(schedule) {
  if (!schedule) return false;
  return (
    schedule.status === "completed" ||
    ["closed", "ended", "completed"].includes(schedule.queueStatus)
  );
}

export function parentCellKind({ dateStr, today, horizonEnd, schedule, closure, taken }) {
  if (dateStr < today) return "past";
  if (closure || schedule?.dayClosed) return "closed";
  if (!schedule || schedule.status !== "published") return "not_posted";
  if (queueHasEnded(schedule)) return "ended";
  if (dateStr > horizonEnd) return "not_posted";
  if (taken >= Number(schedule.slotCapacity || 0)) return "full";
  return "available";
}
