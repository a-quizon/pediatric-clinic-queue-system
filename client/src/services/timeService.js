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
 * Calculates remaining validation window time in milliseconds for a reservation.
 * Returns 0 if expired or if validation window is not active.
 */
export const getRemainingValidationTime = (reservation, schedule) => {
  return 0;
};

/**
 * Checks if an awaiting reservation has expired.
 * In the new workflow, QR codes do not expire over time.
 */
export const isReservationExpired = (reservation, schedule) => {
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
