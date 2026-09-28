const { databaseFor } = require("./rtdbRouter");
const { ACTIVE_STATUSES, TERMINAL_STATUSES, applyRelease } = require("./bookingHolders");

async function claimFlag(ref, flag) {
  const result = await ref.child(flag).transaction((current) => {
    if (current === true) return;
    return true;
  });
  return Boolean(result.committed && result.snapshot.val() === true);
}

function lockScheduleId(value) {
  if (value && typeof value === "object") return value.scheduleId || null;
  return value || null;
}

async function clearBookingLock(db, reservation) {
  if (!reservation?.parentId) return;
  let clinicDate = reservation.clinicDate;
  if (!clinicDate && reservation.scheduleId) {
    const snap = await db.ref(`schedules/${reservation.scheduleId}/clinicDate`).once("value");
    clinicDate = snap.val();
  }
  if (!clinicDate) return;
  const lockRef = db.ref(`bookingLocks/${reservation.parentId}/${clinicDate}`);
  const lock = await lockRef.once("value");
  const lockedSchedule = lockScheduleId(lock.val());
  if (lock.exists() && (!reservation.scheduleId || !lockedSchedule || lockedSchedule === reservation.scheduleId)) {
    await lockRef.remove();
  }
  try {
    const { releaseParentDateCap } = require("./parentBookingCap");
    await releaseParentDateCap(db, reservation.parentId, clinicDate);
  } catch (error) {
    console.error("clearBookingLock cap release failed:", error);
  }
}

/**
 * Frees the slot held by a terminal reservation. Safe to call any number of
 * times from any path (API, trigger, listener, scheduled job).
 * @returns {Promise<boolean>} true when the reservation is terminal and its slot is free
 */
async function releaseReservationSlot(db, reservationId, reservation) {
  if (!reservationId || !reservation?.scheduleId) return false;
  if (!TERMINAL_STATUSES.has(reservation.status)) return false;

  const bookingRef = db.ref(`schedules/${reservation.scheduleId}/booking`);
  const bookingSnap = await bookingRef.once("value");
  if (bookingSnap.exists()) {
    const booking = bookingSnap.val() || {};
    if (booking.holdersTracked) {
      await bookingRef.transaction((current) => applyRelease(current, reservationId));
    } else {
      const reservationRef = db.ref(`reservations/${reservationId}`);
      const flag = reservation.slotHeld ? "slotReleased" : "legacySlotReleased";
      if (!reservation[flag] && (await claimFlag(reservationRef, flag))) {
        await bookingRef.transaction((current) =>
          applyRelease(current, reservationId, { allowLegacyDecrement: true })
        );
      }
    }
  }
  await clearBookingLock(db, reservation);
  return true;
}

async function releaseSlotIfTerminal(admin, before, after) {
  if (!before || !after?.scheduleId) return;
  if (!ACTIVE_STATUSES.has(before.status) || !TERMINAL_STATUSES.has(after.status)) return;
  if (before.status === after.status) return;

  try {
    await releaseReservationSlot(databaseFor(admin), after.id, after);
  } catch (error) {
    console.error("releaseSlotIfTerminal failed:", error);
  }
}

function coded(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

const STAFF_ROLES = new Set(["doctor", "secretary", "admin"]);

/** API entry: the reservation owner or clinic staff can free a terminal reservation's slot. */
async function releaseReservationForCaller({ admin, callerUid, reservationId }) {
  if (!callerUid) throw coded("unauthenticated", "You must be signed in.");
  if (!reservationId) throw coded("invalid-argument", "Reservation is required.");
  const db = databaseFor(admin);
  const [userSnap, reservationSnap] = await Promise.all([
    db.ref(`users/${callerUid}`).once("value"),
    db.ref(`reservations/${reservationId}`).once("value"),
  ]);
  if (!userSnap.exists()) throw coded("permission-denied", "Account not found.");
  if (!reservationSnap.exists()) throw coded("not-found", "Reservation not found.");
  const user = userSnap.val() || {};
  const reservation = reservationSnap.val() || {};
  if (reservation.parentId !== callerUid && !STAFF_ROLES.has(user.role)) {
    throw coded("permission-denied", "You cannot release this reservation.");
  }
  if (!TERMINAL_STATUSES.has(reservation.status)) {
    throw coded("failed-precondition", "Only a cancelled, forfeited, or finished reservation frees its slot.");
  }
  await releaseReservationSlot(db, reservationId, reservation);
  return { released: true };
}

module.exports = {
  releaseSlotIfTerminal,
  releaseReservationSlot,
  releaseReservationForCaller,
  clearBookingLock,
};
