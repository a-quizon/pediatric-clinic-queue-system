import { Capacitor } from "@capacitor/core";
import { auth } from "../firebase/auth";
import { ref, update } from "firebase/database";
import { database } from "../firebase/database";
import { hasNativeNotificationPermission, requestNativeNotificationPermission } from "./nativeNotificationService";
const SW_PATH = "/sw.js";
const LEGACY_SW_PATH = "firebase-messaging-sw.js";
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || "";

const debugLog = (message, ...args) => {
  if (import.meta.env.DEV || Capacitor.isNativePlatform()) {
    console.log(`[Push] ${message}`, ...args);
  }
};

export function isNativeApp() {
  return Capacitor.isNativePlatform();
}

export function getPushApiBase() {
  const explicit = import.meta.env.VITE_API_URL;
  if (typeof explicit === "string" && explicit.trim()) {
    return explicit.replace(/\/$/, "");
  }
  return "";
}

export function isSecurePushContext() {
  if (typeof window === "undefined") return false;
  return window.isSecureContext || window.location.hostname === "localhost";
}

export function checkPushSupport() {
  if (typeof window === "undefined") return false;
  if (Capacitor.isNativePlatform()) return true;
  if (!isSecurePushContext()) return false;
  if (!("serviceWorker" in navigator)) return false;
  if (!("PushManager" in window)) return false;
  if (!("Notification" in window)) return false;
  return true;
}

export async function hasActivePushSubscription(uid) {
  if (Capacitor.isNativePlatform()) {
    return hasNativeNotificationPermission();
  }
  if (!uid || !checkPushSupport()) return false;
  if (localStorage.getItem(localSubKeyName(uid))) return true;
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    return Boolean(subscription);
  } catch (_err) {
    return false;
  }
}

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

async function sha256Hex(value) {
  const encoded = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function localSubKeyName(uid) {
  return `push_sub_key_${uid}`;
}

async function unregisterLegacyMessagingWorker() {
  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(
    registrations.map(async (registration) => {
      const scriptUrl = registration.active?.scriptURL || registration.installing?.scriptURL || registration.waiting?.scriptURL || "";
      if (scriptUrl.includes(LEGACY_SW_PATH)) {
        debugLog("Unregistering legacy Firebase messaging SW");
        await registration.unregister();
      }
    })
  );
}

export async function registerPushServiceWorker() {
  if (!checkPushSupport()) {
    throw new Error("Push notifications are not supported in this browser.");
  }

  await unregisterLegacyMessagingWorker();

  const registration = await navigator.serviceWorker.register(SW_PATH, { scope: "/" });
  await navigator.serviceWorker.ready;
  debugLog("Service worker registered", registration.scope);
  return registration;
}

async function getAuthHeaders() {
  const currentUser = auth.currentUser;
  if (!currentUser) return {};
  try {
    const token = await currentUser.getIdToken();
    return { Authorization: `Bearer ${token}` };
  } catch (err) {
    debugLog("Failed to get ID token", err);
    return {};
  }
}

async function postSubscriptionToBackend(userId, subscription, action = "save") {
  const path = action === "delete" ? "/api/delete-subscription" : "/api/save-subscription";
  const url = `${getPushApiBase()}${path}`;
  const headers = {
    "Content-Type": "application/json",
    ...(await getAuthHeaders()),
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        userId,
        subscription,
      }),
    });
    if (!response.ok) {
      debugLog(`Backend ${action} subscription failed`, response.status);
      return false;
    }
    return true;
  } catch (err) {
    debugLog(`Backend ${action} subscription unreachable`, err);
    return false;
  }
}

async function persistSubscriptionToDatabase(uid, subscriptionJson, extra = {}) {
  const key = await sha256Hex(subscriptionJson.endpoint);
  if (localStorage.getItem(localSubKeyName(uid)) === key) {
    return key;
  }
  await update(ref(database, `users/${uid}/pushSubscriptions/${key}`), {
    endpoint: subscriptionJson.endpoint,
    expirationTime: subscriptionJson.expirationTime || null,
    keys: subscriptionJson.keys || null,
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
    updatedAt: Date.now(),
    createdAt: extra.createdAt || Date.now(),
  });
  await update(ref(database, `users/${uid}`), {
    notificationPermission: "granted",
    notificationTokenUpdatedAt: Date.now(),
  });
  localStorage.setItem(localSubKeyName(uid), key);
  return key;
}

async function removeSubscriptionFromDatabase(uid, subscriptionJson) {
  const storedKey = localStorage.getItem(localSubKeyName(uid));
  const key = storedKey || (subscriptionJson?.endpoint ? await sha256Hex(subscriptionJson.endpoint) : null);
  if (!key) return;
  await update(ref(database, `users/${uid}/pushSubscriptions`), {
    [key]: null,
  });
  localStorage.removeItem(localSubKeyName(uid));
  localStorage.removeItem(`fcm_token_key_${uid}`);
}

/**
 * Request permission (must be called from a user gesture), subscribe with VAPID,
 * and persist the subscription to RTDB + the Express backend.
 */
export async function registerPushSubscription(user) {
  try {
    if (!user?.uid) return null;
    if (user.role && user.role !== "parent") {
      debugLog("Skipping push registration for non-parent role:", user.role);
      return null;
    }

    if (Capacitor.isNativePlatform()) {
      const granted = await requestNativeNotificationPermission();
      if (granted) {
        try {
          await update(ref(database, `users/${user.uid}`), {
            notificationPermission: "granted",
            notificationTokenUpdatedAt: Date.now(),
          });
        } catch (_err) {
          // Non-fatal.
        }
        debugLog("Native notification permission granted");
        return { native: true };
      }
      try {
        await update(ref(database, `users/${user.uid}`), {
          notificationPermission: "denied",
        });
      } catch (_err) {
        // Non-fatal.
      }
      return null;
    }

    if (!checkPushSupport()) {
      debugLog("Browser does not support Web Push");
      return null;
    }
    if (!VAPID_PUBLIC_KEY) {
      debugLog("VITE_VAPID_PUBLIC_KEY is not configured");
      return null;
    }

    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      if (user.notificationPermission !== permission) {
        try {
          await update(ref(database, `users/${user.uid}`), {
            notificationPermission: permission,
          });
        } catch (_err) {
          // Non-fatal: in-app notifications still work.
        }
      }
      return null;
    }

    const registration = await registerPushServiceWorker();
    const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);

    let subscription = await registration.pushManager.getSubscription();
    const expiringSoon =
      subscription?.expirationTime &&
      subscription.expirationTime < Date.now() + 24 * 60 * 60 * 1000;

    if (subscription && expiringSoon) {
      try {
        await subscription.unsubscribe();
      } catch (_err) {
        // Continue and try a fresh subscribe.
      }
      subscription = null;
    }

    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      });
    }

    const subscriptionJson = subscription.toJSON();
    if (!subscriptionJson?.endpoint || !subscriptionJson?.keys?.p256dh || !subscriptionJson?.keys?.auth) {
      debugLog("Subscription payload incomplete");
      return null;
    }

    await persistSubscriptionToDatabase(user.uid, subscriptionJson);
    postSubscriptionToBackend(user.uid, subscriptionJson, "save").catch(() => {});

    debugLog("Push subscription saved");
    return subscriptionJson;
  } catch (error) {
    debugLog("registerPushSubscription failed", error);
    return null;
  }
}

export async function cleanupPushSubscriptionOnLogout(user) {
  try {
    if (!user?.uid || (user.role && user.role !== "parent")) return;
    if (Capacitor.isNativePlatform()) return;
    if (!checkPushSupport()) {
      localStorage.removeItem(localSubKeyName(user.uid));
      return;
    }

    const registration = await navigator.serviceWorker.ready.catch(() => null);
    const subscription = await registration?.pushManager?.getSubscription();
    const subscriptionJson = subscription ? subscription.toJSON() : null;

    if (subscription) {
      try {
        await subscription.unsubscribe();
      } catch (err) {
        debugLog("Unsubscribe failed", err);
      }
    }

    await removeSubscriptionFromDatabase(user.uid, subscriptionJson);
    if (subscriptionJson) {
      postSubscriptionToBackend(user.uid, subscriptionJson, "delete").catch(() => {});
    }
  } catch (error) {
    debugLog("cleanupPushSubscriptionOnLogout failed", error);
  }
}

/** @deprecated Use registerPushSubscription. Kept so existing imports keep working. */
export const registerFcmTokenForParent = registerPushSubscription;
/** @deprecated Use cleanupPushSubscriptionOnLogout. */
export const cleanupFcmTokenOnLogout = cleanupPushSubscriptionOnLogout;
