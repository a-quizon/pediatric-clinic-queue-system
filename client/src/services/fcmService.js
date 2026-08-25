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
      // Idempotency check: if the database already matches the permission status, skip the write
      if (user.notificationPermission === permission) {
        debugLog(`✓ Notification permission is already ${permission}, skipping database write.`);
        return null;
      }

      // Denied or Default -> Continue using Toast Notifications only without blocking
      try {
        await update(ref(database, `users/${user.uid}`), {
          notificationPermission: permission,
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
      const swConfigStr = encodeURIComponent(JSON.stringify({
        apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
        authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
        projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
        databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
        storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
        appId: import.meta.env.VITE_FIREBASE_APP_ID
      }));
      serviceWorkerRegistration = await navigator.serviceWorker.register(`/firebase-messaging-sw.js?firebaseConfig=${swConfigStr}`);
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

    // Sanitize token for use as a Firebase Realtime Database key
    // RTDB keys cannot contain '.', '#', '$', '[', or ']'
    const safeTokenKey = token.replace(/[.#$\[\]]/g, '_');

    // Store token inside User entity under a multi-device schema
    // We retain the old `notificationToken` field untouched to avoid breaking legacy dependencies.
    await update(ref(database, `users/${user.uid}/pushTokens/${safeTokenKey}`), {
      token: token,
      userAgent: navigator.userAgent,
      createdAt: Date.now(),
    });
    
    // Save the active token key to local storage so we know which one to delete on logout for this specific device
    localStorage.setItem(`fcm_token_key_${user.uid}`, safeTokenKey);

    // Also update permission status
    await update(ref(database, `users/${user.uid}`), {
      notificationPermission: "granted",
    });

    debugLog("✓ Token saved to Firebase under pushTokens/" + safeTokenKey);
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
    
    const localTokenKey = localStorage.getItem(`fcm_token_key_${user.uid}`);
    if (localTokenKey) {
      debugLog("Cleaning up local FCM registration for user device:", localTokenKey);
      await update(ref(database, `users/${user.uid}/pushTokens`), {
        [localTokenKey]: null,
      });
      localStorage.removeItem(`fcm_token_key_${user.uid}`);
    } else {
      debugLog("No local FCM token key found to clean up on this device.");
    }
  } catch (error) {
    debugLog("Error cleaning up FCM token on logout:", error);
  }
};
