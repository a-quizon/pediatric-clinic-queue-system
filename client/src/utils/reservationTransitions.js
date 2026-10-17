/**
 * Pure reservation lifecycle guards (C4). Safe to unit-test without Firebase.
 */

export const TERMINAL_RESERVATION_STATUSES = Object.freeze([
  "cancelled",
  "cancelled_by_clinic",
  "forfeited",
  "consultation_completed",
  "completed",
  "expired",
  "validation_expired",
  "penalized",
  "late_limit_reached",
]);

export const PARENT_CANCELLABLE_STATUSES = Object.freeze(["reserved", "waiting"]);

export const CHECK_IN_ALLOWED_STATUSES = Object.freeze([
  "reserved",
  "waiting",
  "validation_open",
  "waiting_for_window",
]);

export const SEND_TO_DOCTOR_ALLOWED_STATUSES = Object.freeze(["checked_in"]);

export const COMPLETE_CONSULTATION_ALLOWED_STATUSES = Object.freeze([
  "with_doctor",
  "in_consultation",
]);

export const PATIENT_INFO_EDITABLE_STATUSES = Object.freeze([
  "reserved",
  "waiting",
  "checked_in",
  "validation_open",
  "waiting_for_window",
]);

export const STAFF_WALK_IN_CANCELLABLE_STATUSES = Object.freeze([
  "reserved",
  "waiting",
  "checked_in",
  "validation_open",
  "waiting_for_window",
]);

export function isTerminalReservationStatus(status) {
  return TERMINAL_RESERVATION_STATUSES.includes(status);
}

/**
 * @param {object|null} reservation
 * @param {{ actorUid?: string|null, actorRole?: string|null }} actor
 * @returns {{ ok: true } | { ok: false, message: string }}
 */
export function assertCanCancelReservation(reservation, actor = {}) {
  if (!reservation) {
    return { ok: false, message: "Reservation not found." };
  }
  if (isTerminalReservationStatus(reservation.status)) {
    return { ok: false, message: "This reservation is already closed." };
  }

  const role = actor.actorRole || null;
  const uid = actor.actorUid || null;
  const isStaff = role === "secretary" || role === "doctor";
  const isWalkIn = reservation.source === "walk_in";

  if (isStaff && isWalkIn) {
    if (!STAFF_WALK_IN_CANCELLABLE_STATUSES.includes(reservation.status)) {
      return { ok: false, message: "This walk-in can no longer be cancelled." };
    }
    return { ok: true };
  }

  if (isStaff && PARENT_CANCELLABLE_STATUSES.includes(reservation.status)) {
    return { ok: true };
  }

  // Parent (default) path
  if (uid && reservation.parentId && reservation.parentId !== uid) {
    return { ok: false, message: "You can only cancel your own reservation." };
  }
  if (!PARENT_CANCELLABLE_STATUSES.includes(reservation.status)) {
    return { ok: false, message: "You cannot cancel after check-in." };
  }
  return { ok: true };
}

/**
 * Human-readable reason a status cannot move to checked_in.
 * Used by assertCanCheckIn and by the status-path CAS in checkInReservation.
 */
export function checkInBlockedMessage(status, { checkedIn = false } = {}) {
  if (status == null && !checkedIn) {
    return "Reservation not found.";
  }
  if (status === "checked_in" || checkedIn) {
    return "This reservation is already checked in.";
  }
  if (status === "with_doctor" || status === "in_consultation") {
    return "This patient is already with the doctor.";
  }
  if (status === "cancelled" || status === "cancelled_by_clinic") {
    return "This reservation was cancelled.";
  }
  if (status === "forfeited" || status === "penalized" || status === "late_limit_reached") {
    return "This reservation was forfeited.";
  }
  if (status === "expired" || status === "validation_expired") {
    return "This reservation has expired.";
  }
  if (status === "completed" || status === "consultation_completed") {
    return "This reservation is already completed.";
  }
  if (!CHECK_IN_ALLOWED_STATUSES.includes(status)) {
    return "This reservation cannot be checked in.";
  }
  return null;
}

/**
 * Pure status CAS for check-in. Safe to unit-test without Firebase.
 * @param {string|null|undefined} currentStatus
 * @returns {{ ok: true, nextStatus: "checked_in" } | { ok: false, message: string }}
 */
export function applyCheckInStatusTransition(currentStatus) {
  if (currentStatus === "checked_in") {
    return { ok: false, message: "This reservation is already checked in." };
  }
  if (CHECK_IN_ALLOWED_STATUSES.includes(currentStatus)) {
    return { ok: true, nextStatus: "checked_in" };
  }
  const message = checkInBlockedMessage(currentStatus) || "This reservation cannot be checked in.";
  return { ok: false, message };
}

export function assertCanCheckIn(reservation) {
  if (!reservation) return { ok: false, message: "Reservation not found." };
  if (reservation.status === "checked_in" || reservation.checkedIn) {
    return { ok: false, message: "This reservation is already checked in." };
  }
  const blocked = checkInBlockedMessage(reservation.status, { checkedIn: Boolean(reservation.checkedIn) });
  if (blocked) return { ok: false, message: blocked };
  return { ok: true };
}

export function assertCanSendToDoctor(reservation) {
  if (!reservation) return { ok: false, message: "Reservation not found." };
  if (!SEND_TO_DOCTOR_ALLOWED_STATUSES.includes(reservation.status)) {
    return { ok: false, message: "Patient must be checked in before being sent to the doctor." };
  }
  return { ok: true };
}

export function assertCanStartConsultation(reservation) {
  if (!reservation) return { ok: false, message: "Reservation not found." };
  if (!["checked_in", "with_doctor"].includes(reservation.status)) {
    return { ok: false, message: "Consultation can only start for a checked-in patient." };
  }
  return { ok: true };
}

export function assertCanCompleteConsultation(reservation) {
  if (!reservation) return { ok: false, message: "Reservation not found." };
  if (!COMPLETE_CONSULTATION_ALLOWED_STATUSES.includes(reservation.status)) {
    return { ok: false, message: "Only an active consultation can be completed." };
  }
  return { ok: true };
}

export function assertCanUpdatePatientInfo(reservation, actor = {}) {
  if (!reservation) return { ok: false, message: "Reservation not found." };
  if (isTerminalReservationStatus(reservation.status)) {
    return { ok: false, message: "Patient information cannot be edited on a closed reservation." };
  }
  const uid = actor.actorUid || null;
  if (uid && reservation.parentId && reservation.parentId !== uid) {
    return { ok: false, message: "You can only update your own reservation." };
  }
  if (!PATIENT_INFO_EDITABLE_STATUSES.includes(reservation.status)) {
    return { ok: false, message: "Patient information can no longer be edited." };
  }
  return { ok: true };
}
