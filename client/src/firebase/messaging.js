// src/firebase/messaging.js
import app from "./firebaseConfig";
import { getMessaging, isSupported } from "firebase/messaging";

export const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;

if (import.meta.env.DEV && (!VAPID_KEY || VAPID_KEY === "PASTE_YOUR_PUBLIC_VAPID_KEY_HERE")) {
  console.warn(
    "[Firebase Messaging] Warning: VITE_FIREBASE_VAPID_KEY is missing or is still placeholder in .env. Please configure a valid Firebase Web Push Public Key."
  );
}

let messagingInstance = null;

/**
 * Checks whether Firebase Cloud Messaging is supported in the current browser environment.
 */
export const checkMessagingSupported = async () => {
  if (typeof window === "undefined" || !("Notification" in window) || !("serviceWorker" in navigator)) {
    return false;
  }
  try {
    return await isSupported();
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn("[Firebase Messaging] isSupported check failed:", error);
    }
    return false;
  }
};

/**
 * Returns the initialized Firebase Messaging instance if supported.
 */
export const getMessagingInstance = async () => {
  const supported = await checkMessagingSupported();
  if (!supported) {
    return null;
  }
  if (!messagingInstance) {
    messagingInstance = getMessaging(app);
  }
  return messagingInstance;
};
