import notificationService, { NOTIFICATION_EVENTS } from './notificationService';

/**
 * Position Event Engine
 * Evaluates live queue position changes and dispatches Position Events (ALMOST_NEXT, YOU_ARE_NEXT)
 * whenever any queue movement occurs.
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

    // Build remaining waiting queue sorted by current queue order
    const waitingLine = allReservations
      .filter(
        (item) =>
          item.scheduleId === r.scheduleId &&
          !['in_consultation', 'with_doctor', 'completed', 'consultation_completed', 'cancelled', 'forfeited'].includes(item.status)
      )
      .sort((a, b) => {
        const aNum = Number(a.queueNumber || a.queueOrder || 0);
        const bNum = Number(b.queueNumber || b.queueOrder || 0);
        if (aNum !== bNum) return aNum - bNum;
        return (a.sortTimestamp || a.createdAt || 0) - (b.sortTimestamp || b.createdAt || 0);
      });

    const myWaitingIndex = waitingLine.findIndex((item) => item.id === r.id);
    if (myWaitingIndex < 0) return;

    // Next eligible reservation awaiting QR validation / consultation (Index 0) -> YOU_ARE_NEXT
    if (myWaitingIndex === 0) {
      notificationService.notify(NOTIFICATION_EVENTS.YOU_ARE_NEXT, {
        entityId: r.id,
        parentId: r.parentId,
        dedupeKey: `you_are_next_${r.id}`,
      });
    }

    // Second in line awaiting QR validation / consultation (Index 1) -> ALMOST_NEXT
    if (myWaitingIndex === 1) {
      notificationService.notify(NOTIFICATION_EVENTS.ALMOST_NEXT, {
        entityId: r.id,
        parentId: r.parentId,
        dedupeKey: `almost_next_${r.id}`,
      });
    }
  });
};
