import { database } from "../firebase/database";
import { ref, push, set, update, onValue } from "firebase/database";

/**
 * Notification Center Service
 * Manages persistent storage and real-time synchronization of notifications
 * in Firebase Realtime Database at `users/${parentId}/notifications`.
 */

export const saveNotification = async (parentId, notificationData) => {
  if (!parentId) return null;
  try {
    const notifRef = push(ref(database, `users/${parentId}/notifications`));
    const newNotif = {
      id: notifRef.key,
      parentId,
      eventId: notificationData.eventId || "INFO",
      title: notificationData.title || "Notification",
      message: notificationData.message || "",
      createdAt: Date.now(),
      read: false,
      ...notificationData,
    };
    await set(notifRef, newNotif);
    return notifRef.key;
  } catch (error) {
    console.error("[NotificationCenterService] Failed to save notification:", error);
    return null;
  }
};

export const subscribeToUserNotifications = (parentId, callback) => {
  if (!parentId) {
    callback([]);
    return () => {};
  }
  const notifRef = ref(database, `users/${parentId}/notifications`);
  const unsubscribe = onValue(notifRef, (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.val();
      const list = Object.values(data).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      callback(list);
    } else {
      callback([]);
    }
  }, (error) => {
    console.error("[NotificationCenterService] Subscription error:", error);
    callback([]);
  });
  return unsubscribe;
};

export const markNotificationsAsRead = async (parentId, notificationIds = []) => {
  if (!parentId || !notificationIds || notificationIds.length === 0) return;
  try {
    const updates = {};
    notificationIds.forEach((id) => {
      updates[`users/${parentId}/notifications/${id}/read`] = true;
    });
    await update(ref(database), updates);
  } catch (error) {
    console.error("[NotificationCenterService] Failed to mark notifications as read:", error);
  }
};

export const markAllNotificationsAsRead = async (parentId, notifications = []) => {
  if (!parentId || !notifications || notifications.length === 0) return;
  const unreadIds = notifications.filter((n) => !n.read).map((n) => n.id);
  if (unreadIds.length > 0) {
    await markNotificationsAsRead(parentId, unreadIds);
  }
};
