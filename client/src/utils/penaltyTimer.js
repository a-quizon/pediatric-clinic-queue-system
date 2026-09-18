export const UNCHECKED_WAITING_STATUSES = [
  "reserved",
  "waiting",
  "validation_open",
  "waiting_for_window",
];

export const LIVE_QUEUE_STATUSES = ["active", "paused", "closed"];

export const WALK_IN_PENALIZE_STATUSES = ["checked_in", "reserved", "waiting"];

export const isUncheckedWaitingStatus = (status) =>
  UNCHECKED_WAITING_STATUSES.includes(status);

export const isLiveQueueStatus = (queueStatus) =>
  LIVE_QUEUE_STATUSES.includes(queueStatus);

export const isWalkInReservation = (reservation) => reservation?.source === "walk_in";

export const canExpirePenaltyTimer = (reservation) => {
  if (!reservation) return false;
  if (isUncheckedWaitingStatus(reservation.status)) return true;
  return isWalkInReservation(reservation) && WALK_IN_PENALIZE_STATUSES.includes(reservation.status);
};

export const getPenaltyTimerRemainingMs = (reservation, now = Date.now()) => {
  const expiresAt = Number(reservation?.penaltyTimerExpiresAt) || 0;
  if (!expiresAt) return 0;
  return Math.max(0, expiresAt - now);
};

export const hasActivePenaltyTimer = (reservation, now = Date.now()) =>
  canExpirePenaltyTimer(reservation) && getPenaltyTimerRemainingMs(reservation, now) > 0;

export const remainingPenaltyMinutes = (expiresAt, now = Date.now()) => {
  const ms = Number(expiresAt) - now;
  if (!Number.isFinite(ms) || ms <= 0) return 1;
  return Math.max(1, Math.ceil(ms / 60000));
};

export const getPenaltyGraceRemainingMs = (reservation, graceMinutes, now = Date.now()) => {
  const startedAt = Number(reservation?.becameCurrentTurnAt) || 0;
  if (!startedAt) return null;
  const graceMs = Math.max(0, Number(graceMinutes) || 0) * 60 * 1000;
  return Math.max(0, startedAt + graceMs - now);
};

export const isPenaltyGraceElapsed = (reservation, graceMinutes, now = Date.now()) => {
  const remaining = getPenaltyGraceRemainingMs(reservation, graceMinutes, now);
  if (remaining === null) return false;
  return remaining <= 0;
};

export const PENALTY_TIMER_FORFEIT_REASON =
  "Did not check in before the late penalty timer expired.";
