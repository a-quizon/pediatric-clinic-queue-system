/**
 * Centralized Queue Eligibility Engine
 * 
 * This service is the single source of truth for determining consultation eligibility,
 * queue priority order, and contextual waiting messages.
 * 
 * Future states such as Penalty, Grace Period, Skipped, Forfeited, and No Show
 * can be configured here without modifying Doctor, Secretary, or Parent UI components.
 */

// Statuses that hold a queue position and block subsequent queue numbers from advancing
export const BLOCKING_STATUSES = [
  'reserved',
  'checked_in',
];

// Statuses that do NOT block subsequent queue numbers
export const NON_BLOCKING_STATUSES = [
  'consultation_completed',
  'completed',
  'cancelled',
  'in_consultation',
  'with_doctor',
  'penalized',
  'late_limit_reached',
];

/**
 * Determine the next eligible patient for consultation.
 * 
 * A patient becomes eligible ONLY IF:
 * 1. The patient is Checked In ('checked_in')
 * AND
 * 2. There is NO earlier Queue Number waiting ahead of them (in BLOCKING_STATUSES)
 * AND
 * 3. There is NO ongoing consultation ('in_consultation')
 * 
 * @param {Array} reservations - All reservations for the active schedule
 * @returns {Object} { eligible, patient, blocked, reason, waitingMessage, empty }
 */
export const getNextEligiblePatient = (reservations = []) => {
  if (!reservations || !Array.isArray(reservations) || reservations.length === 0) {
    return {
      eligible: false,
      blocked: false,
      empty: true,
      waitingMessage: 'Queue is currently empty.'
    };
  }

  // 1. Check if there is currently an ongoing consultation
  const inConsultation = reservations.find(r => r.status === 'in_consultation' || r.status === 'with_doctor');
  if (inConsultation) {
    return {
      eligible: false,
      blocked: true,
      reason: 'in_consultation',
      waitingMessage: 'Waiting for the current consultation to be completed.'
    };
  }

  // 2. Filter reservations that are waiting in line (blocking statuses)
  const activeQueue = reservations
    .filter(r => BLOCKING_STATUSES.includes(r.status))
    .sort((a, b) => (a.queuePosition || 999) - (b.queuePosition || 999));

  if (activeQueue.length === 0) {
    return {
      eligible: false,
      blocked: false,
      empty: true,
      waitingMessage: 'Queue is currently empty.'
    };
  }

  // 3. The earliest patient in line has priority
  const firstInLine = activeQueue[0];

  // 4. Check if the earliest patient is checked in
  if (firstInLine.status === 'checked_in') {
    return {
      eligible: true,
      patient: firstInLine,
      blocked: false,
      waitingMessage: null
    };
  }

  // 5. If the earliest patient is NOT checked in (e.g., reserved or waiting validation),
  // they block all subsequent queue numbers from advancing.
  return {
    eligible: false,
    blocked: true,
    reason: 'earlier_queue_waiting',
    waitingMessage: `Waiting for Queue #${firstInLine.queuePosition || 'N/A'} to check in at the clinic.`
  };
};

/**
 * Determine whether a specific reservation is eligible for consultation.
 * 
 * @param {Object} reservation - The reservation object to check
 * @param {Array} reservations - All reservations for the schedule
 * @returns {boolean} True if the reservation is currently eligible to start consultation
 */
export const isPatientEligible = (reservation, reservations = []) => {
  if (!reservation || reservation.status !== 'checked_in') return false;
  const next = getNextEligiblePatient(reservations);
  return next.eligible && next.patient && next.patient.id === reservation.id;
};

/**
 * Return the contextual waiting message for the current queue state.
 * 
 * @param {Array} reservations - All reservations for the schedule
 * @returns {string|null} The waiting message string, or null if a patient is eligible
 */
export const getQueueWaitingMessage = (reservations = []) => {
  const next = getNextEligiblePatient(reservations);
  if (next.eligible) return null;
  return next.waitingMessage || 'Waiting for the next patient to check in.';
};
