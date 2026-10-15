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

Capstone app that digitizes pediatric clinic patient flow across branches. Parents reserve slots and monitor queue position; secretaries and doctors publish clinic days, start the floor (check-in, penalties, send-to-doctor), and configure per-branch queue/SMS rules; doctors also start queues, control the live session, and complete consultations. A separate System Admin role (`/admin`) manages staff, branches, audit logs, and clinic-wide reports.

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
client/database.rules.json       # RTDB security rules (single source; deployed by client/firebase.json)
client/database.demo.rules.json  # Demo database rules (mirror of the main rules)
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
| doctor | `/doctor/*` (Dashboard, Queue, Schedules, Reports, Profile) | No |
| admin | `/admin/*` (Dashboard, Users, Branches, Audit Logs, Reports — no Profile; `/admin/profile` → `/admin`) | No |

Guard chain: `ProtectedRoute` → `VerifiedRoute` (parents) → `OnboardingRoute` (parents) → `RoleRoute`.
Admin accounts are Admin SDK only (`server/scripts/create-admin.js`, staging-guarded). Admins cannot edit their own profile or password in-app; the password-reset claim endpoint refuses admin emails. Reset emails are parents-only: the claim also refuses doctor and secretary emails, and the admin resets those with a temporary password (`resetSecretaryPassword` accepts secretary and doctor targets, sets `mustChangePassword`; forced change at `/{role}/change-password` via `MustChangePasswordRoute`).

Entry points: `client/src/routes/AppRoutes.jsx`, `client/src/context/AuthContext.jsx`.

## Core Invariants (Never Break)

1. **One consultation at a time** — enforced in queue engine, eligibility service, and secretary UI.
2. **Permanent vs dynamic queue numbers** — `queueNumber` never changes; `queueOrder`/`sortTimestamp` change with penalties.
3. **One active reservation per parent per clinic date.**
4. **Secretary branch isolation** — secretaries only see `assignedBranch` (default fallback: `"Angeles"`).
5. **One active doctor** — the Admin may create or reactivate a Doctor only when no other doctor is active (UI disables the option; server re-checks under a `systemLocks/doctorProvisioning` lock). Doctor status changes and deletes are server-only and admin-only, and are refused while a consultation is live.
6. **Parents only get persistent Notification Center records** — staff get local toasts; active System Admins additionally get a narrow `SUSPICIOUS_ACCOUNT` Web Push / `adminAlerts` exception for abuse flags (link `/admin/audit-logs`). Doctors get no push.
7. **No physical deletes** — reservations and audit records are permanent.
8. **Parent cannot cancel after check-in.**
9. **Slot counting** — only active statuses consume slots; terminal states release them.
10. **Admin / Doctor role split** — enforced at UI, server, and rules. Admin-only: user management runtimes (active admin = `role: "admin"`, `status: "active"`, not `isDeleted`), `users` list read, other-user profile writes, `branchConfigurations` write, `auditLogs` read. Admin is never clinical staff: no reservation claim/release/cancel/write, no `systemConfiguration` writes, no clinical push. Documented deviations: admin reads reservations/locks/caps (reports), client-side audit writes, admin may write only `schedules/{id}/branch|branchId` (branch rename). Never reintroduce an `admin || doctor` check.

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
`adminService.createStaffAccount()` (Admin Users → Add Staff) creates **Secretary** accounts via a secondary Firebase app so the admin stays logged in. `role: "doctor"` delegates to `createDoctorAccount()`, which uses `POST /api/admin/create-doctor` (Express) with fallback to the `createDoctorAccount` callable. Both share `client/functions/createDoctorAccountRuntime.js` (one-active-doctor check, lock, re-check, audit with `actorRole: "admin"`). There is never an Admin option.

### Admin doctor lifecycle
- **Deactivate / reactivate**: `adminService.toggleUserStatus()` routes doctor targets to `setDoctorAccountStatus()` → `POST /api/admin/doctor-status` (Express) with fallback to the `setDoctorAccountStatus` callable; shared runtime `client/functions/doctorStatusRuntime.js`. Reactivation uses the same lock and 409 as creation. Deactivation revokes refresh tokens. RTDB rules block client writes to a doctor's `status`.
- **Delete**: `deleteUserAccount()` → `deleteUserAccountRuntime.js` (`deleteDoctorAccount`): active admin only, removes Auth user + `users/{uid}` + `notifications/{uid}`, keeps schedules' `doctorId`, audit snapshots, and `doctorAlerts/{uid}`.
- Shared helpers live in `client/functions/doctorAccountShared.js` (active-admin check, lock, live-consultation check, admin audit writer). Admin targets are never deactivated or deleted in-app.
- Admin accounts are listed in Admin → Users (Admin role filter via `utils/userListFilters.js`, "You" marker on the own row) but get no row actions (`getUserRowActions` in `utils/adminUserManagementPolicy.js`). RTDB rules (`users/$uid/.write`) also block every client, including the owner, from removing an admin profile or changing its `role`, `status`, or `isDeleted`.
- `deleteUserAccount` (all targets), `updateUserAccount`, and `resetSecretaryPassword` also call `assertActiveAdmin`. `server/routes/admin.js` only wraps these shared runtimes, so Express and Functions stay identical. Client gate: `utils/adminUserManagementPolicy.js`.

### Suspicious-account alerts
`client/functions/suspiciousAccountRuntime.js` flags the parent (transaction on `users/{id}/suspiciousFlag`), writes the audit entry, then `notifyAdmins` writes `adminAlerts/{adminUid}` and calls `sendPushToAdmin` for every active admin. Cloud Functions use the defaults; the Express engine (`server/services/notificationEngine.js`) reuses the same runtime with `{ db, sendPush }` injected. The client toast fallback lives in `NotificationObserver.jsx` (admins only).

### Reports
Doctor and Admin Reports share `useReportFilters` plus `components/reports/*`: branch chips default to **All**, the date range is inclusive From/To with presets **All Time** (default), Today, This Week (Sunday–Saturday), This Month, This Year, built in `utils/reportDateRange.js` (Asia/Manila days). Editing a date clears the preset. Only the Date range filter has an icon. Session rows come from `utils/reportSessions.js`. On both Doctor and Admin, Session History rows open the shared read-only `components/reports/SessionReservationsDrawer.jsx` (row keyboard handling in `utils/sessionRowInteraction.js`).

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
firebase deploy --only database   # rules from client/database.rules.json (+ demo target)
```

No CI/CD in repo. Unit tests: `cd client && npm test` (node:test, includes static rules tests). Role/rules deploys follow `docs/RoleMigrationChecklist.md` (Admin separation checklist).

## Gotchas

| Issue | Detail |
|-------|--------|
| Dual push paths | Express listeners (dev) + Cloud Functions (prod) — keep engines in sync |
| `rollingValidationService.js` | Deprecated no-op — rolling windows removed |
| Legacy FCM | `messaging.js` returns null; Web Push via `/sw.js` |
| Firebase rules location | `client/database.rules.json` and `client/database.demo.rules.json` only (no repo-root copy) |
| AuthContext migration | Auto-adds missing `status`, `createdAt`, `assignedBranch`, parent `onboardingComplete` (legacy = true) on login |
| Capacitor config | Client config (`dist`) is correct; root config (`www`) is stale |

## File Sync Checklist (notifications / queue changes)

- [ ] `client/src/services/` (primary logic)
- [ ] `server/services/notificationEngine.js` (if notification-related)
- [ ] `client/functions/pushRuntime.js` (if notification-related)
- [ ] `docs/*.md` (if business rules changed)
- [ ] `client/database.rules.json` + `client/database.demo.rules.json` (if schema or access changed)

## Additional Reference

- RTDB schema, API endpoints, env vars: [reference.md](reference.md)
- Business rules: `docs/` folder
