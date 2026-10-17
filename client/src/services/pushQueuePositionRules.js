/**
 * Push / in-app queue-position notification rules.
 * Decoupled from SMS Near Turn (nearingTurnAheadCount). Keep in sync with
 * client/functions/pushQueuePositionRules.js
 */

export const WAITING_LINE_STATUSES = [
  "reserved",
  "waiting",
  "validation_open",
  "waiting_for_window",
  "checked_in",
];

/** 1-based waiting-line place → exact push / in-app body */
export const PUSH_QUEUE_POSITION_MESSAGES = {
  1: "You are next.",
  2: "Your Almost Next",
  3: "Your turn is near.",
};

/** Reuse existing event IDs for urgency / service worker handling */
export const PUSH_QUEUE_POSITION_EVENT_IDS = {
  1: "YOU_ARE_NEXT",
  2: "ALMOST_NEXT",
  3: "NEARING_TURN",
};

export const MAX_PUSH_QUEUE_POSITION = 3;

/**
 * 1-based place in the waiting line on the same schedule.
 * Excludes with_doctor / in_consultation and terminal statuses.
 * @returns {number|null}
 */
export function computeWaitingLinePosition(reservation, allReservations = []) {
  if (!reservation?.id || !reservation.scheduleId) return null;
  if (!WAITING_LINE_STATUSES.includes(reservation.status)) return null;

  const waitingLine = allReservations
    .filter(
      (item) =>
        item.scheduleId === reservation.scheduleId && WAITING_LINE_STATUSES.includes(item.status)
    )
    .sort((a, b) => (a.sortTimestamp || a.createdAt || 0) - (b.sortTimestamp || b.createdAt || 0));

  const index = waitingLine.findIndex((item) => item.id === reservation.id);
  if (index < 0) return null;
  return index + 1;
}

/**
 * @param {number} position 1-based waiting-line place
 * @returns {{ eventId: string, message: string, position: number }|null}
 */
export function getPushQueuePositionNotification(position) {
  const pos = Number(position);
  if (!Number.isInteger(pos) || pos < 1 || pos > MAX_PUSH_QUEUE_POSITION) return null;
  const message = PUSH_QUEUE_POSITION_MESSAGES[pos];
  const eventId = PUSH_QUEUE_POSITION_EVENT_IDS[pos];
  if (!message || !eventId) return null;
  return { eventId, message, position: pos };
}

/**
 * Once per reservation per position per clinic day.
 * @returns {string|null}
 */
export function buildPushQueuePositionDedupeKey(reservationId, position, clinicDate) {
  if (!reservationId || position == null) return null;
  const datePart = clinicDate != null && String(clinicDate).trim() !== "" ? String(clinicDate) : "unknown";
  return `push_queue_pos_${reservationId}_${position}_${datePart}`;
}
