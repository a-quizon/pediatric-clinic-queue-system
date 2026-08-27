const functions = require("firebase-functions/v1");
const admin = require("firebase-admin");
const { handleReservationChange, handleScheduleChange, sendPushToParent } = require("./pushRuntime");

// Initialize Firebase Admin SDK using default credentials in the Functions environment
admin.initializeApp();

function recordFromSnap(id, snap) {
  if (!snap.exists()) return null;
  return { id, ...snap.val() };
}

/**
 * Real-time reservation dispatcher. Sends Web Push even if the parent browser is closed.
 */
exports.onReservationWrite = functions.database
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
exports.onScheduleWrite = functions.database
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
 * Controlled Infrastructure Test: Verify RTDB Access
 * Reads a minimal non-sensitive piece of data to prove the Admin SDK successfully connected.
 */
exports.testRTDBAccess = functions.https.onCall(async (data, context) => {
  try {
    // Attempt to read the first schedule just to prove read access
    const schedulesRef = admin.database().ref("schedules");
    const snapshot = await schedulesRef.limitToFirst(1).once("value");
    
    return {
      success: true,
      message: "Successfully connected to Firebase RTDB.",
      dataFound: snapshot.exists(),
    };
  } catch (error) {
    console.error("RTDB Access Test Error:", error);
    throw new functions.https.HttpsError("internal", "Failed to connect to Firebase RTDB.");
  }
});

/**
 * Controlled Infrastructure Test: Verify Access to Parent Push Tokens and FCM Delivery
 * This is an explicit callable test function. It is NOT triggered by actual queue events.
 */
exports.testFCMDelivery = functions.https.onCall(async (data, context) => {
  const payload = data.data ? data.data : data;
  const parentId = payload.parentId;
  
  if (!parentId) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "The function must be called with a parentId."
    );
  }

  try {
    const webPushResult = await sendPushToParent(parentId, {
      title: "Pediatric Clinic Queue — Push Test",
      body: "This is a Web Push infrastructure test notification.",
      type: "INFO",
      url: "/parent/notifications",
      id: `push_test_${parentId}_${Date.now()}`,
    }, null);

    const tokensRef = admin.database().ref(`users/${parentId}/pushTokens`);
    const snapshot = await tokensRef.once("value");
    const tokens = [];
    const tokenKeys = [];

    if (snapshot.exists()) {
      Object.entries(snapshot.val()).forEach(([key, val]) => {
        if (val && val.token) {
          tokens.push(val.token);
          tokenKeys.push(key);
        }
      });
    }

    let fcmSuccess = 0;
    let fcmFailure = 0;
    let cleanupCount = 0;

    if (tokens.length > 0) {
      const multicast = {
        data: {
          title: "Pediatric Clinic Queue — Push Test",
          body: "This is a Web Push infrastructure test notification.",
        },
        tokens,
      };
      const response = await admin.messaging().sendEachForMulticast(multicast);
      fcmSuccess = response.successCount;
      fcmFailure = response.failureCount;

      if (response.failureCount > 0) {
        const tokensToRemove = {};
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            const errorCode = resp.error?.code;
            if (
              errorCode === "messaging/invalid-registration-token" ||
              errorCode === "messaging/registration-token-not-registered"
            ) {
              tokensToRemove[tokenKeys[idx]] = null;
              cleanupCount += 1;
            }
          }
        });
        if (Object.keys(tokensToRemove).length > 0) {
          await tokensRef.update(tokensToRemove);
        }
      }
    }

    return {
      success: true,
      message: `Push infrastructure test:\nParent UID: ${parentId}\nWeb Push sent: ${webPushResult.sent || 0}\nLegacy FCM tokens: ${tokens.length}`,
      tokensFound: tokens.length,
      webPushSent: webPushResult.sent || 0,
      successCount: fcmSuccess,
      failureCount: fcmFailure,
      cleanedUpCount: cleanupCount,
    };
  } catch (error) {
    console.error("FCM Delivery Test Error:", error);
    throw new functions.https.HttpsError("internal", error.message);
  }
});
