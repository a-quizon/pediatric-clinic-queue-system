const functions = require("firebase-functions");
const admin = require("firebase-admin");

// Initialize Firebase Admin SDK using default credentials in the Functions environment
admin.initializeApp();

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
    // 1. Locate the parent's pushTokens
    const tokensRef = admin.database().ref(`users/${parentId}/pushTokens`);
    const snapshot = await tokensRef.once("value");
    
    if (!snapshot.exists()) {
      return {
        success: true,
        message: `Push token infrastructure test:\nParent UID: ${parentId}\nRegistered device tokens: 0`,
        tokensFound: 0,
      };
    }

    const tokensData = snapshot.val();
    const tokens = [];
    const tokenKeys = []; // Track the RTDB key mapping for cleanup

    // Collect all registered device tokens safely
    Object.entries(tokensData).forEach(([key, val]) => {
      if (val && val.token) {
        tokens.push(val.token);
        tokenKeys.push(key);
      }
    });

    if (tokens.length === 0) {
      return {
        success: true,
        message: `Push token infrastructure test:\nParent UID: ${parentId}\nRegistered device tokens: 0`,
        tokensFound: 0,
      };
    }

    // 2. Send the controlled test notification using Firebase Admin Messaging
    const payload = {
      data: {
        title: "Pediatric Clinic Queue — Push Test",
        body: "This is a Web Push infrastructure test notification."
      },
      tokens: tokens,
    };

    const response = await admin.messaging().sendEachForMulticast(payload);
    let cleanupCount = 0;
    const errors = [];
    
    // 3. Safely remove explicitly invalid/unregistered tokens
    if (response.failureCount > 0) {
      const tokensToRemove = {};
      
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          const errorCode = resp.error?.code;
          
          errors.push({
            tokenKey: tokenKeys[idx],
            code: errorCode,
            message: resp.error?.message,
            errorInfoCode: resp.error?.errorInfo?.code
          });

          // Only remove tokens if FCM explicitly tells us they are invalid or unregistered
          if (
            errorCode === 'messaging/invalid-registration-token' ||
            errorCode === 'messaging/registration-token-not-registered'
          ) {
            const safeTokenKey = tokenKeys[idx];
            tokensToRemove[safeTokenKey] = null; // Setting to null deletes the node
            cleanupCount++;
          }
        }
      });
      
      if (Object.keys(tokensToRemove).length > 0) {
        await tokensRef.update(tokensToRemove);
      }
    }

    // 4. Return the safe test summary without exposing actual token strings
    return {
      success: true,
      message: `Push token infrastructure test:\nParent UID: ${parentId}\nRegistered device tokens: ${tokens.length}`,
      tokensFound: tokens.length,
      successCount: response.successCount,
      failureCount: response.failureCount,
      cleanedUpCount: cleanupCount,
      diagnosticErrors: errors,
    };

  } catch (error) {
    console.error("FCM Delivery Test Error:", error);
    throw new functions.https.HttpsError("internal", error.message);
  }
});
