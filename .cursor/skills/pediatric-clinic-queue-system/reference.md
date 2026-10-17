# Reference — Schema, API, Config

Read when modifying Firebase data, server routes, or environment setup.

## RTDB Nodes

### `users/{uid}`
```js
{
  uid, name, email, phone,
  isPhoneVerified: true,      // parents; set after SMS OTP during registration
  role: "parent" | "secretary" | "doctor" | "admin", // admin = System Admin, Admin SDK only; never assigned in the UI
  status: "active" | "inactive",
  deactivationSource: "self" | "admin" | null, // "admin" = administrative (System Admin-performed)
  isDeleted: false,               // parent soft-delete tombstone; Auth is revoked
  deletedAt,                      // epoch ms when soft-deleted
  onboardingComplete: true,       // parents; false until first child profile during onboarding
  createdAt, updatedAt,           // epoch ms
  assignedBranch: "Angeles",       // secretaries only
  children/{childId}: {            // parent-saved child profiles
    childName, age, sex, createdAt
  },
  pushSubscriptions/{hash}: { endpoint, keys: { p256dh, auth } },
  nearTurnSms: { sentAt, reservationId, backfilled? },  // parents; server-only; Near Turn SMS once per account, never reset
  notificationPermission: "default" | "granted" | "denied",
  inAppNotificationsEnabled: true,  // parents; toasts while app is open (default true)
  devicePushEnabled: true,          // parents; OS/web push; set after OS grant
  pushTokens/{key}: { token }      // legacy FCM cleanup path
}
```

### `passwordResetLimits/{emailKey}`
Server-only daily cap for Forgot Password + the admin's parent reset email (reset emails are parents-only). Email key is lowercase with `. # $ [ ]` replaced by `_`. Counter resets on a new **Asia/Manila** calendar date. Also stores `lastSentAt` for the **30-second** resend cooldown.
```js
{
  email,                 // normalized lowercase
  date: "YYYY-MM-DD",    // Asia/Manila
  count: 1,              // 1–5; 5th claim is last allowed that day
  lastSentAt,            // epoch ms — short resend cooldown
  updatedAt              // epoch ms
}
```
Daily limit: **5** requests per email. Resend cooldown: **30 seconds**. Client R/W denied in rules.

### `emailVerificationLimits/{uid}`
Server-only short cooldown before `sendEmailVerification` (register + Verify Email resend). Client R/W denied in rules.
```js
{
  uid,
  lastSentAt,            // epoch ms
  updatedAt
}
```
Resend cooldown: **30 seconds** (independent of OTP / password-reset).

### `branchConfigurations/{branchId}`
```js
{
  name: "Angeles",
  clinicAddress: "...",
  schedule: {
    monday: { isOpen, openingTime, closingTime },
    // ... all 7 days
  }
}
```
Default branches: **Angeles**, **Magalang**.

### `schedules/{scheduleId}`
```js
{
  branch, clinicDate,              // "YYYY-MM-DD"
  openingTime, closingTime,
  slotCapacity,                    // lateLimit on old schedules is ignored

  status: "draft" | "published" | "completed",
  dayClosed, closureId, closureReason, closureNote,
  booking: {                       // server-only (Admin SDK transaction)
    activeSlotCount,               // == number of holders
    nextQueueNumber,
    holdersTracked: true,          // absent on legacy counters; migrated on next claim
    holders: { [reservationId]: claimedAtMs }
  },
  queueStatus: "not_started" | "active" | "paused" | "closed" | "completed",
  queueStartedAt,                  // actual first start (serverTimestamp), separate from openingTime
  queueStartedBeforeHours,         // true when started before the scheduled date/openingTime
  publishedAt, completedAt,
  isReady, doctorId
}
```
Start Queue has no time-of-day gate: any published, not-closed, not-ended session dated today or later can be started, as long as no other queue is live (`schedulesStartable` in `utils/scheduleCalendar.js`, enforced again in `updateQueueStatus`).

### `clinicClosures/{closureId}`
```js
{
  branch, branchId,
  startDate, endDate,              // inclusive YYYY-MM-DD, Asia/Manila
  reason: "emergency" | "vacation" | "holiday" | "other",
  note, createdBy, createdAt
}
```

### `bookingLocks/{parentId}/{clinicDate}`
Server-only lock `{ scheduleId, at }` (legacy: bare scheduleId string) so one parent cannot hold two active reservations on the same clinic date. Client writes are denied. A lock older than 2 minutes with no active reservation behind it is treated as stale and replaced by the next claim.

### Slot release
`POST /api/reservations/release { reservationId }` (owner or staff; reservation must be terminal) removes the reservation's holder. Client cancel/forfeit/expire paths call it after their status write; the `onReservationWrite` trigger, the Express listener, and claim-time pruning of terminal holders are backstops. Release is idempotent.

### `reservations/{reservationId}`
```js
{
  scheduleId, parentId,
  reservationCode,                 // 6-char alphanumeric
  queueNumber, originalQueueNumber, queuePosition,
  queueOrder, aheadOfYou, queueState, sortTimestamp,
  nearTurnSmsSent,                 // true after Near Turn push/in-app claimed for this ticket; SMS is gated per account (users/{uid}/nearTurnSms)
  slotReservedSmsSent,             // true after Confirmed Reservation SMS claimed
  penaltySmsSent: { [count]: true }, // late/moved SMS claimed per penaltyCount
  status: "reserved" | "waiting" | "checked_in" | "with_doctor" |
          "in_consultation" | "consultation_completed" | "cancelled" |
          "cancelled_by_clinic" | "forfeited" | "expired" | ...,
  childName, age, sex, concern,    // legacy mirrors (first selected child + shared concern)
  children: [                      // 1+ patients on this reservation (1 slot)
    { childId, childName, age, sex }
  ],
  source,                          // "walk_in" for secretary-created tickets
  createdBy,                       // secretary uid for walk-ins
  parentName, parentPhone,         // optional walk-in contact (E.164 phone); omitted if blank
  doctorNotes,
  checkedIn, createdAt, reservationCreatedAt,
  penaltyCount, lastPenalizedAt,
  becameCurrentTurnAt,             // ms; first penalize-eligible waiting ticket while queue is live
  penaltyTimerStartedAt, penaltyTimerExpiresAt, penaltyTimerClearedAt,
}
```

### `notifications/{parentId}/{notificationId}`
```js
{ title, body, type, severity, createdAt, read, reservationId?, branchId?, dedupeKey? }
```

### `auditLogs/{logId}`
```js
{ action, category, description, actorId, actorRole, timestamp, targetType, targetId, branchId }
```

### `systemConfiguration/{branchId}`
```js
{
  penaltyMoveBack: 2,              // 0–10; 0 = immediate forfeit on penalty
  defaultSlotCapacity: 30,         // fallback when a day is posted from the calendar
  penaltyGraceMinutes: 2,          // 0–5; wait after becoming current-turn before Penalize
  penaltyTimerMinutes: 15,         // 5–30; check-in deadline after first penalty
  sms: {
    nearingTurnAheadCount: 3,      // 1–10; at queue start, 0 < aheadOfYou <= this count fires NEARING_TURN SMS (once per reservation)
    templateSlotReserved: "...",   // placeholders: {date} {timeRange} {queueNumber} {doctor} {branch}
    templateSlotReservedActiveQueue: "...", // live queue booking: {queueNumber} {queuePosition}
    templateQueueStarted: "...",   // placeholders: {branch} {date}
    templateNearingTurn: "...",    // placeholders: {count} {queueNumber} {branch}
    templatePenalized: "...",      // placeholders: {queueNumber} {queuePosition} {branch} {minutes}
    templateForfeited: "...",      // placeholders: {queueNumber} {branch} {date}
    updatedAt: 0
  },
  updatedAt: 0
}
```
Each branch (Angeles, Magalang, …) has an independent node keyed by `branchConfigurations` push id. Secretary writes only `assignedBranchId`. TextBee API key stays in env (global). Legacy `systemConfiguration/queue` and `systemConfiguration/sms` are read-only seed sources.

## RTDB Security Rules Summary

| Node | Read | Write |
|------|------|-------|
| `users` (list) | Admin only | — |
| `users/{uid}` | Self, admin, doctor, secretary | Self (active status); active admin for others, never on a `role: "admin"` record; `role: "secretary"` only on a new record by an active admin; `admin`/`doctor` never from the client; `assignedBranch`/`assignedBranchId`/`mustChangePassword` by others: admin only; a doctor's `status` is server-only |
| `notifications/{uid}` | Own | Own (active); active admin for non-parent targets |
| `branchConfigurations` | All auth | Active admin |
| `schedules/{id}` | All auth | Secretary (own branch) or doctor (active); active admin may write only `branch` / `branchId` strings on an existing schedule (rename cascade) |
| `reservations` | Doctor, secretary, admin (read-only deviation), parent own | Parent own, doctor, secretary (active) |
| `bookingLocks`, `parentBookingCaps` | Own, doctor, secretary, admin | denied |
| `auditLogs` | Admin | Active admin or doctor (client-side writes; accepted forgery risk) |
| `doctorAlerts/{uid}` | Owner | Owner (history; nothing writes new alerts) |
| `adminAlerts/{uid}` | Owning admin | Owning active admin (mark read); Admin SDK writes alerts |
| `systemConfiguration/{branchId}` | Admin, doctor, parent; secretary own branch | Doctor; secretary own branch |
| `systemConfiguration/{branchId}/sms` | + parents | (same write as parent node) |
| `smsOtps`, `phoneVerifications`, `passwordResetLimits`, `emailVerificationLimits` | denied | denied (Admin SDK only) |

Rules file: `client/database.rules.json` is the single source of truth (`client/firebase.json` deploys it to the `main` database target; `client/database.demo.rules.json` mirrors it for the demo target). There is no repo-root copy. `client/tests/adminRoleRules.test.js` pins the admin/doctor split.

## Demo database

Demo accounts carry the Auth custom claim `isDemo: true`. The client (`getDb()` in `client/src/firebase/database.js`) and Cloud Functions (`client/functions/rtdbRouter.js`) send those accounts to a second Realtime Database, `{projectId}-demo`, with the same node names. Production rules reject `auth.token.isDemo == true`. Demo rules (`client/database.demo.rules.json`) reject everyone else. The demo doctor also has `demoOperator: true` and can call `resetDemoClinicDay` to clear one clinic date inside the demo database only.

Seed (does not write the default database):

```bash
cd client/functions
DEMO_ACCOUNT_PASSWORD=... DEMO_RTDB_URL=... node scripts/seedDemo.js
```

Create the `{projectId}-demo` database in the Firebase console before deploying rules or the demo triggers.


## Express API (`server/`, port 5000)

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/` | None | Health check |
| GET | `/api/health` | None | Health check |
| GET | `/api/vapid-public-key` | None | VAPID public key |
| POST | `/api/save-subscription` | Bearer Firebase ID token | Save Web Push subscription |
| POST | `/api/delete-subscription` | Bearer token | Remove subscription |
| POST | `/api/send-notification` | Bearer token or `x-push-secret` | Dispatch notification + push |
| POST | `/api/admin/delete-user` | Bearer admin ID token | Delete Auth user + RTDB profile (active admin only, any non-admin target) |
| POST | `/api/admin/update-user` | Bearer admin ID token | Update staff name/phone/branch (active admin only) |
| POST | `/api/admin/reset-secretary-password` | Bearer admin ID token | One-time temporary password for a secretary or doctor (active admin only) |
| POST | `/api/admin/create-doctor` | Bearer admin ID token | Create the Doctor (one-active-doctor rule) |
| POST | `/api/admin/doctor-status` | Bearer admin ID token | Deactivate / reactivate the Doctor (`{ uid, status }`) |
| POST | `/api/auth/resolve-identifier` | None | Resolve email or phone → account email for password login |
| POST | `/api/auth/password-reset/claim` | None | Consume 1 of 5 daily reset slots per email (Asia/Manila) before `sendPasswordResetEmail`; enforces 30s resend cooldown (`retryAfterSeconds` / `Retry-After` on 429); 403 `auth_denied` for doctor, secretary, and admin emails |
| POST | `/api/auth/email-verification/claim` | Bearer Firebase ID token | Claim 30s cooldown slot before `sendEmailVerification` |
| POST | `/api/auth/sms/send-otp` | None | Generate + SMS-deliver 6-digit OTP (textbee); 30s resend cooldown |
| POST | `/api/auth/sms/verify-otp` | None | Validate OTP → custom token (login) or verificationId (register) |

Listeners: `server/services/pushListeners.js` watches `reservations` and `schedules`.

### SMS (textbee.dev)
- Utility: `server/services/smsService.js` (mirrored in `client/functions/smsService.js`)
- Queue SMS events: `SLOT_RESERVED` (on Save Information / `patientInfoCompleted`; once via `slotReservedSmsSent`), `QUEUE_STARTED`, `NEARING_TURN` (at **queue start only**; patients-ahead from `systemConfiguration/{branchId}/sms`, default 3; fires when `0 < aheadOfYou <=` count; SMS once per parent account, ever, via `users/{uid}/nearTurnSms` transaction in `nearTurnSmsGuard.js` (push/in-app still once per reservation via `reservations/{id}/nearTurnSmsSent`); Secretary-editable per branch), `PENALIZED` (once per increment via `penaltySmsSent/{count}`), `FORFEITED`. TextBee credentials remain env-global.
- OTP store: `smsOtps/{phoneKey}` — bcrypt-hashed code, 5-minute `expiresAt`; **30s** resend cooldown; client R/W denied in rules
- Password reset cap: `passwordResetLimits/{emailKey}` — 5 claims per email per Asia/Manila day + **30s** `lastSentAt` cooldown; client R/W denied; Forgot Password and the admin's parent reset email share the same counter; staff are refused
- Email verification cooldown: `emailVerificationLimits/{uid}` — **30s** between sends; client R/W denied

## Cloud Functions (`client/functions/index.js`)

| Function | Trigger | Purpose |
|----------|---------|---------|
| `onReservationWrite` | RTDB `/reservations/{id}` onWrite | Push on reservation changes |
| `onScheduleWrite` | RTDB `/schedules/{id}` onWrite | Push on schedule/queue changes |
| `deleteUserAccount` | HTTPS callable | Active admin deletes Auth user + profile (incl. Doctor) |
| `updateUserAccount` | HTTPS callable | Active admin updates staff profile fields |
| `resetSecretaryPassword` | HTTPS callable | Active admin resets a secretary or doctor password (temporary password + `mustChangePassword`) |
| `evaluateSuspiciousAccounts` | Scheduled (20:00 Manila) | Flag no-show parents; alert active admins (`adminAlerts` + push) |
| `createDoctorAccount` | HTTPS callable | Admin creates the Doctor (one active doctor) |
| `setDoctorAccountStatus` | HTTPS callable | Admin deactivates / reactivates the Doctor |
| `testRTDBAccess` | HTTPS callable | Infrastructure test |
| `testFCMDelivery` | HTTPS callable | Push infrastructure test |

## Environment Variables

### `client/.env`
```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_DATABASE_URL=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_VAPID_KEY=
VITE_VAPID_PUBLIC_KEY=
VITE_API_URL=          # Production Express URL; empty = same-origin /api
```

### `server/.env`
```
PORT=5000
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:noreply@...
FIREBASE_PROJECT_ID=pediatric-clinic-queue-testing
FIREBASE_DATABASE_URL=https://...firebasedatabase.app
TEXTBEE_API_KEY=
# TEXTBEE_DEVICE_ID=
# TEXTBEE_WEBHOOK_SECRET=   # ≥20 chars; TextBee dashboard Webhooks signing secret
# GOOGLE_APPLICATION_CREDENTIALS=./serviceAccountKey.json
# FIREBASE_SERVICE_ACCOUNT={"type":"service_account",...}
# PUSH_DISPATCH_SECRET=
```

## Naming Conventions

| Area | Convention |
|------|------------|
| Components/pages | PascalCase (`Dashboard.jsx`) |
| Services/utils/hooks | camelCase (`queueEngine.js`) |
| Status strings | snake_case (`checked_in`, `not_started`) |
| Roles | lowercase (`parent`, `secretary`, `doctor`, `admin`) |
| Event constants | SCREAMING_SNAKE (`NOTIFICATION_EVENTS`, `QUEUE_STATES`) |
| Firebase nodes | camelCase (`branchConfigurations`, `auditLogs`) |
| CSS | Tailwind utilities inline |

## Key Service Files

| Service | Purpose |
|---------|---------|
| `queueEngine.js` | Queue order, recalculation, state |
| `reservationService.js` | Reservation lifecycle |
| `scheduleService.js` | Schedule CRUD, publish, queue start/pause |
| `branchConfigurationService.js` | Branch config, defaults |
| `notificationService.js` | Toast events, client notifications |
| `notificationCenterService.js` | Persistent notification center |
| `adminService.js` | Staff accounts, branch management |
| `auditLogService.js` | Audit trail |
| `pushService.js` | Web Push subscription API calls |
| `positionEventEngine.js` | ALMOST_NEXT / YOU_ARE_NEXT events |

## Queue Management Critical Path

1. Secretary creates schedule (draft) → publishes (assigned branch only)
2. Parent reserves → `createReservation()` → `queueNumber` assigned → `recalculateEntireQueue`
3. Secretary starts queue → `queueStatus: active`
4. Secretary scans QR / enters code → `checkInReservation()` → `checked_in`
5. Secretary sends to doctor → `sendToDoctor()` → `with_doctor` (blocked if consultation active)
6. Doctor completes → `completeConsultation()` → releases slot, unlocks queue
7. Penalties → `penalizeReservation()` shifts `sortTimestamp`, starts/keeps first penalty timer; expiry or move-back 0 forfeits
