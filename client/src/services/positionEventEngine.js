import notificationService from './notificationService';
import {
  computeWaitingLinePosition,
  getPushQueuePositionNotification,
  buildPushQueuePositionDedupeKey,
} from './pushQueuePositionRules';

/**
 * Position Event Engine
 * Evaluates live waiting-line place and dispatches push/in-app position events
 * (positions 1–3 only) from the shared pushQueuePositionRules map.
 * SMS Near Turn is server/Functions-only and is not handled here.
 *
 * @param {object[]} allReservations
 * @param {object} schedules
 * @param {object|null} user
 */
export const evaluatePositionEvents = (
  allReservations = [],
  schedules = {},
  user = null
) => {
  if (!user || !user.uid) return;

  const myActiveReservations = allReservations.filter(
    (r) =>
      r.parentId === user.uid &&
      !['in_consultation', 'with_doctor', 'completed', 'consultation_completed', 'cancelled', 'forfeited'].includes(r.status)
  );

  myActiveReservations.forEach((r) => {
    const schedule = schedules[r.scheduleId];
    if (!schedule || !['active', 'paused', 'closed'].includes(schedule.queueStatus)) return;

    const waitingPosition = computeWaitingLinePosition(r, allReservations);
    const pushRule = getPushQueuePositionNotification(waitingPosition);
    if (!pushRule) return;

    const dedupeKey = buildPushQueuePositionDedupeKey(
      r.id,
      pushRule.position,
      schedule.clinicDate || null
    );

    notificationService.notify(pushRule.eventId, {
      entityId: r.id,
      parentId: r.parentId,
      dedupeKey,
      customMessage: pushRule.message,
      customTitle: pushRule.message,
    });
  });
};
