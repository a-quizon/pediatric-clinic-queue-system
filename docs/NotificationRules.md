# Notification Rules & Specification

This document serves as the **official specification** for the pediatric clinic Notification System. It documents the exact implementation of notification storage, distribution channels, and role-based restrictions.

---

## 1. Overview
The Notification System keeps users informed of real-time clinic events and queue progressions. It uses a unified dispatcher that routes system events into three channels: transient in-app Toast Notifications, a persistent database-backed Notification Center, and native Web Push (Push API + Notifications API) so parents still receive alerts when the browser is in the background or fully closed.

---

## 2. Notification Architecture
- **Notification Entity**: A normalized JSON object containing `title`, `body`, `type` (Event ID), `severity`, `createdAt`, `read` (boolean), and optional context like `reservationId` or `branchId`.
- **Notification Storage**: Persisted in the Firebase Realtime Database exclusively under `notifications/${parentId}`.
- **Push Subscriptions**: Native Web Push subscriptions (endpoint + `p256dh`/`auth` keys) are stored under `users/${uid}/pushSubscriptions/{hash}` together with `notificationPermission`.
- **Push Notification Flow**: Clinic events are observed server-side (Express RTDB listeners and Cloud Functions `onWrite`). The server writes the Notification Center record and dispatches a Web Push payload with the `web-push` library and VAPID keys. The root service worker (`/sw.js`) receives the `push` event and calls `self.registration.showNotification`. Clicking a notification opens `/parent/notifications` (or a context-specific URL).
- **SMS Channel (textbee.dev)**: For `SLOT_RESERVED`, `QUEUE_STARTED`, `NEARING_TURN`, `PENALIZED`, `FORFEITED`, and `RESERVATION_CANCELLED_BY_CLINIC`, the same server/Functions dispatcher also sends an SMS via the textbee REST API (`TEXTBEE_API_KEY`, global env — not per-branch). `SLOT_RESERVED` SMS fires when the parent finalizes patient info (`patientInfoCompleted` → true / Save Information), not on bare reservation create. If that schedule’s queue is already `active` / `paused` / `closed`, the **Active Queue Reservation** template is used instead of the normal confirmed-reservation template. **Phone-in walk-ins** are an isolated exception: on create, if `source === "walk_in"`, `parentPhone` is set, and there is no `parentId`, the engines send **one** SMS to `parentPhone` (same `slotReservedSmsSent` claim). If the queue is still `not_started`, that SMS uses `templateSlotReserved`. If the queue is already `active` / `paused`, it reuses the parent-side **Active Queue Reservation** template (`templateSlotReservedActiveQueue`) via the same `buildSmsMessage` live-queue path. They do **not** receive Queue Started, Near Turn, Penalized, or Forfeited SMS (`parentPhone` is never used as a broadcast recipient). Closed / ended / completed queues send no walk-in SMS. In-person walk-ins with no phone receive none. `SLOT_RESERVED` is locked on the reservation (`slotReservedSmsSent`, transaction claim) so dual Express + Cloud Functions dispatch and Save Information retries cannot send twice. `QUEUE_STARTED` is sent once per parent with an active reservation on that schedule (branch + date). Duplicate SMS is also marked with `smsDispatchedAt` on the notification record (same pattern as `pushDispatchedAt`; the claim succeeds only for the writer that stored that timestamp). `NEARING_TURN` SMS fires **only when the queue first starts** (`queueStatus` becomes `active`), and only for tickets with `0 < aheadOfYou <=` that branch’s `nearingTurnAheadCount` (position 1 / `aheadOfYou === 0` is already their turn, so it does not send). Later recalculation, penalties, pause/resume, and new bookings do not send Near Turn SMS. It is locked by `reservations/{reservationId}/nearTurnSmsSent` (transaction claim). A stable `dedupeKey` of `nearing_turn_${reservationId}` remains a second notification-layer lock. `PENALIZED` SMS fires once per penalty increment that does not instantly forfeit, locked by `reservations/{reservationId}/penaltySmsSent/{penaltyCount}`. `FORFEITED` SMS fires when status becomes `forfeited` (timer expiry or move-back 0). SMS message templates and the near-turn patients-ahead threshold are Secretary-configurable per branch under `systemConfiguration/{branchId}/sms` (defaults: count `3`, seeded templates). Push/toast near-turn copy stays system-managed but uses the same configured count.

---

## 3. Notification Types
The system uses strict `NOTIFICATION_EVENTS` as the single source of truth for triggers:

| Event ID | Purpose | Triggered By | Recipient |
|----------|---------|--------------|-----------|
| **SCHEDULE_AVAILABLE** | Tells parents a reservation schedule is open to book (Web Push + Notification Center; no SMS). Sent **once per publish action** (publish range, copy week, or post day)—not once per day in a range. | Secretary/doctor completes a publish batch | All active parents |
| **SLOT_RESERVED** | Confirms a finalized reservation (in-app / push / SMS with reservation details). Phone-in walk-ins get SMS only (no Notification Center): normal confirmed-reservation copy if the queue has not started, or the Active Queue Reservation template if it is already `active` / `paused`. | Parent clicks Save Information (`patientInfoCompleted`), or secretary creates a walk-in with `parentPhone` on a published upcoming or live (`active` / `paused`) schedule. | Specific Parent (or walk-in phone) |
| **QUEUE_STARTED** | Clinic floor is open; SMS announces queue start (branch + date). | Secretary/doctor starts queue. | Parents with active reservations on that schedule |
| **QUEUE_PAUSED** | Clinic floor is temporarily halted. | Doctor or secretary pauses queue. | Parents |
| **QUEUE_RESUMED** | Clinic floor resumes operations. | Doctor or secretary resumes queue. | Parents |
| **QUEUE_CLOSED** | End of daily reservations. | Doctor or secretary closes queue. | Parents |
| **CLINIC_SESSION_ENDED**| Clinic day has completely finished. | Doctor or secretary ends clinic session. | Parents |
| **NEARING_TURN** | At **queue start only**, parents who are approaching (not already first) with `0 < aheadOfYou <= N` get SMS once (`nearTurnSmsSent`; N from that branch’s `systemConfiguration/{branchId}/sms/nearingTurnAheadCount`, default 3). | Secretary/doctor starts the queue | Specific Parent |
| **ALMOST_NEXT** | Queue index reaches #2. | Queue Engine Recalculation | Specific Parent |
| **YOU_ARE_NEXT** | Queue index reaches #1. | Queue Engine Recalculation | Specific Parent |
| **CHECK_IN_REQUESTED**| Manual prompt to approach the desk. | Secretary clicks "Request Check-In" | Specific Parent |
| **QR_VERIFIED** | Arrival confirmed. | Secretary validates QR code. | Specific Parent |
| **CONSULTATION_STARTED**| Patient is inside the room. | Secretary clicks "Send to Doctor" | Specific Parent |
| **CONSULTATION_COMPLETED**| Visit is finished. | Doctor clicks "Complete Consultation" | Specific Parent |
| **PENALIZED** | Patient was moved backward in line; late timer started or kept. | Secretary applies penalty. | Specific Parent |
| **FORFEITED** | Patient did not check in before the late timer expired, or Move-Back is 0. | Secretary Penalize or timer auto-expiry. | Specific Parent |
| **RESERVATION_CANCELLED_BY_CLINIC** | The clinic closed the reserved day. The parent rebooks on another open day. | Secretary or doctor closes that date while the reservation is still `reserved` or `waiting`. | Specific Parent |

---

## 4. Parent Notifications
Parents are the **only** entity in the system that receives persistent notifications and Web Push. All events listed in Section 3 are strictly routed to the relevant Parent. The Notification Center actively subscribes to `notifications/${parentId}` to render these alerts.

---

## 5. Secretary Notifications
**None.** 
The Secretary does not receive any persistent database notifications or push notifications. They only receive transient, local, browser-level Toast messages (e.g., "Schedule Published", "Penalty Applied successfully") when they perform direct actions on the dashboard.

---

## 6. Doctor Notifications
**None.** 
The Doctor does not receive persistent database notifications or push notifications. Similar to the Secretary, they only see local UI feedback toasts confirming their actions (e.g., "Consultation Completed").

---

## 7. Staff Notifications
**None as persistent/push.**
Doctors and Secretaries receive local toasts only. There is no separate Admin notification channel (the former Admin role is retired; clinic-admin powers live on the Doctor).

---

## 8. Delivery Rules
When a clinic event occurs:
1. **Deduplication Check**: Client toasts use `sessionStorage`. Persistent records and push use a stable `dedupeKey` as the RTDB node id.
2. **Notification Center (Persistent)**: If a `parentId` is provided and the user is a Parent, the notification object is written to `notifications/${parentId}`.
3. **Toast (In-App)**: If the parent app is open, a local toast is queued and displayed.
4. **Web Push**: The server sends a Web Push message to every stored subscription for that parent. Duplicate sends are prevented with `pushDispatchedAt`. If the parent has a focused window, the service worker suppresses the OS banner and the in-app toast is used instead. If the browser is backgrounded or closed, the service worker shows the OS notification.

---

## 9. Notification Center Rules
* **Storage**: Stored as a list of records in Firebase.
* **Ordering**: Rendered chronologically, typically sorted by `createdAt` descending (newest first).
* **Timestamps**: Uses standard Epoch milliseconds (`Date.now()`).
* **Read / Unread Behavior**: New notifications default to `read: false`.
* **Display**: Components map the `read` flag to visual indicators (e.g., a blue dot or bold text for unread).

---

## 10. Push Notification Rules
* **Permission Request**: After a successful verified parent login (the Sign In click is the user gesture), the client calls `requestPushPermissionAfterLogin`, which uses the **OS** dialog — Capacitor `LocalNotifications.requestPermissions()` on Android/iOS, or `Notification.requestPermission()` on web. Do not show a custom in-app permission modal. On native, a silent cold-start gate may request once if permission is still `prompt`. Already granted/denied results are synced to RTDB without re-prompting.
* **Parent Preferences** (`users/${uid}`):
  * `inAppNotificationsEnabled` (default `true`) — gates in-app toasts only. Notification Center records under `notifications/${parentId}` are still written.
  * `devicePushEnabled` — parent opt-in for OS/device banners. Set `true` when the OS prompt is Allowed; set `false` when Denied or when the parent turns the Profile toggle off.
  * `notificationPermission` — last OS result: `default` | `granted` | `denied`.
* **Service Worker**: The app registers `/sw.js` at the site root. It listens for `push` and `notificationclick`.
* **Subscription**: `PushManager.subscribe({ userVisibleOnly: true, applicationServerKey })` using the VAPID **public** key. The subscription is saved to `users/${uid}/pushSubscriptions` and POSTed to `POST /api/save-subscription`.
* **Dispatch**: `POST /api/send-notification` plus realtime RTDB listeners (Express) and Cloud Functions `onReservationWrite` / `onScheduleWrite` send payloads with the `web-push` library and the VAPID **private** key. Native APK delivery uses Local Notifications, which respect `devicePushEnabled`.
* **Closed browser**: The browser push service wakes `/sw.js` even when no window is open. The worker must call `showNotification()` or the push is dropped.
* **Logout Cleanup**: `cleanupPushSubscriptionOnLogout` unsubscribes the device and deletes that device's subscription node. Turning off device-level push in Profile uses the same web unsubscribe path without signing out.

### Generating VAPID keys
```bash
cd server
npm run generate-vapid
# or: npx web-push generate-vapid-keys
```
Put the public key in `client/.env` as `VITE_VAPID_PUBLIC_KEY`. Put both keys in `server/.env` and `client/functions/.env`.

---

## 11. Read / Unread Rules
A notification transitions from `read: false` to `read: true` via a direct database update to the specific notification record (`notifications/${parentId}/${notificationId}/read: true`). This is triggered when the Parent interacts with the Notification Center UI (e.g., clicking on the notification or a "Mark All as Read" button).

---

## 12. Notification Cleanup Rules
* **Non-Parent Cleanup**: The system actively enforces role isolation. A function `cleanupNonParentNotifications` (run by the Doctor on login) scans users; if a Doctor or Secretary somehow ends up with notification records, the function forcefully deletes them to maintain a clean database.
* **Logout Cleanup**: When a Parent logs out, the system triggers `cleanupPushSubscriptionOnLogout`, which removes this device's Web Push subscription so a shared/public browser stops receiving alerts.
* **Migration**: A `migrateUserNotifications` function safely moves legacy notifications from `users/${parentId}/notifications` to the dedicated `notifications/${parentId}` node.
* **Expired subscriptions**: HTTP 404/410 responses from the push service delete that subscription node.

---

## 13. Edge Cases
* **Notification Permission Denied**: If a user denies OS/browser notifications, `devicePushEnabled` is `false` and the Profile device toggle stays off. The system still writes to the Notification Center. Toasts still show unless `inAppNotificationsEnabled` is false. No push subscription is created.
* **Missing / invalid subscription**: Fails gracefully; the app never crashes due to push registration failure.
* **Duplicate Notifications**: Client toasts use an in-memory `Set` plus `sessionStorage`. Persistent/push delivery uses deterministic `dedupeKey` ids and `pushDispatchedAt`.
* **Browser fully closed**: Service worker + Web Push still deliver. Requires a previously granted permission, `devicePushEnabled`, an active subscription, and a running dispatcher (local Express or deployed Cloud Functions).
* **Unsupported browsers / insecure origins**: Push is unavailable except on HTTPS or localhost. Notification Settings explains this.

---

## 14. Rule Priority Order
1. **Role Restriction Rule (Highest)**
   * *Only Parents may have notification records. All other roles are blocked or actively cleaned up.*
2. **Deduplication Rule**
   * *A notification event will be entirely dropped if it matches a recently cached signature or an existing `dedupeKey` record.*
3. **Database Storage Rule**
   * *Valid notifications are written to Firebase for historical tracking and the Notification Center.*
4. **Push Notification Rule**
   * *Web Push is sent to the parent's registered devices after the record is stored. It never replaces in-app storage.*

*Why this order?* Role restriction ensures data privacy and database optimization (preventing doctors/secretaries from bloating the DB with irrelevant alerts). Deduplication prevents spamming the user and the database.

---

## 15. Regression Protection Checklist
When modifying the Notification System, developers must verify the following constraints remain intact:

- [ ] ✓ Only one active consultation may exist at any time.
- [ ] ✓ Queue penalties must never bypass the consultation lock.
- [ ] ✓ Completed consultations immediately release schedule slots.
- [ ] ✓ Secretary Branch Isolation remains enforced.
- [ ] ✓ Permanent Ticket Numbers never change.
- [ ] ✓ Queue recalculation never changes Ticket Numbers.
- [ ] ✓ Reservation History remains immutable.
- [ ] ✓ Notification metadata is strictly stored under `notifications/${parentId}`.
- [ ] ✓ Web Push subscription is saved under `users/${uid}/pushSubscriptions` upon permission grant.
- [ ] ✓ Parent `inAppNotificationsEnabled` / `devicePushEnabled` match Profile toggles; OS Allow/Deny updates device-level push.
- [ ] ✓ Push subscription for this device is wiped from the database upon logout.
- [ ] ✓ Closed-browser push still delivers via `/sw.js` + `web-push`.
- [ ] ✓ Role filtering correctly blocks Doctors and Secretaries from receiving persistent notifications.
- [ ] ✓ `NEARING_TURN` threshold and SMS templates come from `systemConfiguration/{branchId}/sms` (defaults when missing); push/toast near-turn text stays count-synced only.
- [ ] ✓ `NEARING_TURN` SMS sends once per reservation (`reservations/{id}/nearTurnSmsSent`) **only when the queue starts**, for tickets with `0 < aheadOfYou <=` that branch’s count (not when already first; not on later position changes).
- [ ] ✓ `SLOT_RESERVED` SMS sends once per reservation (`reservations/{id}/slotReservedSmsSent`).
- [ ] ✓ `PENALIZED` SMS sends once per penalty increment (`reservations/{id}/penaltySmsSent/{count}`).
- [ ] ✓ `PENALIZED` and `FORFEITED` send SMS in addition to Notification Center / push.
- [ ] ✓ Booking after the queue has started uses the Active Queue Reservation SMS template, not the pre-start confirmed-reservation template.
- [ ] ✓ Local deduplication prevents multiple identical toasts/DB entries firing at the same time.
