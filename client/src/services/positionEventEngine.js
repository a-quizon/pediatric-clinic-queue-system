import notificationService, { NOTIFICATION_EVENTS } from './notificationService';
import { computeReservationState, QUEUE_STATES } from './queueEngine';

/**
 * Position Event Engine
 * Evaluates live queue position changes and dispatches Position Events (ALMOST_NEXT, YOU_ARE_NEXT)
 * whenever any queue movement occurs by reading Queue State from the Queue Engine.
 */
export const evaluatePositionEvents = (allReservations = [], schedules = {}, user = null) => {
  if (!user || !user.uid) return;

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
