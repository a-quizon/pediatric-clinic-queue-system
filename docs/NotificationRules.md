# Notification Rules & Specification

This document serves as the **official specification** for the pediatric clinic Notification System. It documents the exact implementation of notification storage, distribution channels, and role-based restrictions.

---

## 1. Overview
The Notification System is designed to keep users informed of real-time clinic events and queue progressions. It operates via a unified `notificationService` that acts as a central dispatcher, routing system events into two active channels: transient in-app Toast Notifications, and a persistent database-backed Notification Center. While it registers devices for Firebase Cloud Messaging (FCM), actual push notification dispatching is currently disabled.

---

## 2. Notification Architecture
- **Notification Entity**: A normalized JSON object containing `title`, `body`, `type` (Event ID), `severity`, `createdAt`, `read` (boolean), and optional context like `reservationId` or `branchId`.
- **Notification Storage**: Persisted in the Firebase Realtime Database exclusively under `notifications/${parentId}`.
- **Tokens**: The system generates FCM Registration Tokens and stores them under the User entity (`users/${uid}`) along with their browser `notificationPermission`.
- **Push Notification Flow**: The `dispatchPushNotification` pipeline exists as an extension point, but it actively halts and **does not** dispatch actual push messages to FCM in the current implementation.

---

## 3. Notification Types
The system uses strict `NOTIFICATION_EVENTS` as the single source of truth for triggers:

| Event ID | Purpose | Triggered By | Recipient |
|----------|---------|--------------|-----------|
| **SCHEDULE_AVAILABLE** | Informs users of new booking slots. | Doctor publishes schedule. | Parents |
| **QUEUE_STARTED** | Clinic floor is officially open. | Doctor starts queue. | Parents |
| **QUEUE_PAUSED** | Clinic floor is temporarily halted. | Doctor pauses queue. | Parents |
| **QUEUE_RESUMED** | Clinic floor resumes operations. | Doctor resumes queue. | Parents |
| **QUEUE_CLOSED** | End of daily reservations. | Doctor closes queue. | Parents |
| **CLINIC_SESSION_ENDED**| Clinic day has completely finished. | Doctor completes schedule. | Parents |
| **ALMOST_NEXT** | Queue index reaches #2. | Queue Engine Recalculation | Specific Parent |
| **YOU_ARE_NEXT** | Queue index reaches #1. | Queue Engine Recalculation | Specific Parent |
| **CHECK_IN_REQUESTED**| Manual prompt to approach the desk. | Secretary clicks "Request Check-In" | Specific Parent |
| **QR_VERIFIED** | Arrival confirmed. | Secretary validates QR code. | Specific Parent |
| **CONSULTATION_STARTED**| Patient is inside the room. | Secretary clicks "Send to Doctor" | Specific Parent |
| **CONSULTATION_COMPLETED**| Visit is finished. | Doctor clicks "Complete Consultation" | Specific Parent |
| **PENALIZED** | Patient was moved backward in line. | Secretary applies penalty. | Specific Parent |
| **FORFEITED** | Patient exceeded late limit. | Secretary applies final penalty. | Specific Parent |

---

## 4. Parent Notifications
Parents are the **only** entity in the system that receives persistent notifications. All events listed in Section 3 are strictly routed to the relevant Parent. The Notification Center actively subscribes to `notifications/${parentId}` to render these alerts.

---

## 5. Secretary Notifications
**None.** 
The Secretary does not receive any persistent database notifications or push notifications. They only receive transient, local, browser-level Toast messages (e.g., "Penalty Applied successfully") when they perform direct actions on the dashboard.

---

## 6. Doctor Notifications
**None.** 
The Doctor does not receive persistent database notifications or push notifications. Similar to the Secretary, they only see local UI feedback toasts confirming their actions (e.g., "Schedule Published").

---

## 7. Admin Notifications
**None.** 
The Admin role does not participate in the Notification System.

---

## 8. Delivery Rules
When `notificationService.notify()` is triggered:
1. **Deduplication Check**: The system checks local `sessionStorage` to ensure the exact same notification hasn't been fired recently.
2. **Notification Center (Persistent)**: If a `parentId` is provided, the notification object is written to the Firebase database under `notifications/${parentId}`.
3. **Toast (In-App)**: A local toast alert is added to a sequential queue and displayed on the screen for a few seconds.
4. **Push Notifications**: **DO NOT FIRE.** The system prepares the payload, checks if permissions exist, logs to the console in development mode, but explicitly halts without sending.

---

## 9. Notification Center Rules
* **Storage**: Stored as a list of records in Firebase.
* **Ordering**: Rendered chronologically, typically sorted by `createdAt` descending (newest first).
* **Timestamps**: Uses standard Epoch milliseconds (`Date.now()`).
* **Read / Unread Behavior**: New notifications default to `read: false`.
* **Display**: Components map the `read` flag to visual indicators (e.g., a blue dot or bold text for unread).

---

## 10. Push Notification Rules
* **Permission Request**: The app uses `Notification.requestPermission()` to ask the browser for permission.
* **FCM Token Generation**: If granted, it registers a Service Worker and contacts Firebase to retrieve a unique `notificationToken`.
* **User Entity Storage**: It stores `notificationToken`, `notificationPermission`, and `notificationTokenUpdatedAt` on the User document in the database.
* **Purpose**: This infrastructure is solely preparatory. It acts as a passive registry of device tokens that could theoretically be used by a future Cloud Function or external server to dispatch FCM messages.

---

## 11. Read / Unread Rules
A notification transitions from `read: false` to `read: true` via a direct database update to the specific notification record (`notifications/${parentId}/${notificationId}/read: true`). This is triggered when the Parent interacts with the Notification Center UI (e.g., clicking on the notification or a "Mark All as Read" button).

---

## 12. Notification Cleanup Rules
* **Non-Parent Cleanup**: The system actively enforces role isolation. A function `cleanupNonParentNotifications` scans users; if a Doctor, Secretary, or Admin somehow ends up with notification records, the function forcefully deletes them to maintain a clean database.
* **Logout Cleanup**: When a Parent logs out, the system triggers `cleanupFcmTokenOnLogout`, which actively wipes the `notificationToken` from their user document to ensure they don't receive alerts on a public or shared device.
* **Migration**: A `migrateUserNotifications` function safely moves legacy notifications from `users/${parentId}/notifications` to the dedicated `notifications/${parentId}` node.

---

## 13. Edge Cases
* **Notification Permission Denied**: If a user denies browser notifications, the system silently degrades. It still writes to the database Notification Center and shows local Toasts, but `notificationToken` is not generated.
* **Missing FCM Token**: Fails gracefully; the app never crashes due to push registration failure.
* **Duplicate Notifications**: Handled by an in-memory `Set` and `sessionStorage`. If the exact same queue progression event fires multiple times quickly, the system drops the duplicates and only displays/saves the first one.

---

## 14. Rule Priority Order
1. **Role Restriction Rule (Highest)**
   * *Only Parents may have notification records. All other roles are blocked or actively cleaned up.*
2. **Deduplication Rule**
   * *A notification event will be entirely dropped if it matches a recently cached signature in `sessionStorage`.*
3. **Database Storage Rule**
   * *Valid notifications are written to Firebase for historical tracking.*
4. **Push Notification Rule (Lowest)**
   * *Currently disabled entirely. It acts as an inert endpoint.*

*Why this order?* Role restriction ensures data privacy and database optimization (preventing doctors/secretaries from bloating the DB with irrelevant alerts). Deduplication prevents spamming the user and the database. 

---

## 15. Regression Protection Checklist
When modifying the Notification System, developers must verify the following constraints remain intact:

- [ ] ✓ Notification metadata is strictly stored under `notifications/${parentId}`.
- [ ] ✓ FCM token generates and attaches to the `user` document correctly upon permission grant.
- [ ] ✓ FCM token is successfully wiped from the database upon logout.
- [ ] ✓ Push notifications remain inactive (no actual dispatch occurs).
- [ ] ✓ Role filtering correctly blocks Doctors, Secretaries, and Admins from receiving persistent notifications.
- [ ] ✓ Local deduplication prevents multiple identical toasts/DB entries firing at the same time.
