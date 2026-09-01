# Reference — Schema, API, Config

Read when modifying Firebase data, server routes, or environment setup.

## RTDB Nodes

### `users/{uid}`
```js
{
  uid, name, email, phone,
  role: "parent" | "secretary" | "doctor" | "admin",
  status: "active" | "inactive",
  createdAt, updatedAt,           // epoch ms
  assignedBranch: "Angeles",       // secretaries only
  children/{childId}: {            // parent-saved child profiles
    childName, age, sex, createdAt
  },
  pushSubscriptions/{hash}: { endpoint, keys: { p256dh, auth } },
  notificationPermission: "default" | "granted" | "denied",
  inAppNotificationsEnabled: true,  // parents; toasts while app is open (default true)
  devicePushEnabled: true,          // parents; OS/web push; set after OS grant
  pushTokens/{key}: { token }      // legacy FCM cleanup path
}
```

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
  slotCapacity, lateLimit,         // default lateLimit: 3
  status: "draft" | "published" | "completed",
  queueStatus: "not_started" | "active" | "paused" | "closed" | "completed",
  queueStartedAt, publishedAt, completedAt,
  isReady, doctorId
}
```

### `reservations/{reservationId}`
```js
{
  scheduleId, parentId,
  reservationCode,                 // 6-char alphanumeric
  queueNumber, originalQueueNumber, queuePosition,
  queueOrder, aheadOfYou, queueState, sortTimestamp,
  status: "reserved" | "waiting" | "checked_in" | "with_doctor" |
          "in_consultation" | "consultation_completed" | "cancelled" |
          "forfeited" | "expired" | ...,
  childName, age, sex, concern,    // legacy mirrors (first selected child + shared concern)
  children: [                      // 1+ patients on this reservation (1 slot)
    { childId, childName, age, sex }
  ],
  doctorNotes,
  checkedIn, createdAt, reservationCreatedAt,
  penaltyCount, lateCount
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

### `systemConfiguration/queue`
```js
{ penaltyMoveBack: 2 }   // 1–10, spots penalty moves patient back
```

## RTDB Security Rules Summary

| Node | Read | Write |
|------|------|-------|
| `users` | Admin all; user own | Own profile (active status) |
| `notifications` | Parent own | Parent own |
| `branchConfigurations` | All auth | Admin |
| `schedules` | All auth | Doctor, secretary |
| `reservations` | All auth | Parent, doctor, secretary (active) |
| `auditLogs` | Admin | Admin, doctor, secretary |
| `systemConfiguration` | Admin, doctor, secretary | Admin |

Rules file: `database.rules.json` (repo root).

## Express API (`server/`, port 5000)

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/` | None | Health check |
| GET | `/api/health` | None | Health check |
| GET | `/api/vapid-public-key` | None | VAPID public key |
| POST | `/api/save-subscription` | Bearer Firebase ID token | Save Web Push subscription |
| POST | `/api/delete-subscription` | Bearer token | Remove subscription |
| POST | `/api/send-notification` | Bearer token or `x-push-secret` | Dispatch notification + push |

Listeners: `server/services/pushListeners.js` watches `reservations` and `schedules`.

## Cloud Functions (`client/functions/index.js`)

| Function | Trigger | Purpose |
|----------|---------|---------|
| `onReservationWrite` | RTDB `/reservations/{id}` onWrite | Push on reservation changes |
| `onScheduleWrite` | RTDB `/schedules/{id}` onWrite | Push on schedule/queue changes |
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

1. Doctor creates schedule (draft) → publishes
2. Parent reserves → `createReservation()` → `queueNumber` assigned → `recalculateEntireQueue`
3. Doctor starts queue → `queueStatus: active`
4. Secretary scans QR → `checkInReservation()` → `checked_in`
5. Secretary sends to doctor → `sendToDoctor()` → `with_doctor` (blocked if consultation active)
6. Doctor completes → `completeConsultation()` → releases slot, unlocks queue
7. Penalties → `penalizeReservation()` shifts `sortTimestamp`, may forfeit at `lateLimit`
