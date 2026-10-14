import { isDateInRange } from "./reportDateRange.js";
import { branchesMatch } from "./stringUtils.js";
import { formatManilaLong } from "./manilaDate.js";

export const ALL_BRANCHES = "All";

const CHECKED_UP = new Set(["completed", "consultation_completed"]);
const FORFEITED = new Set(["forfeited", "penalized", "late_limit_reached"]);

export function isCompletedSchedule(schedule) {
  return Boolean(
    schedule &&
      (schedule.status === "completed" ||
        schedule.queueStatus === "completed" ||
        schedule.queueStatus === "ended")
  );
}

export function computeSessionMetrics(reservations) {
  const list = reservations || [];
  const totalReservations = list.length;
  const checkedUp = list.filter((r) => CHECKED_UP.has(r.status)).length;
  const cancelled = list.filter((r) => r.status === "cancelled").length;
  const forfeited = list.filter((r) => FORFEITED.has(r.status)).length;
  const completionRate = totalReservations > 0 ? (checkedUp / totalReservations) * 100 : 0;
  return {
    totalReservations,
    checkedUp,
    cancelled,
    forfeited,
    completionRate: parseFloat(completionRate.toFixed(2)),
  };
}

/** Completed schedules joined with their reservations (by scheduleId). */
export function buildSessionRows(schedules, reservations) {
  const byScheduleId = new Map();
  for (const reservation of reservations || []) {
    if (!reservation?.scheduleId) continue;
    const bucket = byScheduleId.get(reservation.scheduleId) || [];
    bucket.push(reservation);
    byScheduleId.set(reservation.scheduleId, bucket);
  }
  return (schedules || [])
    .filter(isCompletedSchedule)
    .map((schedule) => ({
      ...schedule,
      metrics: computeSessionMetrics(byScheduleId.get(schedule.id)),
    }));
}

export function filterSessions(rows, { branch = ALL_BRANCHES, range = {} } = {}) {
  return (rows || []).filter((row) => {
    if (branch && branch !== ALL_BRANCHES && !branchesMatch(row.branch, branch)) return false;
    return isDateInRange(row.clinicDate, range);
  });
}

/** Newest clinic date first; same-day sessions by opening time. */
export function sortSessionsNewestFirst(rows) {
  return [...(rows || [])].sort((a, b) => {
    const byDate = String(b.clinicDate || "").localeCompare(String(a.clinicDate || ""));
    if (byDate !== 0) return byDate;
    return String(a.openingTime || "").localeCompare(String(b.openingTime || ""));
  });
}

/** Title/subtitle for the read-only session reservations panel. */
export function sessionPanelLabels(session) {
  if (!session) return { title: "Reservations", subtitle: null };
  const title = session.clinicDate
    ? `Reservations on ${formatManilaLong(session.clinicDate)}`
    : "Reservations";
  const hours =
    session.openingTime && session.closingTime ? `${session.openingTime} - ${session.closingTime}` : null;
  const subtitle = [session.branch, hours].filter(Boolean).join(" · ") || null;
  return { title, subtitle };
}

export function aggregateSessionMetrics(rows) {
  const totals = (rows || []).reduce(
    (acc, row) => {
      acc.totalReservations += row.metrics.totalReservations;
      acc.checkedUp += row.metrics.checkedUp;
      acc.cancelled += row.metrics.cancelled;
      acc.forfeited += row.metrics.forfeited;
      return acc;
    },
    { totalReservations: 0, checkedUp: 0, cancelled: 0, forfeited: 0 }
  );
  totals.completionRate =
    totals.totalReservations > 0 ? Math.round((totals.checkedUp / totals.totalReservations) * 100) : 0;
  return totals;
}
