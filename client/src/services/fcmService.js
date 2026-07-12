// src/services/fcmService.js
import app from "../firebase/firebaseConfig";
import { database } from "../firebase/database";
import { ref, update } from "firebase/database";
import { getMessaging, getToken, isSupported } from "firebase/messaging";

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY || "BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U";

let messagingInstance = null;

/**
 * Helper for development logging
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

    // Check browser support
    if (typeof window === "undefined" || !("Notification" in window)) {
      debugLog("Browser does not support desktop/mobile notifications.");
      return null;
    }

    const supported = await isSupported().catch(() => false);
    if (!supported) {
      debugLog("Firebase Cloud Messaging is not supported in this browser environment.");
      return null;
    }

    // Request Notification Permission
    const permission = await Notification.requestPermission();
    debugLog("Notification permission status:", permission);

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

    // Initialize Messaging
    if (!messagingInstance) {
      messagingInstance = getMessaging(app);
    }

    // Generate Registration Token
    const token = await getToken(messagingInstance, {
      vapidKey: VAPID_KEY,
    }).catch((err) => {
      debugLog("Registration errors during token generation:", err.message || err);
      return null;
    });

    if (!token) {
      debugLog("FCM Registration Token generated as empty/null.");
      return null;
    }

    debugLog("FCM Registration Token generated successfully.");

    // Store token inside User entity
    await update(ref(database, `users/${user.uid}`), {
      notificationToken: token,
      notificationPermission: "granted",
      notificationTokenUpdatedAt: Date.now(),
    });

    debugLog("Token successfully saved to users/" + user.uid);
    return token;
  } catch (error) {
    debugLog("Registration errors caught in registerFcmTokenForParent:", error);
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
