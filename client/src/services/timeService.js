import { ref, onValue } from "firebase/database";
import { database } from "../firebase/database";

let serverTimeOffset = 0;

// Subscribe to Firebase server time offset to ensure synchronized time across all devices
const offsetRef = ref(database, ".info/serverTimeOffset");
onValue(offsetRef, (snap) => {
  const offset = snap.val();
  if (typeof offset === "number") {
    serverTimeOffset = offset;
  }
});

/**
 * Returns current timestamp synchronized with Firebase server clock.
 */
export const getServerTime = () => {
  return Date.now() + serverTimeOffset;
};

/**
 * Calculates remaining validation window time in milliseconds for a schedule.
 * Returns 0 if expired or if validation window is not active.
 */
export const getRemainingValidationTime = (schedule) => {
  if (!schedule || schedule.queueStatus !== "active" || !schedule.queueStartedAt) {
    return 0;
  }
  const windowMs = (Number(schedule.validationWindow) || 15) * 60 * 1000;
  const expireTime = schedule.queueStartedAt + windowMs;
  const remaining = expireTime - getServerTime();
  return Math.max(0, remaining);
};

/**
 * Checks if an awaiting reservation's validation window has expired.
 * True if status is already terminal expired in DB, OR if live time exceeded the validation window.
 */
export const isReservationExpired = (reservation, schedule) => {
  if (!reservation) return false;
  if (reservation.status === "expired" || reservation.status === "validation_expired") {
    return true;
  }
  // If reservation is already validated, cancelled, completed, or in consultation, it is not expired
  if (["checked_in", "in_consultation", "consultation_completed", "completed", "cancelled", "forfeited", "penalized"].includes(reservation.status)) {
    return false;
  }
  // Only reservations awaiting check-in ('reserved' or 'waiting') can expire
  if (reservation.status === "reserved" || reservation.status === "waiting") {
    if (schedule && schedule.queueStatus === "active" && schedule.queueStartedAt) {
      const windowMs = (Number(schedule.validationWindow) || 15) * 60 * 1000;
      return getServerTime() > schedule.queueStartedAt + windowMs;
    }
  }
  return false;
};

/**
 * Formats remaining milliseconds into a clean string (e.g. "14m 32s" or "45s").
 */
export const formatRemainingTime = (ms) => {
  if (!ms || ms <= 0) return "0s";
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
};
