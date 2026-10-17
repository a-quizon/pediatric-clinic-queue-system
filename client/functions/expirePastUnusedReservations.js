/**
 * Soft-expire past unused reservations (never checked in) so they stop
 * holding schedule slots. Does not delete records.
 */
const { manilaDateString } = require("./manilaDate");
const { releaseReservationSlot } = require("./slotRelease");
const { recalculateEntireQueueAdmin } = require("./queueRuntime");

const UNUSED_ACTIVE_STATUSES = new Set([
  "reserved",
  "waiting",
  "validation_open",
  "waiting_for_window",
]);

const ATTENDED_STATUSES = new Set([
  "checked_in",
  "with_doctor",
  "in_consultation",
  "consultation_completed",
  "completed",
]);

function db() {
  return require("./rtdbRouter").getRtdb();
}

function wasAttended(reservation) {
  if (!reservation) return false;
  if (reservation.checkedIn === true) return true;
  return ATTENDED_STATUSES.has(reservation.status);
}

function isUnusedActive(reservation) {
  if (!reservation) return false;
  if (!UNUSED_ACTIVE_STATUSES.has(reservation.status)) return false;
  if (wasAttended(reservation)) return false;
  return true;
}

async function resolveClinicDate(reservation) {
  if (reservation?.clinicDate) return String(reservation.clinicDate);
  if (!reservation?.scheduleId) return null;
  const snap = await db().ref(`schedules/${reservation.scheduleId}/clinicDate`).once("value");
  return snap.val() ? String(snap.val()) : null;
}

function applyExpiredFields(current, now) {
  return {
    ...current,
    status: "expired",
    expiredAt: now,
    queueState: "EXPIRED",
    penaltyTimerExpiresAt: null,
    penaltyTimerStartedAt: null,
    becameCurrentTurnAt: null,
  };
}

/**
 * @param {{ today?: string }} [options]
 * @returns {Promise<{ expired: number, skipped: number }>}
 */
async function expirePastUnusedReservations(options = {}) {
  const today = options.today || manilaDateString();
  const snap = await db().ref("reservations").once("value");
  if (!snap.exists()) {
    return { expired: 0, skipped: 0 };
  }

  const scheduleIds = new Set();
  let expired = 0;
  let skipped = 0;
  const ids = [];
  snap.forEach((child) => {
    ids.push(child.key);
  });

  for (const id of ids) {
    const resSnap = await db().ref(`reservations/${id}`).once("value");
    if (!resSnap.exists()) {
      skipped += 1;
      continue;
    }
    const before = resSnap.val() || {};
    if (!isUnusedActive(before)) {
      skipped += 1;
      continue;
    }

    const clinicDate = await resolveClinicDate(before);
    if (!clinicDate || clinicDate >= today) {
      skipped += 1;
      continue;
    }

    const result = await db().ref(`reservations/${id}`).transaction((current) => {
      if (!current) return;
      if (!isUnusedActive(current)) return;
      return applyExpiredFields(current, Date.now());
    });

    if (!result.committed || !result.snapshot.exists()) {
      skipped += 1;
      continue;
    }
    const after = result.snapshot.val();
    if (after.status !== "expired") {
      skipped += 1;
      continue;
    }

    expired += 1;
    if (after.scheduleId) scheduleIds.add(after.scheduleId);
    try {
      await releaseReservationSlot(db(), id, after);
    } catch (err) {
      console.error(`expirePastUnusedReservations: slot release failed for ${id}`, err.message);
    }
  }

  for (const scheduleId of scheduleIds) {
    try {
      await recalculateEntireQueueAdmin(scheduleId);
    } catch (err) {
      console.error(`expirePastUnusedReservations: recalc failed for ${scheduleId}`, err.message);
    }
  }

  return { expired, skipped };
}

module.exports = {
  expirePastUnusedReservations,
  isUnusedActive,
  wasAttended,
  UNUSED_ACTIVE_STATUSES,
  applyExpiredFields,
};
