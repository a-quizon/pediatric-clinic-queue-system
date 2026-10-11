import { ACTIVE_RESERVATION_STATUSES } from "./reservationStatuses.js";
import { LIVE_QUEUE_STATUSES } from "./penaltyTimer.js";
import { minutesFromTime } from "./scheduleOpeningRules.js";

export const SESSION_STATUS = Object.freeze({
  ACTIVE: "active",
  WAITING: "waiting",
  UPCOMING: "upcoming",
});

export const STATUS_PRIORITY = Object.freeze({
  [SESSION_STATUS.ACTIVE]: 0,
  [SESSION_STATUS.WAITING]: 1,
  [SESSION_STATUS.UPCOMING]: 2,
});

const IN_CONSULTATION_STATUSES = ["with_doctor", "in_consultation"];
const AT_CLINIC_STATUSES = ["checked_in", "validation_open", "waiting_for_window"];
const FINISHED_SCHEDULE_STATUSES = ["completed", "ended"];

function isScheduleFinished(schedule) {
  return (
    FINISHED_SCHEDULE_STATUSES.includes(schedule?.status) ||
    FINISHED_SCHEDULE_STATUSES.includes(schedule?.queueStatus)
  );
}

/**
 * Active once staff started the session (queue live) or the child is with the doctor,
 * waiting if the clinic date is today or the child is already at the clinic, otherwise upcoming.
 */
export function getSessionStatus(reservation, schedule, { today }) {
  if (
    LIVE_QUEUE_STATUSES.includes(schedule?.queueStatus) ||
    IN_CONSULTATION_STATUSES.includes(reservation?.status)
  ) {
    return SESSION_STATUS.ACTIVE;
  }
  if (schedule?.clinicDate === today || AT_CLINIC_STATUSES.includes(reservation?.status)) {
    return SESSION_STATUS.WAITING;
  }
  return SESSION_STATUS.UPCOMING;
}

function queueNumberOf(reservation) {
  return Number(reservation?.queueNumber || reservation?.originalQueueNumber) || Number.MAX_SAFE_INTEGER;
}

/** Sorts by date, then opening time, then STATUS_PRIORITY, then queue number. Returns a new array. */
export function sortSessions(sessions = []) {
  return [...sessions].sort((a, b) => {
    const dateA = a.schedule?.clinicDate || "";
    const dateB = b.schedule?.clinicDate || "";
    if (dateA !== dateB) return dateA < dateB ? -1 : 1;

    const timeA = minutesFromTime(a.schedule?.openingTime) ?? Number.MAX_SAFE_INTEGER;
    const timeB = minutesFromTime(b.schedule?.openingTime) ?? Number.MAX_SAFE_INTEGER;
    if (timeA !== timeB) return timeA - timeB;

    const rankA = STATUS_PRIORITY[a.status] ?? Number.MAX_SAFE_INTEGER;
    const rankB = STATUS_PRIORITY[b.status] ?? Number.MAX_SAFE_INTEGER;
    if (rankA !== rankB) return rankA - rankB;

    return queueNumberOf(a.reservation) - queueNumberOf(b.reservation);
  });
}

/**
 * The parent's upcoming or live sessions, sorted. Past, finished, completed and cancelled ones are excluded.
 * `today` is a Manila YYYY-MM-DD string and `nowMinutes` is minutes since Manila midnight.
 */
export function getUpcomingSessions(reservations = [], schedulesById = {}, { parentId, today, nowMinutes }) {
  const sessions = [];
  for (const reservation of reservations || []) {
    if (!reservation || reservation.parentId !== parentId) continue;
    if (!ACTIVE_RESERVATION_STATUSES.includes(reservation.status)) continue;

    const schedule = schedulesById?.[reservation.scheduleId];
    if (!schedule?.clinicDate || isScheduleFinished(schedule)) continue;
    if (schedule.clinicDate < today) continue;

    const queueLive = LIVE_QUEUE_STATUSES.includes(schedule.queueStatus);
    const close = minutesFromTime(schedule.closingTime);
    if (schedule.clinicDate === today && !queueLive && close != null && nowMinutes >= close) continue;

    sessions.push({
      reservation,
      schedule: { id: reservation.scheduleId, ...schedule },
      status: getSessionStatus(reservation, schedule, { today }),
    });
  }
  return sortSessions(sessions);
}

/** The single session the parent monitor should show: any active session first, else the earliest upcoming one. */
export function getCurrentSessionForParent(reservations, schedulesById, ctx) {
  const sessions = getUpcomingSessions(reservations, schedulesById, ctx);
  return sessions.find((session) => session.status === SESSION_STATUS.ACTIVE) || sessions[0] || null;
}
