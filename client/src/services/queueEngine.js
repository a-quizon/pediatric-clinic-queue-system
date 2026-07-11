/**
 * Queue Engine
 * Single Source of Truth for live queue state and relative queue positions across the system.
 * Every module (Notification Service, Real-Time Monitoring, Secretary Request Check-In, Status Badges)
 * consumes queue state from this engine.
 */

export const QUEUE_STATES = {
  YOU_ARE_NEXT: 'YOU_ARE_NEXT',
  ALMOST_NEXT: 'ALMOST_NEXT',
  WAITING: 'WAITING',
  CHECKED_IN: 'CHECKED_IN',
  WITH_DOCTOR: 'WITH_DOCTOR',
  COMPLETED: 'COMPLETED',
  FORFEITED: 'FORFEITED',
  CANCELLED: 'CANCELLED',
};

/**
 * Computes the live Queue State for a single reservation relative to all reservations in its schedule.
 */
export const computeReservationState = (reservation, allReservations = []) => {
  if (!reservation) return null;

  // Terminal / absolute states
  if (reservation.status === 'cancelled') {
    return QUEUE_STATES.CANCELLED;
  }
  if (['forfeited', 'penalized', 'late_limit_reached'].includes(reservation.status)) {
    return QUEUE_STATES.FORFEITED;
  }
  if (['completed', 'consultation_completed'].includes(reservation.status)) {
    return QUEUE_STATES.COMPLETED;
  }
  if (['with_doctor', 'in_consultation'].includes(reservation.status)) {
    return QUEUE_STATES.WITH_DOCTOR;
  }
  if (reservation.status === 'checked_in') {
    return QUEUE_STATES.CHECKED_IN;
  }

  // Active waiting reservations (awaiting arrival / validation)
  const activeWaiting = allReservations
    .filter(
      (item) =>
        item.scheduleId === reservation.scheduleId &&
        !['in_consultation', 'with_doctor', 'completed', 'consultation_completed', 'cancelled', 'forfeited', 'penalized', 'late_limit_reached', 'checked_in'].includes(item.status)
    )
    .sort((a, b) => {
      const aNum = Number(a.queueNumber || a.queueOrder || 0);
      const bNum = Number(b.queueNumber || b.queueOrder || 0);
      if (aNum !== bNum) return aNum - bNum;
      return (a.sortTimestamp || a.createdAt || 0) - (b.sortTimestamp || b.createdAt || 0);
    });

  const index = activeWaiting.findIndex((item) => item.id === reservation.id);
  if (index === 0) return QUEUE_STATES.YOU_ARE_NEXT;
  if (index === 1) return QUEUE_STATES.ALMOST_NEXT;
  return QUEUE_STATES.WAITING;
};

/**
 * Returns an enriched list of reservations where each reservation has a `.queueState` property.
 */
export const enrichReservationsWithState = (allReservations = []) => {
  return allReservations.map((r) => ({
    ...r,
    queueState: computeReservationState(r, allReservations),
  }));
};
