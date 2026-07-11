import { database } from "../firebase/database";
import { ref, push, set, update, get, onValue } from "firebase/database";

/**
 * Notification Center Service
 * Manages persistent storage and real-time synchronization of notifications
 * in Firebase Realtime Database at `users/${parentId}/notifications`.
 */

export const cleanupNonParentNotifications = async () => {
  try {
    const snapshot = await get(ref(database, "users"));
    if (!snapshot.exists()) return;

    const users = snapshot.val();
    const updates = {};

    Object.entries(users).forEach(([uid, userData]) => {
      if (userData && userData.role !== "parent" && userData.notifications) {
        updates[`users/${uid}/notifications`] = null;
      }
    });

    if (Object.keys(updates).length > 0) {
      await update(ref(database), updates);
      console.log("[NotificationCenterService] Cleaned non-parent notifications:", Object.keys(updates));
    }
  } catch (error) {
    console.error("[NotificationCenterService] Failed to cleanup non-parent notifications:", error);
  }
};

export const saveNotification = async (parentId, notificationData) => {
  if (!parentId) return null;
  try {
    // Parent-Only Phase guard: verify user role is 'parent' before creating notification records
    const roleSnapshot = await get(ref(database, `users/${parentId}/role`));
    if (roleSnapshot.exists() && roleSnapshot.val() !== "parent") {
      return null;
    }

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
