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
    title: 'Consultation Started',
    message: 'Your consultation has started.',
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

    const message = context.customMessage || config.message;
    const title = config.title;
    const type = config.type;
    const duration = 3000; // ~3 seconds sequential display

    // Phase 2: Save to persistent In-App Notification Center
    if (context.parentId) {
      saveNotification(context.parentId, {
        eventId,
        type,
        title,
        message,
        ...context,
      });
    }

    // Enqueue toast for sequential non-overlapping display
    this.toastQueue.push({
      eventId,
      type,
      title,
      message,
      duration,
    });

    this.processToastQueue();

    // Phase 3 architecture hook:
    this.dispatchToFuturePhases(eventId, {
      ...config,
      message,
      ...context,
    });

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
   * Future-Ready Architecture Hook
   * Phase 3: Web Push / Mobile Push / SMS / Email
   */
  dispatchToFuturePhases(eventId, payload) {
    // Reserved for Phase 3 (Push service dispatch)
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
