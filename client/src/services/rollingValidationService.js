import { database } from "../firebase/database";
import { ref, get, update, serverTimestamp } from "firebase/database";

// Blocking statuses that occupy a slot in the active queue line before consultation
const ACTIVE_PIPELINE_STATUSES = [
  "reserved",
  "waiting",
  "waiting_for_window",
  "validation_open",
  "checked_in"
];

/**
 * Recalculates the Rolling Validation Window for a given schedule.
 * Scans the ordered queue and ensures the first N waiting reservations are 'validation_open'
 * with a timestamp, and remaining waiting reservations are 'waiting_for_window'.
 * 
 * @param {string} scheduleId 
 */
export const recalculateRollingValidation = async (scheduleId) => {
  if (!scheduleId) return;

  try {
    const [scheduleSnap, resSnap] = await Promise.all([
      get(ref(database, `schedules/${scheduleId}`)),
      get(ref(database, "reservations"))
    ]);

    if (!scheduleSnap.exists() || !resSnap.exists()) return;

    const schedule = scheduleSnap.val();
    // Only open rolling validation windows if the queue is active or closed (existing reservations can still validate)
    if (schedule.queueStatus !== "active" && schedule.queueStatus !== "paused" && schedule.queueStatus !== "closed") {
      return;
    }

    const allReservations = Object.entries(resSnap.val())
      .map(([id, val]) => ({ id, ...val }))
      .filter(r => r.scheduleId === scheduleId);

    const activePipeline = allReservations
      .filter(r => ACTIVE_PIPELINE_STATUSES.includes(r.status))
      .sort((a, b) => {
        const posA = a.queuePosition !== undefined ? a.queuePosition : 999;
        const posB = b.queuePosition !== undefined ? b.queuePosition : 999;
        if (posA !== posB) return posA - posB;
        return (a.createdAt || 0) - (b.createdAt || 0);
      });

    const N = Number(schedule.activeValidationQueue) || 3;
    const updates = {};

    activePipeline.forEach((res, index) => {
      if (index < N) {
        // Inside active validation queue
        if (res.status !== "checked_in") {
          if (res.status !== "validation_open" || !res.validationWindowOpenedAt) {
            updates[`reservations/${res.id}/status`] = "validation_open";
            if (!res.validationWindowOpenedAt) {
              updates[`reservations/${res.id}/validationWindowOpenedAt`] = Date.now();
            }
          }
        }
      } else {
        // Outside active validation queue (waiting at home)
        if (res.status !== "checked_in") {
          if (res.status !== "waiting_for_window") {
            updates[`reservations/${res.id}/status`] = "waiting_for_window";
          }
        }
      }
    });

    if (Object.keys(updates).length > 0) {
      await update(ref(database), updates);
    }
  } catch (err) {
    console.error("Error recalculating rolling validation window:", err);
  }
};

/**
 * Synchronous helper to determine the rolling validation status of a reservation
 * based on live queue data.
 * 
 * @param {Object} reservation 
 * @param {Object} schedule 
 * @param {Array} allScheduleReservations 
 * @returns {string} Effective status
 */
export const getEffectiveReservationStatus = (reservation, schedule, allScheduleReservations = []) => {
  if (!reservation) return null;
  if (!schedule) return reservation.status;

  if (["checked_in", "in_consultation", "consultation_completed", "completed", "cancelled", "expired", "validation_expired", "forfeited", "penalized"].includes(reservation.status)) {
    return reservation.status;
  }

  if (schedule.queueStatus === "not_started") {
    return "reserved";
  }

  const activePipeline = allScheduleReservations
    .filter(r => r.scheduleId === schedule.id && ACTIVE_PIPELINE_STATUSES.includes(r.status))
    .sort((a, b) => {
      const posA = a.queuePosition !== undefined ? a.queuePosition : 999;
      const posB = b.queuePosition !== undefined ? b.queuePosition : 999;
      if (posA !== posB) return posA - posB;
      return (a.createdAt || 0) - (b.createdAt || 0);
    });

  const index = activePipeline.findIndex(r => r.id === reservation.id);
  const N = Number(schedule.activeValidationQueue) || 3;

  if (index >= 0 && index < N) {
    return "validation_open";
  }
  if (index >= N) {
    return "waiting_for_window";
  }

  return reservation.status;
};

/**
 * Calculates how many queue numbers are ahead before this reservation's validation window opens.
 * Returns null if the window is already open or reservation is not waiting.
 * 
 * @param {Object} reservation 
 * @param {Object} schedule 
 * @param {Array} allScheduleReservations 
 * @returns {number|null}
 */
export const getNumbersAheadForWindow = (reservation, schedule, allScheduleReservations = []) => {
  if (!reservation || !schedule) return null;
  
  if (["checked_in", "in_consultation", "consultation_completed", "completed", "cancelled", "expired", "validation_expired"].includes(reservation.status)) {
    return null;
  }

  const activePipeline = allScheduleReservations
    .filter(r => r.scheduleId === schedule.id && ACTIVE_PIPELINE_STATUSES.includes(r.status))
    .sort((a, b) => {
      const posA = a.queuePosition !== undefined ? a.queuePosition : 999;
      const posB = b.queuePosition !== undefined ? b.queuePosition : 999;
      if (posA !== posB) return posA - posB;
      return (a.createdAt || 0) - (b.createdAt || 0);
    });

  const index = activePipeline.findIndex(r => r.id === reservation.id);
  const N = Number(schedule.activeValidationQueue) || 3;

  if (index >= N) {
    return index - N + 1;
  }

  return null;
};
