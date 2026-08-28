import React from 'react';
import toast from 'react-hot-toast';
import NotificationToast from '../components/common/NotificationToast';
import { saveNotification } from './notificationCenterService';

/**
 * Notification Event IDs
 * Single source of truth for system notification triggers across the clinic workflow.
 */
export const NOTIFICATION_EVENTS = {
  SCHEDULE_AVAILABLE: 'SCHEDULE_AVAILABLE',
  QUEUE_STARTED: 'QUEUE_STARTED',
  QUEUE_PAUSED: 'QUEUE_PAUSED',
  QUEUE_RESUMED: 'QUEUE_RESUMED',
  QUEUE_CLOSED: 'QUEUE_CLOSED',
  CLINIC_SESSION_ENDED: 'CLINIC_SESSION_ENDED',
  ALMOST_NEXT: 'ALMOST_NEXT',
  YOU_ARE_NEXT: 'YOU_ARE_NEXT',
  QR_VERIFIED: 'QR_VERIFIED',
  CONSULTATION_STARTED: 'CONSULTATION_STARTED',
  CONSULTATION_COMPLETED: 'CONSULTATION_COMPLETED',
  PENALIZED: 'PENALIZED',
  FORFEITED: 'FORFEITED',
  CHECK_IN_REQUESTED: 'CHECK_IN_REQUESTED',
};

/**
 * Configuration mapping each Event ID to its display hierarchy, title, and message.
 */
const NOTIFICATION_CONFIG = {
  [NOTIFICATION_EVENTS.SCHEDULE_AVAILABLE]: {
    type: 'info',
    title: 'Schedule Available',
    message: 'New clinic schedule is now available for reservation.',
    duration: 5000,
  },
  [NOTIFICATION_EVENTS.QUEUE_STARTED]: {
    type: 'info',
    title: 'Queue Started',
    message: 'The clinic queue has started.',
    duration: 5000,
  },
  [NOTIFICATION_EVENTS.QUEUE_PAUSED]: {
    type: 'warning',
    title: 'Queue Paused',
    message: 'The clinic queue has been paused.',
    duration: 6000,
  },
  [NOTIFICATION_EVENTS.QUEUE_RESUMED]: {
    type: 'info',
    title: 'Queue Resumed',
    message: 'The clinic queue has resumed.',
    duration: 5000,
  },
  [NOTIFICATION_EVENTS.QUEUE_CLOSED]: {
    type: 'warning',
    title: 'Queue Closed',
    message: "Reservations are now closed for today's clinic.",
    duration: 6000,
  },
  [NOTIFICATION_EVENTS.CLINIC_SESSION_ENDED]: {
    type: 'warning',
    title: 'Clinic Session Ended',
    message: "Today's clinic session has ended.",
    duration: 6000,
  },
  [NOTIFICATION_EVENTS.ALMOST_NEXT]: {
    type: 'warning',
    title: 'Almost Next',
    message: 'Your turn is approaching soon. Please be ready.',
    duration: 6000,
  },
  [NOTIFICATION_EVENTS.YOU_ARE_NEXT]: {
    type: 'warning',
    title: "You're Next",
    message: "You're next in line for consultation. Please prepare your QR code.",
    duration: 6000,
  },
  [NOTIFICATION_EVENTS.QR_VERIFIED]: {
    type: 'success',
    title: 'Arrival Verified',
    message: 'Your arrival has been verified.',
    duration: 5000,
  },
  [NOTIFICATION_EVENTS.CONSULTATION_STARTED]: {
    type: 'success',
    title: 'With Doctor',
    message: 'You are now with the doctor.',
    duration: 5000,
  },
  [NOTIFICATION_EVENTS.CONSULTATION_COMPLETED]: {
    type: 'success',
    title: 'Consultation Completed',
    message: 'Your consultation has been completed.',
    duration: 5000,
  },
  [NOTIFICATION_EVENTS.PENALIZED]: {
    type: 'error',
    title: 'Queue Position Adjusted',
    message: 'You were moved back in today\'s queue because you were unavailable.',
    duration: 7000,
  },
  [NOTIFICATION_EVENTS.FORFEITED]: {
    type: 'error',
    title: 'Reservation Forfeited',
    message: "Your reservation has been forfeited after exceeding the clinic's late arrival limit.",
    duration: 8000,
  },
  [NOTIFICATION_EVENTS.CHECK_IN_REQUESTED]: {
    type: 'info',
    title: 'Check-In Requested',
    message: 'Please proceed to the clinic and have your QR Code validated by the secretary.',
    duration: 6000,
  },
};

// In-memory cache for deduplication during the active JS session
const seenNotificationKeys = new Set();

class NotificationService {
  constructor() {
    this.storagePrefix = 'pcqs_notif_seen_';
    this.toastQueue = [];
    this.isToastActive = false;
  }

  /**
   * Check whether a notification event has already been shown for this specific entity/state.
   */
  isDuplicate(dedupeKey) {
    if (!dedupeKey) return false;
    if (seenNotificationKeys.has(dedupeKey)) return true;

    try {
      const stored = sessionStorage.getItem(`${this.storagePrefix}${dedupeKey}`);
      if (stored) {
        seenNotificationKeys.add(dedupeKey);
        return true;
      }
    } catch (e) {
      // Ignore storage access errors
    }

    return false;
  }

  /**
   * Mark a notification signature as shown.
   */
  markAsShown(dedupeKey) {
    if (!dedupeKey) return;
    seenNotificationKeys.add(dedupeKey);
    try {
      sessionStorage.setItem(`${this.storagePrefix}${dedupeKey}`, Date.now().toString());
    } catch (e) {
      // Ignore storage access errors
    }
  }

  /**
   * Trigger a system notification by Event ID.
   *
   * @param {string} eventId - One of NOTIFICATION_EVENTS
   * @param {object} context - { dedupeKey, customMessage, parentId, ... }
   * @returns {boolean} Whether the notification was dispatched
   */
  notify(eventId, context = {}) {
    const config = NOTIFICATION_CONFIG[eventId];
    if (!config) {
      console.warn(`[NotificationService] Unknown notification event ID: ${eventId}`);
      return false;
    }

    // Deduplication check
    const dedupeKey = context.dedupeKey || `${eventId}_default`;
    if (this.isDuplicate(dedupeKey)) {
      return false;
    }

    this.markAsShown(dedupeKey);

    const body = context.customMessage || config.message;
    const title = config.title;
    const severity = config.type;
    const duration = config.duration || 3000;

    // Step 1: Standardized Notification Object conforming to system schema
    const notificationObject = {
      title,
      body,
      message: body,
      type: eventId,
      severity,
      createdAt: Date.now(),
      read: false,
      reservationId: context.reservationId || context.entityId || null,
      branchId: context.branchId || null,
      metadata: context.metadata || null,
    };

    // Step 2: Save to persistent In-App Notification Center (dev only — prod uses Cloud Functions)
    const serverPersists = import.meta.env.PROD;
    if (context.parentId && !serverPersists) {
      try {
        saveNotification(context.parentId, {
          ...notificationObject,
          ...context,
        }).catch((err) => {
          console.error("[NotificationService] Failed to save notification to Notification Center:", err);
        });
      } catch (storageError) {
        console.error("[NotificationService] Storage delivery exception:", storageError);
      }
    }

    // Step 3: Display Toast Notification sequentially (isolated error handling)
    if (context.showToast !== false) {
      try {
        this.toastQueue.push({
          eventId,
          type: severity,
          title,
          message: body,
          duration,
        });
        this.processToastQueue();
      } catch (toastError) {
        console.error("[NotificationService] Toast delivery exception:", toastError);
      }
    }

    // Step 4: Push Notification Channel
    // Closed-browser delivery is owned by the Express RTDB listeners / Cloud Functions.
    // This client call is a fallback for when the page is open and the API is reachable.
    try {
      this.dispatchPushNotification(eventId, notificationObject, context);
    } catch (pushError) {
      console.error("[NotificationService] Push delivery exception:", pushError);
    }

    return true;
  }

  /**
   * Process sequential non-overlapping toast display
   */
  processToastQueue() {
    if (this.isToastActive || this.toastQueue.length === 0) return;

    this.isToastActive = true;
    const nextToast = this.toastQueue.shift();
    const duration = nextToast.duration || 3000;

    this.displayToast(nextToast);

    setTimeout(() => {
      this.isToastActive = false;
      this.processToastQueue();
    }, duration + 350);
  }

  /**
   * Displays a responsive, clean Toast Notification conforming to design hierarchy.
   */
  displayToast({ type, title, message, duration }) {
    toast.custom(
      (t) =>
        React.createElement(NotificationToast, {
          t,
          type,
          title,
          message,
          onDismiss: () => toast.dismiss(t.id),
        }),
      { duration: duration || 3000 }
    );
  }

  /**
   * Fallback push dispatch via the Express API.
   * Server-side listeners claim the same notification id, so this will no-op if
   * the realtime dispatcher already sent the push.
   */
  dispatchPushNotification(eventId, notificationObject, context) {
    if (!context.parentId || typeof window === "undefined") return;
    if (!("Notification" in window) || Notification.permission !== "granted") return;

    const apiBase = import.meta.env.VITE_API_URL || "";
    // Production push is handled by Cloud Functions / RTDB listeners; skip client fallback.
    if (import.meta.env.PROD && !apiBase) return;

    import("firebase/auth")
      .then(({ getAuth }) => getAuth().currentUser?.getIdToken())
      .then((token) => {
        if (!token) return null;
        return fetch(`${apiBase}/api/send-notification`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            parentId: context.parentId,
            eventId,
            notification: notificationObject,
            reservationId: context.reservationId || context.entityId || null,
            branchId: context.branchId || null,
            dedupeKey: context.dedupeKey || null,
          }),
        });
      })
      .catch(() => {
        // Optional dev fallback; closed-browser push uses the Express server or Cloud Functions.
      });
  }

  /**
   * Reset deduplication cache (useful for testing or logout)
   */
  clearCache() {
    seenNotificationKeys.clear();
  }
}

export const notificationService = new NotificationService();
export default notificationService;
