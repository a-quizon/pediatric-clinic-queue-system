import notificationService, { NOTIFICATION_EVENTS } from './notificationService';

/**
 * Position Event Engine
 * Evaluates live queue position changes and dispatches Position Events (NEAR_TURN, ALMOST_NEXT)
 * without coupling position calculations to the Notification Service itself.
 */
export const evaluatePositionEvents = (allReservations = [], schedules = {}, user = null) => {
  if (!user || !user.uid) return;

  // Filter only active reservations belonging to the current parent
  // Ignore completed, cancelled, forfeited, removed from queue
  const myActiveReservations = allReservations.filter(
    (r) =>
      r.parentId === user.uid &&
      ['reserved', 'waiting', 'checked_in', 'validation_open', 'waiting_for_window'].includes(r.status)
  );

  myActiveReservations.forEach((r) => {
    const schedule = schedules[r.scheduleId];
    // Only evaluate for started or active queue schedules
    if (!schedule || !['active', 'paused', 'closed'].includes(schedule.queueStatus)) return;

    // Build active pipeline ahead of this reservation
    const activeLine = allReservations
      .filter(
        (item) =>
          item.scheduleId === r.scheduleId &&
          ['reserved', 'waiting', 'checked_in', 'in_consultation', 'validation_open', 'waiting_for_window'].includes(item.status)
      )
      .sort((a, b) => {
        if (a.queueOrder !== undefined && b.queueOrder !== undefined) {
          return a.queueOrder - b.queueOrder;
        }
        return (a.sortTimestamp || a.createdAt || 0) - (b.sortTimestamp || b.createdAt || 0);
      });

    const myIndex = activeLine.findIndex((item) => item.id === r.id);
    if (myIndex < 0) return;

    const patientsAhead = myIndex;

    // Evaluate Queue Alert Threshold (<= 3 patients ahead, > 0)
    if (patientsAhead > 0 && patientsAhead <= 3) {
      notificationService.notify(NOTIFICATION_EVENTS.NEAR_TURN, {
        entityId: r.id,
        dedupeKey: `near_turn_${r.id}`,
      });
    }

    // Evaluate Almost Next Threshold (exactly 1 patient ahead)
    if (patientsAhead === 1) {
      notificationService.notify(NOTIFICATION_EVENTS.ALMOST_NEXT, {
        entityId: r.id,
        dedupeKey: `almost_next_${r.id}`,
      });
    }
  });
};
