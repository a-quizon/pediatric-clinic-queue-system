// src/services/fcmService.js
import { database } from "../firebase/database";
import { ref, update } from "firebase/database";
import { getToken } from "firebase/messaging";
import {
  checkMessagingSupported,
  getMessagingInstance,
  VAPID_KEY,
} from "../firebase/messaging";

/**
 * Helper for development-only logging
 */
const debugLog = (message, ...args) => {
  if (import.meta.env.DEV) {
    console.log(`[FCM Setup] ${message}`, ...args);
  }
};

/**
 * Register a Parent user's device with Firebase Cloud Messaging.
 * Phase 2.2: Obtains FCM Registration Token and saves it under users/{uid}.
 * Does not send or connect push notifications yet.
 */
export const registerFcmTokenForParent = async (user) => {
  try {
    if (!user || !user.uid) return null;

    // Only Parent accounts should register for Push Notifications during this phase
    if (user.role !== "parent") {
      debugLog("Skipping FCM registration for non-parent role:", user.role);
      return null;
    }

    // Check browser support via dedicated messaging module
    const supported = await checkMessagingSupported();
    if (!supported) {
      debugLog("Registration failure: Browser does not support desktop/mobile notifications or Service Workers.");
      return null;
    }

    debugLog("✓ Browser supports FCM");

    // Request Notification Permission
    const permission = await Notification.requestPermission();
    debugLog("✓ Notification permission status:", permission);

    if (permission !== "granted") {
      // Denied or Default -> Continue using Toast Notifications only without blocking
      try {
        await update(ref(database, `users/${user.uid}`), {
          notificationPermission: permission,
          notificationTokenUpdatedAt: Date.now(),
        });
      } catch (e) {
        // Silently ignore storage error
      }
      return null;
    }

    if (!VAPID_KEY || VAPID_KEY === "PASTE_YOUR_PUBLIC_VAPID_KEY_HERE") {
      debugLog("Registration failure: VITE_FIREBASE_VAPID_KEY is not configured in .env.");
      return null;
    }

    // Step 4: Explicit Service Worker Registration
    let serviceWorkerRegistration;
    try {
      serviceWorkerRegistration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
      debugLog("✓ Service Worker registered:", serviceWorkerRegistration.scope);
    } catch (swError) {
      debugLog("Registration failure: Failed to register /firebase-messaging-sw.js:", swError.message || swError);
      return null;
    }

    // Initialize Messaging instance from dedicated module
    const messagingInstance = await getMessagingInstance();
    if (!messagingInstance) {
      debugLog("Registration failure: Failed to initialize Firebase Messaging instance.");
      return null;
    }

    // Generate Registration Token passing explicit serviceWorkerRegistration and VAPID Key
    const token = await getToken(messagingInstance, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration,
    }).catch((err) => {
      debugLog("Registration failure during token generation:", err.message || err);
      return null;
    });

    if (!token) {
      debugLog("Registration failure: FCM Registration Token generated as empty/null.");
      return null;
    }

    debugLog("✓ FCM Token generated successfully");

    // Store token inside User entity
    await update(ref(database, `users/${user.uid}`), {
      notificationToken: token,
      notificationPermission: "granted",
      notificationTokenUpdatedAt: Date.now(),
    });

    debugLog("✓ Token saved to Firebase under users/" + user.uid);
    return token;
  } catch (error) {
    debugLog("Registration failure caught in registerFcmTokenForParent:", error);
    // Do not crash the application. Toast Notifications and Notification Center continue working normally.
    return null;
  }
};

/**
 * Clean up FCM device registration upon user logout.
 */
export const cleanupFcmTokenOnLogout = async (user) => {
  try {
    if (!user || !user.uid || user.role !== "parent") return;
    debugLog("Cleaning up local FCM registration for user:", user.uid);
    await update(ref(database, `users/${user.uid}`), {
      notificationToken: null,
      notificationTokenUpdatedAt: Date.now(),
    });
  } catch (error) {
    debugLog("Error cleaning up FCM token on logout:", error);
  }
};
