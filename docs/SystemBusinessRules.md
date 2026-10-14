# System Business Rules & Operations

This document is the highest-level business specification for the Pediatric Clinic Queue Management System. It describes how the core modules—User, Branch, Schedule, Reservation, Queue, and Notification—interact to support the clinic's overarching business processes and workflows.

---

## 1. Overview
The Pediatric Clinic Queue Management System is designed to digitize and orchestrate the flow of patients through a multi-branch physical clinic. The primary business goals are to eliminate chaotic physical waiting rooms, enforce strict capacity and consultation rules, provide real-time transparency to parents regarding their turn, and empower clinic staff with isolated, branch-specific control over operations.

---

## 2. System Actors

* **Parent / Guardian**: The end-user who consumes clinic services. They browse available schedules, reserve slots, monitor their dynamic queue position remotely, and bring the patient to the clinic for QR validation.
* **Secretary**: The frontline branch manager. They manage open clinic days for their assigned branch (hold/close/resume, capacity overrides), start the clinic queue, physically verify patient arrivals (Check In), enforce attendance policies (Penalize, including walk-ins already marked checked-in), control the flow of patients into the doctor's room (Send to Doctor), and can pause/resume/close/end the live session from Manage Queue.
* **Doctor**: The primary medical provider. They can manage open clinic days for any branch (hold/close/resume, capacity overrides), start the clinic queue, control the live consultation room (pause/resume/close queue via Queue Control — Secretary can trigger the same four session actions), add optional consultation notes, and finalize medical visits (Complete Consultation).
* **System Admin**: A separate, non-clinical role (`role: "admin"`, no `assignedBranch`) with its own `/admin` module: Dashboard, Users, Branches, Audit Logs, and Reports. One or two admins may exist. Admin accounts are created only with the Admin SDK (`docs/AdminBreakGlass.md`); the admin cannot change their own profile or password in the app (no admin Profile page, and Forgot Password is refused for admin emails).
* **Doctor**: There is exactly one active doctor system-wide. The doctor runs schedules, the queue, consultations, and Reports (`/doctor/*`) and no longer has staff, branch, or audit-log management pages.

---

## 3. Core Business Principles
* **One Reservation Rule**: A parent may only hold one active reservation per clinic date to prevent slot hoarding.
* **Clinical Isolation**: Only one patient may be in active consultation at any given time.
* **Centralized Order**: Queue turn order is mathematically managed by a centralized engine; it cannot be arbitrarily reordered by staff outside of official penalty protocols.
* **Branch Isolation**: Operations are strictly segregated by physical location. A Secretary at Branch A cannot manage the queue at Branch B.
* **Data Permanence**: Reservations and historical records are never physically deleted from the system, ensuring an immutable audit trail of clinic activity.

---

## 4. Overall Patient Journey

The complete business workflow follows this sequence:

1. **Schedule Published** → The Secretary (assigned branch) or Doctor (any branch) opens a clinic day (and later starts the queue).
2. **Parent Reserves** → Parent books an available slot, securing a permanent Ticket Number.
3. **Check-In Requested** → (Optional) Secretary pings the parent to approach the desk.
4. **Secretary Checks In** → Parent arrives at the physical clinic and the Secretary scans their QR code (or enters the 6-character code).
5. **Patient Waits** → Patient waits in the physical lobby while monitoring their live Queue State.
6. **Secretary Sends to Doctor** → The Secretary permits the #1 checked-in patient to enter the consultation room.
7. **Consultation** → The Doctor examines the patient.
8. **Doctor Completes Consultation** → The Doctor finalizes the visit, clearing the room.
9. **Reservation History** → The reservation is archived permanently.

---

## 5. Reservation Workflow
Reservations act as the gateway into the Queue Engine. 
* **Creation Requirements**: To successfully create a reservation, the following rigid conditions must be met:
  1. The target schedule must be `published` and accepting bookings.
  2. The schedule must have active slot capacity available.
  3. The parent must not already have an active, non-terminal reservation for that specific clinic date.
*(Note: Branch clinic operating hours are enforced when the Secretary or Doctor posts a day. Posting goes through the server (`POST /api/schedules/publish`), which rejects past dates and, for today, any time at or after that branch's closing time for the weekday (Asia/Manila). See `docs/ReservationRules.md` → Publish time rules. The Reservation System simply trusts the already-validated Published Schedule.)*
* **Queue**: Once created, a reservation is instantly injected into the Queue Engine pipeline where it receives a permanent `queueNumber` and a dynamic `queueOrder`.
* **Consultation**: A reservation must traverse from `reserved` -> `checked_in` -> `with_doctor` -> `consultation_completed`.
* **History**: Upon reaching a terminal state (completed, cancelled, or forfeited), it drops out of the active queue and moves to the historical ledger.

---

## 6. Queue Workflow
The Queue Engine governs the flow of active reservations.
* **Queue Order**: The queue initially follows a strict First-In, First-Out (FIFO) pipeline based on creation time.
* **Dynamic Ordering vs Permanent Identity**: Every reservation receives a permanent Ticket Number (`queueNumber`) that never changes. However, official penalty actions dynamically adjust the active `queueOrder` (the relative line position) without altering the original Ticket Number.
* **Penalties**: If a patient is absent when called (after the branch grace period), the Secretary applies a penalty. This shifts their internal sorting timestamp backward by that branch’s Penalty Move-Back count (`systemConfiguration/{branchId}/penaltyMoveBack`), dynamically moving them behind other waiting patients, and starts a penalty timer (`penaltyTimerMinutes`, default 15). Setting the Penalty Move-Back count to 0 results in an automatic forfeit for the parent. If the timer expires without QR validation, the reservation is forfeited automatically.
* **Consultation Lock**: The Queue Engine forcefully prevents any queue progression into the Doctor's room if an active consultation is already occurring.
* **Queue Recalculation**: Any business event (check-in, penalty, cancellation, completion) triggers a full queue recalculation, updating UI states (like "You're Next") across the entire system instantly.

---

## 7. Consultation Workflow
Consultations are the bottleneck and ultimate goal of the clinic workflow.
* **Secretary**: Acts as the gatekeeper. They evaluate the queue order and permit the highest-ranked `checked_in` patient to enter the room.
* **Doctor**: Controls the exit. They finalize the medical notes and formally close the consultation.
* **Queue Engine**: Enforces the rigid business rule that the Secretary cannot open the gate until the Doctor has formally closed the previous consultation.

---

## 8. Slot Management
Slot availability strictly dictates clinic capacity.
* **Consumption**: Creating a reservation immediately consumes 1 slot from the schedule's defined limit.
* **Release**: If a parent cancels, or if a secretary permanently forfeits a patient, the slot is released back to the public pool.
* **Completed Consultations**: When a Doctor finishes a consultation, the slot is immediately released back to the pool, allowing a new walk-in or parent to book if capacity permits.

---

## 9. Branch Management
Branches represent the physical infrastructure of the business.
* **Configuration**: The System Admin defines Branch Names, Clinic Addresses, and operational metadata.
* **Secretary Assignment**: Secretaries are strictly bound to a single Branch Configuration, ensuring they only see data relevant to their physical location.
* **Schedule Creation**: Secretaries publish clinic days for their assigned branch (publish range, copy previous week, or post a day). Doctors may publish or close days for any branch.

---

## 10. User Management
User Management ensures role-based access control.
* **System Admin**: Manages users from `/admin/users`. Creates Secretary accounts (assigned to a Branch) and the **Doctor** account. Client-supplied `admin` is always rejected, so there is no Admin option in Add Staff. Deactivates and reactivates Secretary, Parent, and Doctor accounts (`deactivationSource: admin` meaning administrative deactivation) and may permanently delete Secretary, Parent, and Doctor accounts. Admin accounts never appear in the Users list and cannot be deactivated or deleted in the app (an admin can never act on themselves, so the last active admin is always kept). Historical reservations, sessions, and audit records are never physically deleted.
* **One active doctor**: The admin may create a Doctor only when no active doctor exists (`role: "doctor"`, `status: "active"`, not `isDeleted`); deactivated or archived doctors do not count. The UI disables the Doctor option with "Deactivate the current doctor first.", and the server enforces it again: `createDoctorAccount` (Cloud Function callable) and `POST /api/admin/create-doctor` (Express mirror) check, take a short-lived lock at `systemLocks/doctorProvisioning`, re-check, then create the Auth user and profile. Concurrent requests get a 409. **Reactivating** a doctor follows the same rule (same lock, same 409 and message). The doctor profile has no `assignedBranch`.
* **Doctor lifecycle (Admin only)**: Doctor status changes go through the server only — callable `setDoctorAccountStatus` and `POST /api/admin/doctor-status` (shared `client/functions/doctorStatusRuntime.js`). RTDB rules refuse client writes to a doctor's `status`. Deactivation revokes the doctor's refresh tokens, and an open doctor session is signed out immediately (AuthContext watches `status`). Permanent delete uses `deleteUserAccount` / `POST /api/admin/delete-user`: it removes the Auth user, `users/{uid}`, and `notifications/{uid}`. Schedules keep their `doctorId` string, audit logs keep their `actorName` snapshot, and `doctorAlerts/{uid}` stays as history. A signed-in doctor whose profile is deleted is signed out. Deactivate and delete are refused (409) while a patient is `with_doctor`/`in_consultation` on a session that is still running, because only the doctor can complete a consultation. Only an **active admin** can deactivate, reactivate, or delete a doctor (403 otherwise). Each action writes an audit entry with `actorRole: "admin"` (`USER_CREATED`, `USER_DEACTIVATED`, `USER_ACTIVATED`, `USER_DELETED`) including the doctor's name/email snapshot. *Deviation:* the original Phase 3 plan said "doctor cannot be deleted in-app"; this was reversed before Phase 2.
* **No active doctor**: Secretaries can still publish days, start the queue, check in, and send a patient to the doctor, and parents can still reserve. Nobody can complete a consultation until a doctor is created or reactivated, so the secretary should end the session. Newly published days have no `doctorId`; SMS falls back to "your doctor".
* **Secretary**: Staff accounts created by the System Admin.
* **Parent**: Self-registering consumer accounts that authenticate via the public-facing app. New parents must verify their **phone number via SMS OTP** before account creation, then verify their email and create at least one child profile before entering the parent portal. Login uses a single **Email or Phone Number** field plus **Password** (phone is resolved to the account email server-side). Existing parents without that onboarding flag are grandfathered. Parents may self-deactivate (`status: inactive`, `deactivationSource: self`); logging in reactivates the account. Parents may soft-delete their account: Firebase Auth is revoked, the profile is marked `isDeleted`, and historical queue/appointment records are retained for analytics. Active reservations are cancelled on deactivate and forfeited on delete so they do not hold clinic slots.
* **Password reset**: Forgot Password and Admin “Reset Password” (user management) share a **5-request daily cap per email**, using server time in **Asia/Manila**. The 6th request that day is blocked with a “try again tomorrow” message. Completing a reset from the email link does not count. This is separate from the SMS OTP resend cooldown. The reset claim endpoint refuses emails that belong to a `role: "admin"` account (403); admin credentials are reset with the Admin SDK only.
* **Dashboard “Active Staff”**: Counts only active `doctor` and `secretary` accounts (excludes admins, parents, inactive, and deleted accounts).

---

## 11. Notification Workflow
Notifications provide real-time transparency, reducing physical clinic congestion.
* **Reservation Confirmation**: SMS (+ Notification Center) when a parent successfully reserves a slot, including date, clinic hours, queue number, doctor, and branch.
* **Queue Updates**: When the queue starts, parents who are approaching but not already first (`0 < aheadOfYou <=` the branch Near Turn threshold; default 3 via `systemConfiguration/{branchId}/sms`) get the `NEARING_TURN` alert once per reservation (`nearTurnSmsSent`). The Near Turn **SMS** goes to each parent account only once, ever (`users/{parentId}/nearTurnSms`); later reservations, other children, and re-queues after a penalty do not re-send it. Later line movement does not re-send it. Also pings when state shifts to "Almost Next" or "You're Next", or when the Secretary requests they approach the desk.
* **Consultation Updates**: Confirms when they enter and exit the consultation room.
* **Penalty Updates**: Alerts parents if they are penalized for absence (including SMS that the countdown has started) or permanently forfeited for not checking in on time.
* **Schedule Updates**: Informs parents when a reservation schedule is published (once per publish batch), when the queue starts, pauses, closes, and when the session ends. Queue start also sends SMS via textbee.dev.
* **SMS Authentication**: Parents may sign in with a 6-digit OTP delivered by textbee; OTP records live under `smsOtps` (Admin SDK only) and expire after 5 minutes.
* **Suspicious account alerts (doctor)**: When Rules A/B/C detect repeated reservation no-shows (past clinic dates without QR check-in), the system flags the parent, writes an audit log, and notifies the doctor via Web Push plus an in-app toast fallback (`doctorAlerts`). The system never auto-deactivates; the doctor reviews and may dismiss or deactivate.

---

## 11b. Suspicious Account Detection
QR check-in is the proof that a reserved slot was attended. A past reservation with no QR validation (and not cancelled by the parent or clinic) counts as a **no-show**. Parents may hold up to two upcoming reservations; the detector scores each past reservation and flags abuse patterns:

* **Rule A — Consecutive no-shows**: Last 3 past scored reservations were all no-shows.
* **Rule B — No-show rate**: In the last 30 Manila days, no-show rate ≥ 60% with at least 4 past reservations.
* **Rule C — Multi-date zero attendance**: In the last 14 Manila days, reservations on ≥ 3 distinct clinic dates and none were QR-validated.

Thresholds live in `suspiciousAccountConfig.js` (client + Cloud Functions). Evaluation runs when a reservation becomes `forfeited`/`expired` and on a nightly Manila 20:00 job. Flagged accounts store `users/{uid}/suspiciousFlag` and appear in Audit Logs with Deactivate / Dismiss actions.

---

## 12. Rule Priority Hierarchy

When conflicting business operations arise, the system obeys this hierarchy:

1. **Patient Safety & Privacy (Highest)**: Role restrictions prevent unauthorized access to medical queues or data.
2. **Consultation Integrity**: The one-patient-at-a-time rule overrides all queue logic.
3. **Reservation Integrity**: Double-booking prevention and strict slot capacity limits override creation requests.
4. **Queue Integrity**: First-In, First-Out (with penalty adjustments) dictates order.
5. **Notification Consistency (Lowest)**: Alerts are secondary to database integrity and will silently drop if duplicated to prevent spam.

*Why this order?* The system prioritizes legal and physical clinic realities (privacy, room capacity, slot limits) over algorithmic sorting and communication tools.

---

## 13. System-wide Restrictions
* **One Active Consultation**: Only one patient may be `with_doctor` at a time.
* **Secretary Branch Isolation**: A Secretary can only view and manage the queue for their assigned branch.
* **Schedule Ownership**: Secretary and Doctor may hold, close, resume, adjust capacity, and start clinic schedules. Secretaries are locked to their assigned branch; Doctors may operate on any branch. The Doctor also retains live Queue Control (pause/resume/close) and Complete Consultation.
* **Admin Exclusivity**: Only the System Admin can create or modify staff accounts and branches, and read the full audit log (filterable by actor role, including Admin).
* **Reports**: Doctor and Admin Reports share one filter bar: branch chips (default **All**) and an inclusive From/To date range with presets **All Time** (default), **Today**, **This Week**, **This Month**, **This Year**, Clear, and From ≤ To validation. Presets are calendar periods in **Asia/Manila**; weeks run **Sunday to Saturday** (the app-wide calendar convention). Picking a preset fills From/To; editing a date by hand clears the preset highlight. Charts, totals, tables, and Session History all follow the range. Only the Date range filter shows an icon. **Session History** (completed sessions, newest first, paginated) is shown to the Doctor and the Admin. On both, clicking a row (or Enter/Space) opens the same **read-only** side panel with that session's reservations (status filter chips only, no actions). *Deviation:* the original role split kept session history Doctor-only; admin read-only access was added in the Phase 1 follow-ups.
* **Parent Immutability**: Parents cannot modify or cancel reservations once they are physically `checked_in`.

---

## 14. Cross-Module Interactions
* **Branch → Schedule → Reservation → Queue**: The Branch Configuration serves as the foundation of the system. It defines the Clinic Hours, which govern Schedule Creation. The Schedule dictates Reservation Availability (capacity and time limits), which in turn feeds patient data into the Queue Operations.
* **Branch → User**: Users (Secretaries) are assigned to branches, isolating their dashboards to a specific physical location.
* **User → Reservation**: Parent users own reservations.
* **Schedule → Reservation & Queue**: Schedules define the timeframe and capacity limits for reservations, and dictate when the Queue Engine is allowed to turn "Active".
* **Reservation → Queue**: The Reservation provides the data payload; the Queue provides the mathematical sorting order.
* **Queue → Consultation**: The Queue dictates *who* is eligible for consultation.
* **Consultation → Notification**: Transitioning into or out of consultation triggers the Notification Engine to alert the parent.

---

## 15. Regression Protection Checklist
Future system modifications must ensure the following business behaviors remain unbroken:

- [ ] ✓ Only one active consultation may exist at any time.
- [ ] ✓ Queue penalties must never bypass the consultation lock.
- [ ] ✓ Completed consultations immediately release schedule slots.
- [ ] ✓ Secretary Branch Isolation remains enforced.
- [ ] ✓ Permanent Ticket Numbers never change.
- [ ] ✓ Queue recalculation never changes Ticket Numbers.
- [ ] ✓ Reservation History remains immutable.
- [ ] ✓ Queue Engine remains perfectly synchronized with Reservation state transitions.
- [ ] ✓ Notification delivery remains bound exclusively to Parent accounts.
- [ ] ✓ User role permissions strictly prevent Parents from accessing staff routes and vice versa.
- [ ] ✓ Updates to Branch Management configurations instantly propagate to Secretary Dashboards and Parent UI cards.
