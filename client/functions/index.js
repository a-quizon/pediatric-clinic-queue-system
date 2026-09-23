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
 * Hosting rewrite target for /api/** (SMS OTP, auth identifier resolve, password-reset claim).
 * Lazy-load Express app so deploy analysis stays under the load timeout.
 */
let apiApp;
exports.api = functions.region("asia-southeast1").https.onRequest((req, res) => {
  if (!apiApp) {
    apiApp = require("./apiApp").createApiApp();
  }
  return apiApp(req, res);
});

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
      const { releaseSlotIfTerminal } = require("./slotRelease");
      await releaseSlotIfTerminal(admin, before, after);
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
 * Auto-forfeit reservations whose late penalty timer has expired.
 */
exports.expirePenaltyTimers = functions
  .region("asia-southeast1")
  .pubsub.schedule("every 1 minutes")
  .timeZone("Asia/Manila")
  .onRun(async () => {
    const { expirePenaltyTimers } = require("./expirePenaltyTimers");
    try {
      const result = await expirePenaltyTimers();
      if (result.forfeited) {
        console.log(`expirePenaltyTimers forfeited ${result.forfeited} reservation(s)`);
      }
    } catch (err) {
      console.error("expirePenaltyTimers failed:", err);
    }
    return null;
  });

/**
 * Transactional slot claim. Clients cannot create reservations directly.
 */
exports.claimReservationSlot = functions.region("asia-southeast1").https.onCall(async (data, context) => {
  const { claimReservationSlot } = require("./claimReservationRuntime");
  try {
    const payload = data && typeof data === "object" && data.data && !data.scheduleId && !data.mode ? data.data : data;
    const callerUid = context?.auth?.uid || data?.auth?.uid;
    return await claimReservationSlot({ admin, callerUid, payload });
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
      err.message || "Could not reserve a slot."
    );
  }
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
