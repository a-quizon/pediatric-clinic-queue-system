import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { subscribeToUserNotifications } from "./notificationCenterService";

function notificationIdToInt(id) {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash << 5) - hash + id.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % 2147483647 || 1;
}

export async function hasNativeNotificationPermission() {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    const result = await LocalNotifications.checkPermissions();
    return result.display === "granted";
  } catch (_err) {
    return false;
  }
}

export async function requestNativeNotificationPermission() {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    const current = await LocalNotifications.checkPermissions();
    if (current.display === "granted") return true;
    if (current.display === "denied") return false;
    const result = await LocalNotifications.requestPermissions();
    return result.display === "granted";
  } catch (_err) {
    return false;
  }
}

async function showLocalNotification(notif) {
  const perm = await LocalNotifications.checkPermissions();
  if (perm.display !== "granted") return;

  await LocalNotifications.schedule({
    notifications: [
      {
        id: notificationIdToInt(notif.id),
        title: notif.title || "Pediatric Clinic",
        body: notif.body || notif.message || "You have a new clinic update.",
        schedule: { at: new Date(Date.now() + 300) },
        sound: "default",
        extra: {
          notificationId: notif.id,
          url: "/parent/notifications",
        },
      },
    ],
  });
}

/**
 * On native Android, RTDB notifications are mirrored to the OS notification shade
 * via Local Notifications (Web Push is unavailable in the WebView).
 */
export function startNativeNotificationListener(parentId) {
  if (!Capacitor.isNativePlatform() || !parentId) return () => {};

  const seenIds = new Set();
  let isInitialLoad = true;

  const unsub = subscribeToUserNotifications(parentId, (list) => {
    if (isInitialLoad) {
      list.forEach((n) => seenIds.add(n.id));
      isInitialLoad = false;
      return;
    }

    list.forEach((notif) => {
      if (!notif?.id || seenIds.has(notif.id)) return;
      seenIds.add(notif.id);
      showLocalNotification(notif).catch(() => {});
    });
  });

  return unsub;
}

export function registerNativeNotificationClickHandler(onNavigate) {
  if (!Capacitor.isNativePlatform()) return () => {};

  const listener = LocalNotifications.addListener("localNotificationActionPerformed", (event) => {
    const url = event.notification?.extra?.url || "/parent/notifications";
    if (onNavigate) onNavigate(url);
  });

  return () => listener.remove();
}
