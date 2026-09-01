const functions = require("firebase-functions/v1");
const admin = require("firebase-admin");
const { handleReservationChange, handleScheduleChange } = require("./pushRuntime");

const DATABASE_URL =
  process.env.RTDB_URL ||
  "https://pediatric-clinic-queue-testing-default-rtdb.asia-southeast1.firebasedatabase.app";

admin.initializeApp({ databaseURL: DATABASE_URL });

const rtdb = functions.region("asia-southeast1").database;

function recordFromSnap(id, snap) {
  if (!snap.exists()) return null;
  return { id, ...snap.val() };
}

/**
 * Real-time reservation dispatcher. Sends Web Push even if the parent browser is closed.
 */
exports.onReservationWrite = rtdb
  .ref("/reservations/{reservationId}")
  .onWrite(async (change, context) => {
    const id = context.params.reservationId;
    const before = recordFromSnap(id, change.before);
    const after = recordFromSnap(id, change.after);
    if (!after) return null;
    try {
      await handleReservationChange(before, after);
    } catch (err) {
      console.error("onReservationWrite failed:", err);
    }
    return null;
  });

/**
 * Real-time schedule dispatcher for publish / queue status events.
 */
exports.onScheduleWrite = rtdb
  .ref("/schedules/{scheduleId}")
  .onWrite(async (change, context) => {
    const id = context.params.scheduleId;
    const before = recordFromSnap(id, change.before);
    const after = recordFromSnap(id, change.after);
    if (!after) return null;
    try {
      await handleScheduleChange(before, after);
    } catch (err) {
      console.error("onScheduleWrite failed:", err);
    }
    return null;
  });

/**
 * Admin-only account deletion (Firebase Auth + RTDB profile).
 */
exports.deleteUserAccount = functions.region("asia-southeast1").https.onCall(async (data, context) => {
  const { deleteUserAccount } = require("./deleteUserAccountRuntime");
  try {
    const payload = data && typeof data === "object" && data.data && !data.uid ? data.data : data;
    const targetUid = payload?.uid;
    const callerUid = context?.auth?.uid || data?.auth?.uid;
    return await deleteUserAccount({ admin, callerUid, targetUid });
  } catch (err) {
    const code = err.code && typeof err.code === "string" && !String(err.code).startsWith("auth/")
      ? err.code
      : "internal";
    const allowed = new Set([
      "unauthenticated",
      "permission-denied",
      "invalid-argument",
      "failed-precondition",
      "not-found",
      "internal",
    ]);
    throw new functions.https.HttpsError(
      allowed.has(code) ? code : "internal",
      err.message || "Failed to delete user."
    );
  }
});
