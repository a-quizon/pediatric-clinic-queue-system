---
name: pediatric-clinic-queue-system
description: >-
  Guides development on the Pediatric Clinic Queue Management System — a React +
  Firebase RTDB capstone app with queue engine, multi-role dashboards, Web Push
  notifications, and Capacitor Android. Use when working in this repo, modifying
  queue/reservation/notification logic, adding role-based features, Firebase
  schema changes, push server, or Capacitor mobile builds.
---

# Pediatric Clinic Queue System

Capstone app that digitizes pediatric clinic patient flow across branches. Parents reserve slots and monitor queue position; secretaries check in and gate consultations; doctors manage schedules and consultations; admins manage staff and branches.

## Before You Code

1. **Read authoritative docs** in `docs/` before touching business logic:
   - `docs/SystemBusinessRules.md` — actors, journeys, cross-module rules
   - `docs/QueueEngineRules.md` — FIFO, penalties, recalculation, consultation lock
   - `docs/ReservationRules.md` — lifecycle, statuses, slot management
   - `docs/NotificationRules.md` — events, push, deduplication, role restrictions
2. **Business logic lives in services**, not components. UI delegates to `client/src/services/`.
3. **JavaScript only** — no TypeScript. Match existing `.js`/`.jsx` patterns.

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | React 19, Vite 8, React Router 7, Tailwind CSS 4 |
| Database | Firebase Realtime Database (not Firestore, not Supabase) |
| Auth | Firebase Auth (email/password; phone verified via SMS OTP before email on register; login = email-or-phone + password) |
| Push API | Express 5 (`server/`) + Firebase Cloud Functions (`client/functions/`) |
| Push delivery | Web Push + VAPID (`/sw.js`), not FCM |
| Mobile | Capacitor 8 (`android/`) |
| Hosting | Firebase Hosting (`client/dist`) |

Firebase projects: `pediatric-clinic-queue-system` (prod), `pediatric-clinic-queue-testing` (staging).

## Directory Map

```
client/src/
  components/   # Role-scoped UI (admin/, doctor/, parent/, secretary/, common/)
  context/      # AuthContext.jsx
  firebase/     # auth.js, database.js, firebaseConfig.js, messaging.js
  hooks/        # useAuth, useLogout, useReportsData, etc.
  pages/        # Route pages by role
  routes/       # AppRoutes, ProtectedRoute, RoleRoute, VerifiedRoute
  services/     # ALL business logic — start here
  utils/        # constants, authErrors, passwordUtils, etc.
server/         # Express push server (port 5000)
client/functions/ # RTDB onWrite triggers for push
docs/           # Authoritative business rules
database.rules.json  # RTDB security rules (repo root)
```

## Architecture

```
UI (pages/components)
  → services/ (reservationService, queueEngine, scheduleService, notificationService, …)
    → Firebase RTDB
  → server/ or Cloud Functions (push dispatch only)
```

- **State:** `AuthContext` + Firebase `onValue` listeners. No Redux/Zustand/React Query.
- **Dev proxy:** Vite proxies `/api` → `localhost:5000` (`client/vite.config.js`).
- **HTTP:** Use native `fetch` (not axios — listed but unused).

### Critical Engines

| File | Responsibility |
|------|----------------|
| `services/queueEngine.js` | `queueOrder`, `aheadOfYou`, `queueState`, `recalculateEntireQueue` |
| `services/queueEligibilityService.js` | Who can be sent to doctor |
| `services/reservationService.js` | Reservation CRUD and lifecycle |
| `services/notificationService.js` | Toasts + event constants |
| `services/notificationCenterService.js` | Persistent parent notifications |
| `server/services/notificationEngine.js` | Server-side push on RTDB changes |
| `client/functions/pushRuntime.js` | Cloud Functions push (keep in sync with server engine) |

## Roles & Routing

| Role | Path | Email verified? |
|------|------|-----------------|
| parent | `/parent/*` | Required (`VerifiedRoute`) plus `OnboardingRoute` (`onboardingComplete`) |
| secretary | `/secretary/*` | No |
| doctor | `/doctor/*` | No |
| admin | `/admin/*` | No |

Guard chain: `ProtectedRoute` → `VerifiedRoute` (parents) → `OnboardingRoute` (parents) → `RoleRoute`.

Entry points: `client/src/routes/AppRoutes.jsx`, `client/src/context/AuthContext.jsx`.

## Core Invariants (Never Break)

1. **One consultation at a time** — enforced in queue engine, eligibility service, and secretary UI.
2. **Permanent vs dynamic queue numbers** — `queueNumber` never changes; `queueOrder`/`sortTimestamp` change with penalties.
3. **One active reservation per parent per clinic date.**
4. **Secretary branch isolation** — secretaries only see `assignedBranch` (default fallback: `"Angeles"`).
5. **One active doctor** — `adminService.createStaffAccount()` rejects a second active doctor.
6. **Parents only get persistent notifications** — staff get local toasts only.
7. **No physical deletes** — reservations and audit records are permanent.
8. **Parent cannot cancel after check-in.**
9. **Slot counting** — only active statuses consume slots; terminal states release them.

## Reservation Lifecycle

```
reserved → checked_in → with_doctor → consultation_completed
         ↘ cancelled / forfeited / expired (terminal)
```

Any state change that affects queue position must call `recalculateEntireQueue()` from `queueEngine.js`.

## Local Development

```bash
# Terminal 1 — frontend (from repo root)
npm run dev

# Terminal 2 — push server (optional, for closed-browser push in dev)
npm run server:dev

# Generate VAPID keys once
cd server && npm run generate-vapid
```

Copy env templates: `client/.env.example`, `server/.env.example`, `client/functions/.env.example`.

Key client vars: `VITE_FIREBASE_*`, `VITE_VAPID_PUBLIC_KEY`, `VITE_API_URL` (empty = same-origin `/api`).

Server push listeners require `serviceAccountKey.json` or `FIREBASE_SERVICE_ACCOUNT` env var.

## Common Workflows

### Add a parent-facing feature
1. Page under `client/src/pages/parent/`
2. Route in `AppRoutes.jsx` under `/parent`
3. Logic in appropriate `services/` file
4. If queue-affecting → `recalculateEntireQueue()`
5. If parent notification → add to `NOTIFICATION_EVENTS` in client + server engine

### Add a notification type
1. `NOTIFICATION_EVENTS` + `NOTIFICATION_CONFIG` in `notificationService.js`
2. Mirror in `server/services/notificationEngine.js`
3. Mirror in `client/functions/pushRuntime.js` if needed
4. Update `docs/NotificationRules.md`

### Admin staff creation
`adminService.createStaffAccount()` uses a secondary Firebase app so admin stays logged in.

### Android (Capacitor)
```bash
cd client && npm run build
npx cap sync android   # uses client/capacitor.config.json (webDir: dist)
```
**Do not use root `capacitor.config.json`** — it points to `www`, not `dist`.

## Deployment

```bash
cd client && npm run build
firebase use staging          # or default for production
firebase deploy --only hosting
firebase deploy --only functions
firebase deploy --only database   # rules from repo-root database.rules.json
```

No CI/CD in repo. No automated tests — use manual regression checklists in `docs/`.

## Gotchas

| Issue | Detail |
|-------|--------|
| Dual push paths | Express listeners (dev) + Cloud Functions (prod) — keep engines in sync |
| `rollingValidationService.js` | Deprecated no-op — rolling windows removed |
| Legacy FCM | `messaging.js` returns null; Web Push via `/sw.js` |
| Firebase rules location | `database.rules.json` at repo root, not in `client/` |
| AuthContext migration | Auto-adds missing `status`, `createdAt`, `assignedBranch`, parent `onboardingComplete` (legacy = true) on login |
| Capacitor config | Client config (`dist`) is correct; root config (`www`) is stale |

## File Sync Checklist (notifications / queue changes)

- [ ] `client/src/services/` (primary logic)
- [ ] `server/services/notificationEngine.js` (if notification-related)
- [ ] `client/functions/pushRuntime.js` (if notification-related)
- [ ] `docs/*.md` (if business rules changed)
- [ ] `database.rules.json` (if schema or access changed)

## Additional Reference

- RTDB schema, API endpoints, env vars: [reference.md](reference.md)
- Business rules: `docs/` folder
