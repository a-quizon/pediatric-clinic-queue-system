import notificationService, { NOTIFICATION_EVENTS } from './notificationService';
import { computeReservationState, computeAheadOfYou, QUEUE_STATES } from './queueEngine';
import {
  DEFAULT_NEARING_TURN_AHEAD,
  buildNearingTurnPushMessage,
} from './systemConfigurationService';

/**
 * Position Event Engine
 * Evaluates live queue position changes and dispatches Position Events
 * (NEARING_TURN, ALMOST_NEXT, YOU_ARE_NEXT) from Queue Engine state.
 *
 * @param {object[]} allReservations
 * @param {object} schedules
 * @param {object|null} user
 * @param {{ nearingTurnAheadCount?: number }} [options]
 */
export const evaluatePositionEvents = (
  allReservations = [],
  schedules = {},
  user = null,
  options = {}
) => {
  if (!user || !user.uid) return;

  const nearingTurnAheadCount = Number.isInteger(options.nearingTurnAheadCount)
    ? options.nearingTurnAheadCount
    : DEFAULT_NEARING_TURN_AHEAD;

  // Filter active reservations belonging to the current parent
  const myActiveReservations = allReservations.filter(
    (r) =>
      r.parentId === user.uid &&
      !['in_consultation', 'with_doctor', 'completed', 'consultation_completed', 'cancelled', 'forfeited'].includes(r.status)
  );

  myActiveReservations.forEach((r) => {
    const schedule = schedules[r.scheduleId];
    if (!schedule || !['active', 'paused', 'closed'].includes(schedule.queueStatus)) return;

    // Consume Queue State from Queue Engine (Single Source of Truth)
    const queueState = computeReservationState(r, allReservations);
    const aheadOfYou = r.aheadOfYou != null ? Number(r.aheadOfYou) : computeAheadOfYou(r, allReservations);

    if (aheadOfYou === nearingTurnAheadCount) {
      notificationService.notify(NOTIFICATION_EVENTS.NEARING_TURN, {
        entityId: r.id,
        parentId: r.parentId,
        dedupeKey: `nearing_turn_${r.id}`,
        customMessage: buildNearingTurnPushMessage(nearingTurnAheadCount),
      });
    }

    if (queueState === QUEUE_STATES.YOU_ARE_NEXT) {
      notificationService.notify(NOTIFICATION_EVENTS.YOU_ARE_NEXT, {
        entityId: r.id,
        parentId: r.parentId,
        dedupeKey: `you_are_next_${r.id}`,
      });
    } else if (queueState === QUEUE_STATES.ALMOST_NEXT) {
      notificationService.notify(NOTIFICATION_EVENTS.ALMOST_NEXT, {
        entityId: r.id,
        parentId: r.parentId,
        dedupeKey: `almost_next_${r.id}`,
      });
    }
  });
};
