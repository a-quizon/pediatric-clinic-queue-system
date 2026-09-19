# Pediatric Clinic Queue Management System  
## Full System Description & Business Rules

**Purpose of this document:** A self-contained description of what the system is, how it works, and the business rules that govern it. Written so a reader (or another AI) with **zero prior context** on the codebase can understand the entire product and plan future features.

**Source of truth:** Derived from the live codebase (`client/src/services/`, `server/`, `client/functions/`, `database.rules.json`, routes/pages) and the authoritative specs in `docs/`. Where older doc sections conflict with code, **code behavior wins** and is noted explicitly.

**Last verified against codebase:** 2026-09-13

---

## 1. SYSTEM OVERVIEW

### 1.1 Purpose

This is a **multi-branch pediatric clinic queue and reservation system**. It digitizes how families book clinic capacity, how front-desk staff run the physical floor, and how the doctor controls live consultations.

Primary goals:

- Reduce chaotic walk-up waiting rooms by letting parents **reserve slots remotely** and **monitor turn position** without camping at the clinic.
- Enforce **strict capacity**, **one consultation at a time**, and **branch-isolated** staff operations.
- Give secretaries and doctors tools to **publish schedules**, and give secretaries tools to **check in** arrivals (QR / code), **penalize** no-shows, and **gate** who enters the doctor’s room.
- Keep an **immutable history** of reservations and audit events for reporting and accountability.

Default physical branches in the product: **Angeles** and **Magalang**.

### 1.2 Who It Serves (Roles)

| Role | Who | What they do (summary) |
|------|-----|-------------------------|
| **Parent / Guardian** | Self-registering end users | Reserve slots, enter child/patient info, monitor queue, receive SMS/push/in-app alerts, present QR ticket at clinic, manage child profiles and notification prefs |
| **Secretary** | Front-desk staff, **one assigned branch** | Create/publish schedules, start the queue, validate check-in, manage queue (send to doctor / penalize / remind), pause/resume/close/end session, create walk-ins, view full-screen queue monitor |
| **Doctor** | Clinical provider (system enforces **one active doctor** account) | Create/publish schedules (any branch), start the queue, live queue view, queue session control (pause / resume / close / complete schedule), complete consultations with optional notes, session reports |
| **Admin** | Back-office operator | Staff & parent user management, branch configuration, system settings (penalty move-back + SMS templates/threshold), audit activity / reports |

Parents are the only role that receives **persistent Notification Center records**, **Web Push**, and **clinic SMS**. Staff get **local UI toasts** only when they perform actions.

### 1.3 Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, Vite 8, React Router 7, Tailwind CSS 4 |
| Auth | Firebase Authentication (email/password; phone verified via SMS OTP at registration; login = email **or** phone + password) |
| Database | **Firebase Realtime Database** (not Firestore) |
| Business logic | Client services under `client/src/services/` (UI does not own domain rules) |
| Push / SMS dispatch | Express 5 server (`server/`, port 5000) **and** Firebase Cloud Functions (`client/functions/`) — keep engines in sync |
| Push delivery | **Web Push + VAPID** via `/sw.js` (not FCM for primary path) |
| SMS gateway | **TextBee.dev** REST API (`TEXTBEE_API_KEY`, optional `TEXTBEE_DEVICE_ID`) |
| Mobile | Capacitor 8 Android (`client/capacitor.config.json` → `webDir: dist`) |
| Hosting | Firebase Hosting (`client/dist`) |

Firebase projects: `pediatric-clinic-queue-system` (production), `pediatric-clinic-queue-testing` (staging).

**Architecture pattern:**

```
UI (pages / components)
  → services/ (reservation, queue engine, schedule, admin, notifications, …)
    → Firebase RTDB
  → Express server and/or Cloud Functions (push + SMS dispatch on RTDB writes; OTP/auth helpers)
```

State model: `AuthContext` + Firebase `onValue` listeners. No Redux / Zustand / React Query.

---

## 2. CORE FEATURES PER ROLE

### 2.1 Authentication & Onboarding (shared entry)

**Public routes:** `/` (Login), `/register`, `/forgot-password`, `/reset-password`.

**Parent registration flow (actual):**

1. Parent enters phone → **SMS OTP** (`purpose: register`) via TextBee.
2. OTP verified → server issues a short-lived `verificationId` (stored under `phoneVerifications`; client cannot R/W OTP nodes).
3. Parent creates Firebase email/password account; profile written with `role: parent`, `isPhoneVerified: true`, `onboardingComplete: false`.
4. Firebase **email verification** required (`VerifiedRoute` → `/verify-email`).
5. **First child profile** onboarding (`OnboardingRoute` → `/onboarding/child`) until `onboardingComplete` is true. Legacy parents missing the flag are grandfathered to `true` on login.

**Login (actual UI):** Single **Email or Phone Number** field + **Password**. Phone identifiers are resolved server-side (`POST /api/auth/resolve-identifier`) to the account email, then Firebase password auth runs. Soft-deleted accounts are blocked. Parents who self-deactivated can reactivate by logging in.

**Note:** Server OTP also supports `purpose: login` (custom token), but the **Login page does not use passwordless SMS login** — only register + phone-number change use OTP in the UI.

**Staff (secretary / doctor / admin):** Created by Admin; login with email/password; **no** email-verification or child-onboarding gates.

**Route guards:** `ProtectedRoute` → (parents) `VerifiedRoute` → (parents) `OnboardingRoute` → `RoleRoute`.

---

### 2.2 Parent — what they see and do

**Routes under `/parent/*`:**

| Path | Capability |
|------|------------|
| `/parent` | Dashboard: **Real-Time Queue Monitoring** *or* **Public Status** (see §3.4) |
| `/parent/reserve` | Browse **published** schedules with capacity; book a slot; enter children + concern |
| `/parent/reservations` | Active reservation list |
| `/parent/reservations/:id/qr` | Digital ticket (QR + 6-char code), cancel (pre–check-in), patient info |
| `/parent/notifications` | Persistent Notification Center |
| `/parent/profile` | Hub |
| `/parent/profile/personal-info` | Name / phone (phone change requires OTP) |
| `/parent/profile/children` | Saved child profiles CRUD |
| `/parent/profile/history` | Terminal reservation history |
| `/parent/profile/notification-settings` | In-app toast vs device push preferences |

#### Workflow A — Parent books a reservation

1. Parent opens **Reserve** and sees published schedules (with remaining capacity).
2. System checks: schedule published; active reservation count `< slotCapacity`; queue not closed/ended/completed; **no other active reservation for this parent on that clinic date**; UI also blocks if they already completed a consultation with the same doctor that day.
3. Parent claims a slot → `createReservation()`:
   - Status `reserved`
   - Permanent incremental `queueNumber` (ticket)
   - 6-character `reservationCode`
   - Injected into queue engine → `recalculateEntireQueue`
4. Parent opens ticket / modal and **Save Information** (one or more saved children + shared `concern`) → `patientInfoCompleted: true`.
5. That finalize step triggers **SLOT_RESERVED** Notification Center + Web Push + **SMS** (not the bare create).
6. Parent monitors dashboard; receives near-turn / almost-next / you’re-next alerts as the queue advances.
7. At clinic, presents QR or code to secretary for check-in.
8. After check-in, parent **cannot cancel**. Flow continues to consultation → completion → history.

#### Workflow B — Parent cancels (before check-in)

1. From QR ticket UI, cancel while status is still `reserved` / waiting-class.
2. Status → `cancelled` (terminal); slot released; queue recalculated.

#### Workflow C — Parent changes phone

1. Personal Information → request OTP (`purpose: update`, requires auth).
2. Verify code → phone updated on profile.

---

### 2.3 Secretary — what they see and do

**Routes under `/secretary/*`** (branch-scoped via `users/{uid}.assignedBranch`, default fallback `"Angeles"`):

| Path | Capability |
|------|------------|
| `/secretary` | Branch dashboard / today’s ops summary |
| `/secretary/schedules` | Draft, edit (draft), publish, **start queue** |
| `/secretary/validate` | QR scan or 6-char code check-in |
| `/secretary/queue` | Manage Queue: remind check-in, penalize, send to doctor, pause/resume/close/end session |
| `/secretary/profile` | Profile + **Walk-in Patient** entry |
| `/secretary/settings` | Per-branch System Configuration (Penalty Move-Back, Grace Period, Penalty Timer, SMS templates) |
| `/secretary/monitor` | Full-screen Queue Monitor (outside main layout) |

#### Workflow A — Create and open a clinic day

1. Secretary or Doctor creates a **draft** schedule (Secretary: **their assigned branch**; Doctor: any branch) (date, opening/closing times within branch hours, `slotCapacity`). Late Limit is no longer collected; penalty timer/grace come from `systemConfiguration/{branchId}`.
2. Publishes schedule → `status: published`, `queueStatus: not_started`; parents can book; **SCHEDULE_AVAILABLE** notifications fire.
3. When floor opens, secretary **starts queue** → `queueStatus: active`; **QUEUE_STARTED** push/SMS to parents with active reservations on that schedule.

#### Workflow B — Check in a reserved parent

1. Parent arrives → Validate screen (camera / manual code).
2. Match active reservation → `checkInReservation` → `checked_in`.
3. Optional: **Request Check-In** from Manage Queue pings parent (`CHECK_IN_REQUESTED`).

#### Workflow C — Run the floor (Manage Queue)

1. View ordered waiting list (dynamic `queueOrder`).
2. If #1 has not checked in when needed → **Penalize** (see §3.3).
3. When consultation room is free and #1 waiting patient is `checked_in` → **Send to Doctor** → `with_doctor` (blocked if anyone already `with_doctor` / `in_consultation`).
4. Wait for doctor to complete; lock lifts; repeat.

#### Workflow D — Walk-in patient

1. Profile → Walk-in Patient modal.
2. Choose a published **Upcoming** schedule or an **Active Now** / paused queue with capacity; enter 1–10 children (age 1–25) + concern. Optional parent name and phone (phone-in bookings). Closed / ended schedules do not appear.
3. Creates reservation with `source: "walk_in"`, **no** `parentId`, already `checked_in`, `patientInfoCompleted: true`. Optional `parentName` / `parentPhone`. A walk-in added to a live queue is placed at the next FIFO position (back of the waiting line), same as a parent booking into an active queue.
4. Appears on Manage Queue / doctor queue like any other ticket. Parent Notification Center / push still require `parentId`. If `parentPhone` is set: one `templateSlotReserved` SMS when the queue is still `not_started`, or `templateSlotReservedActiveQueue` when already `active` / `paused`. No Queue Started / Near Turn / later clinic SMS.

---

### 2.4 Doctor — what they see and do

**Routes under `/doctor/*`:**

| Path | Capability |
|------|------------|
| `/doctor` | Home / session overview |
| `/doctor/queue` | Live queue + **Queue Control** (pause / resume / close / end session; complete consultation stays here) |
| `/doctor/schedules` | Draft, edit (draft), publish, **start queue** (same shared UI as Secretary; any branch) |
| `/doctor/reports` | Completed-session reports |
| `/doctor/profile` | Profile |

#### Workflow — Consultation cycle

1. Secretary sends patient → doctor sees them as current consultation (`with_doctor` / `in_consultation`).
2. Doctor examines patient; may add `doctorNotes` (disabled for walk-ins in UI).
3. **Complete Consultation** → `consultation_completed`; slot released from active capacity; consultation lock lifts; queue recalculates; parent gets **CONSULTATION_COMPLETED** notification.
4. As needed, doctor **pauses** / **resumes** / **closes** queue or **completes** the entire schedule (session end notifications).

Secretary or Doctor **starts** the queue; doctor **controls** the live session after it is active.

---

### 2.5 Admin — what they see and do

**Routes under `/admin/*`:**

| Path | Capability |
|------|------------|
| `/admin` | High-level stats (parents, staff, branches, ops) |
| `/admin/users` | Create / edit / activate / deactivate / delete staff & parents |
| `/admin/branches` | Branch name, address, weekly clinic hours |
| `/admin/activity` | Audit logs + admin report charts |
| `/admin/profile` | Profile |

#### Staff creation rules (important)

- Secretaries must receive an `assignedBranch`.
- System rejects creating a **second active doctor**.
- Staff creation uses a **secondary Firebase Auth app** so the admin session stays logged in.
- Admin deactivation (`deactivationSource: admin`) blocks login until admin reactivates.
- Deletes revoke Auth + profile; reservation/audit history is retained (no physical delete of clinical history).

---

## 3. RESERVATION & QUEUE SYSTEM — FULL RULES

### 3.1 Schedules

**Who creates:** Secretary (locked to `assignedBranch`) or Doctor (any branch). Same schedule record shape and publish flow regardless of creator.

| Field | Meaning |
|-------|---------|
| `branch` | Physical location (e.g. Angeles) |
| `clinicDate` | `YYYY-MM-DD` |
| `openingTime` / `closingTime` | Must fit branch weekly hours |
| `slotCapacity` | Max concurrent **active** reservations |
| `lateLimit` | Ignored legacy field on old schedules. Penalty count no longer forfeits. |
| `status` | `draft` → `published` → `completed` |
| `queueStatus` | `not_started` → `active` → `paused` / `closed` → `completed` |

**Draft vs published:**

- Draft: secretary or doctor can edit; parents cannot book.
- Publish: validates times; sets `queueStatus: not_started`; parents see it.
- After publish, **branch** and **clinicDate** cannot be changed.
- Completing the schedule ends the clinic day; remaining non-terminal reservations are closed out as completed (session end).

Parents only subscribe to / book **`status === "published"`** schedules whose queue is not closed/ended/completed.

---

### 3.2 Reservations — lifecycle & identity

**Standard parent path:**

```
reserved → checked_in → with_doctor / in_consultation → consultation_completed
         ↘ cancelled | forfeited | expired (terminal)
```

**Active statuses** (consume capacity + participate in queue) — from code:

`reserved`, `checked_in`, `waiting`, `in_consultation`, `with_doctor`, `validation_open`, `waiting_for_window`

**Terminal / inactive for capacity & one-reservation rule:**

`cancelled`, `completed`, `consultation_completed`, `expired`, `validation_expired`, `forfeited`, `penalized`, `late_limit_reached`

#### Identity fields

| Field | Rule |
|-------|------|
| `queueNumber` / `originalQueueNumber` | Permanent ticket assigned at create; **never** rewritten by recalculation |
| `reservationCode` | 6-character alphanumeric check-in code |
| `sortTimestamp` | Dynamic sort key (defaults from `createdAt`); **penalties rewrite this** |
| `queueOrder`, `aheadOfYou`, `queueState` | Derived by `recalculateEntireQueue` |
| `children[]` | One or more patients; **one slot / one ticket** regardless of child count |
| `concern` | Shared visit concern string |
| Legacy mirrors | `childName`, `age`, `sex` from first child |

#### Creation rules (parent)

1. Schedule must be `published`.
2. Active count `< slotCapacity`.
3. Queue must not be `closed` / `ended` / `completed`.
4. **One active reservation per parent per `clinicDate`.**
5. Patient details may be incomplete at create; finalize with Save Information → `patientInfoCompleted: true`.

#### Cancellation rules

- Parent cancels only (secretary does not “cancel”; they **penalize** / forfeit).
- Allowed before check-in; **not** after `checked_in`.
- Releases slot; triggers queue recalculation.

#### Slot consumption (authoritative = code)

- Creating an active reservation consumes **1** slot.
- Terminal states **`cancelled`**, **`forfeited`**, **`consultation_completed`** release the slot back to the pool.
- Multiple children on one reservation still consume **1** slot.

> Doc drift note: Some older lines in `ReservationRules.md` §13/§15 imply completed still counts against capacity. Implementation and §9 / SystemBusinessRules release on completion — **follow the release behavior**.

#### Data permanence

Reservations are **never physically deleted**. Terminal records remain for history, doctor reports, and analytics.

---

### 3.3 Queue engine — end-to-end

#### Session lifecycle (`schedules.queueStatus`)

1. **not_started** — schedule published; booking allowed; floor not open.
2. **active** — secretary starts queue; parents notified; floor operations enabled.
3. **paused** — doctor pauses consultation progression (complete consult / call next). Secretary QR/code check-in still works; the parent is marked `checked_in` and waits until the queue is resumed.
4. **closed** — doctor closes queue to further floor flow / booking constraints as implemented.
5. **completed** — clinic session finished.

#### Ordering model (FIFO + penalties)

1. Initially order ≈ creation time (`createdAt` / `sortTimestamp`).
2. Recalculation sorts **active** reservations by `sortTimestamp`.
3. Assigns `queueOrder` and `aheadOfYou`.
4. Sets parent-facing `queueState` (`WAITING`, `CHECKED_IN`, `YOU_ARE_NEXT`, `ALMOST_NEXT`, `WITH_DOCTOR`, `COMPLETED`, `FORFEITED`, `CANCELLED`).
5. `YOU_ARE_NEXT` / `ALMOST_NEXT` apply once the consultation pipeline has advanced (not merely “first ticket of the day with empty room” in all cases — engine ties these to active consultation progression).

#### Check-in

- Secretary only.
- QR or 6-character code.
- Status → `checked_in`; patient becomes eligible for Send to Doctor.
- Allowed while the queue is **paused**. Pause only stops the doctor’s consultation flow; it does not block desk validation.

#### Consultation lock (hard invariant)

- **Only one** reservation may be `with_doctor` or `in_consultation` at a time.
- While locked, secretary UI hides / blocks **Send to Doctor** for everyone else.
- Penalties never bypass this lock.
- Doctor **Complete Consultation** lifts the lock.

#### Send to Doctor eligibility

Typically requires:

1. No active consultation.
2. Patient is first in the waiting pipeline **and** `checked_in`.

#### Penalties

Triggered by secretary when the next eligible / #1 unchecked waiting patient is absent when called.

Parameters:

| Setting | Where | Default | Effect |
|---------|--------|---------|--------|
| `penaltyMoveBack` | `systemConfiguration/{branchId}` (Secretary) | **2** (range 0–10) | How many places to shift back |
| `penaltyGraceMinutes` | `systemConfiguration/{branchId}` | **2** (range 0–5) | Wait after becoming current-turn before Penalize is enabled |
| `penaltyTimerMinutes` | `systemConfiguration/{branchId}` | **15** (range 5–30) | Check-in deadline after first penalty |

Behavior of `penalizeReservation`:

1. Increment `penaltyCount`.
2. If `penaltyMoveBack === 0` → status **`forfeited`** (terminal); slot released; removed from active queue. No timer.
3. Else rewrite `sortTimestamp` to sit behind N waiting patients (or end if fewer remain). Set `penaltyTimerExpiresAt` on the **first** penalty only (later penalties keep that expiry). Clear `becameCurrentTurnAt`.
4. Always `recalculateEntireQueue` (stamps `becameCurrentTurnAt` on the new first unchecked waiting patient when the queue is live).
5. Parent receives **PENALIZED** (push + SMS) or **FORFEITED** (push + SMS) notifications (if they have a parent account).
6. QR/code check-in clears the timer. If the timer expires without check-in, Cloud Function `expirePenaltyTimers` (every 1 minute) and secretary Manage Queue forfeit the reservation.

Edge case: if alone in line, penalty count still increases but there may be nobody to move behind — they can remain #1.

#### Recalculation triggers

Any of: create, cancel, expire, check-in, send/start/complete consultation, penalize/forfeit, and parent deactivate/delete cleanup that mutates active reservations.

---

### 3.4 Walk-in patient flow (vs parent self-booking)

| Aspect | Parent self-book | Walk-in |
|--------|------------------|---------|
| Who creates | Parent | Secretary (Profile → Walk-in modal) |
| Account | `parentId`, email | **No parent**; `source: "walk_in"`, `createdBy: secretaryUid`; optional `parentName` / `parentPhone` |
| One-reservation-per-parent rule | Applies | **Does not apply** |
| Initial status | `reserved` | **`checked_in` immediately** |
| QR validation | Required later | **Skipped** |
| Children | From saved profiles | Inline entry; max **10**; age **1–25** |
| Slot / ticket | 1 slot, 1 `queueNumber` | Same |
| `patientInfoCompleted` | After Save Information | `true` at create |
| SMS / push / Notification Center | Yes | **No** parent-account notifications. One confirmed-reservation SMS if `parentPhone` is set: `templateSlotReserved` when queue is `not_started`, or `templateSlotReservedActiveQueue` when `active` / `paused`. Never Queue Started / Near Turn. |
| Penalize | First unchecked waiting | Also available when a walk-in is #1 waiting, even if `checked_in` |
| Doctor notes UI | Allowed | Disabled for walk-ins |
| Path | reserved → checked_in → … | checked_in → with_doctor → consultation_completed |

Walk-ins still appear on Manage Queue, doctor live queue, and doctor reports after the schedule completes.

---

### 3.5 Penalty experience for parents (Public Status vs Real-Time Monitoring)

This is **not** a separate “penalized mode” flag in the UI.

Parent dashboard (`/parent`) branches on whether the parent currently holds a reservation in **`ACTIVE_RESERVATION_STATUSES`**:

| Condition | Dashboard shows |
|-----------|-----------------|
| Has an **active** reservation | **Real-Time Queue Monitoring** — ticket #, patients ahead, now serving, waiting list |
| No active reservation (none / cancelled / **forfeited** / completed / schedule completed, etc.) | **Public Status** (Today’s Clinic Status) — schedule-level overview only |

Implications:

- A parent who is **penalized but still active** (`penaltyCount > 0`, still reserved/checked_in) **stays on Real-Time Monitoring**, sees their new `aheadOfYou` / order after recalculation, and gets a **PENALIZED** alert.
- A parent who is **forfeited** drops out of the active set → dashboard falls back to **Public Status**; history shows forfeited; **FORFEITED** notification is sent.
- Secretary Manage Queue may show a **Late (N)** style badge for penalized tickets still in line.

---

## 4. SMS NOTIFICATION SYSTEM — FULL RULES

### 4.1 Gateway & integration

- Provider: **TextBee.dev**
- Endpoint: `POST https://api.textbee.dev/api/v1/gateway/send-sms`
- Auth: header `x-api-key: TEXTBEE_API_KEY`
- Optional body field: `deviceId` from `TEXTBEE_DEVICE_ID`
- Phone normalization: Philippine-friendly E.164 (`+63…`) in `server/services/smsService.js` (mirrored under `client/functions/smsService.js`)
- If API key missing, SMS is **skipped** (logged), not fatal to the app

SMS for clinic events is dispatched from the **same server/Functions notification engines** that write Notification Center records and Web Push (Express RTDB listeners in dev; Cloud Functions `onReservationWrite` / `onScheduleWrite` in prod).

OTP SMS is sent from the Express auth/OTP routes (`/api/auth/sms/*`).

---

### 4.2 Clinic / queue SMS trigger points

Only **five** clinic SMS event types exist:

| Event | Exact fire condition | Recipient | Template key |
|-------|----------------------|-----------|--------------|
| **SLOT_RESERVED** (Confirmed Reservation) | Reservation `patientInfoCompleted` transitions to **true** (parent **Save Information**). **Not** on bare parent `createReservation`. If the schedule queue is already live (`active` / `paused` / `closed`), use the active-queue template instead. **Walk-in exception:** on create, if `source === "walk_in"`, `parentPhone` is set, and no `parentId`, send SMS to `parentPhone` (no Notification Center): `templateSlotReserved` when queue is `not_started`, or the same live-queue path (`templateSlotReservedActiveQueue`) when `active` / `paused`. Skip if queue is `closed` / `ended` / `completed`. | That parent’s phone, or walk-in `parentPhone` | `templateSlotReserved` or `templateSlotReservedActiveQueue` |
| **QUEUE_STARTED** | Schedule `queueStatus` first becomes **`active`** | Each parent with an **active** reservation on that schedule | `templateQueueStarted` |
| **NEARING_TURN** | **Only when the queue first starts.** Tickets with `aheadOfYou` **greater than 0 and at or below** `nearingTurnAheadCount` (default **3**). Already-first (`aheadOfYou === 0`) does not send. Locked by `reservations/{id}/nearTurnSmsSent`. Not sent on later recalculation, penalties, or resume. | That parent | `templateNearingTurn` |
| **PENALIZED** | `penaltyCount` increases and status is not `forfeited` | That parent | `templatePenalized` |
| **FORFEITED** | Reservation status becomes **`forfeited`** | That parent | `templateForfeited` |

**Deduplication:**

- Notification records use stable `dedupeKey`s (e.g. `nearing_turn_${reservationId}`).
- SMS send is marked with `smsDispatchedAt` (same pattern as `pushDispatchedAt`) so pause/resume cannot re-spam. The transaction succeeds only for the caller that wrote that timestamp.
- `SLOT_RESERVED` is locked on the reservation (`slotReservedSmsSent`) so dual dispatchers cannot send two confirmation texts.
- `NEARING_TURN` is evaluated **only at queue start**, then locked on the reservation (`nearTurnSmsSent: true`, claimed with an RTDB transaction). The flag is **not** set when the parent is already first (`aheadOfYou === 0`).
- `PENALIZED` is locked per increment (`penaltySmsSent/{penaltyCount}`) so queue recalculation writes after Penalize cannot re-send that event’s SMS.

**Placeholders allowed in Secretary templates:** `{count}`, `{queueNumber}`, `{queuePosition}`, `{minutes}`, `{branch}`, `{date}`, `{timeRange}`, `{doctor}`  
**Max template length:** 320 characters.

**Default templates** (used when RTDB node missing / until Admin saves):

- Slot reserved: confirms date, time range, queue number, doctor, branch.
- Active queue reservation: queue number and position for bookings after the queue has started.
- Queue started: announces queue start at `{branch}` for `{date}`.
- Nearing turn: “Only `{count}` patients ahead (Queue `#{queueNumber}`). Please head to the clinic now.”
- Penalized: moved back; validate QR within `{minutes}` minutes or forfeit.
- Forfeited: did not check in on time; may still book a new slot on the same schedule.

---

### 4.3 OTP SMS trigger points

Fixed message (not Admin-editable):

> `Your verification code is: {code}. It will expire in 5 minutes.`

| Purpose | When it fires | UI wired? | Result on success |
|---------|---------------|-----------|-------------------|
| **register** | Registration phone verification | **Yes** (`/register`) | `verificationId` (proof) for account create |
| **update** | Parent changes phone in Personal Information | **Yes** (auth required) | `verificationId` to apply new phone |
| **login** | Passwordless login OTP | **API exists; Login UI does not use it** | Firebase custom token |

OTP storage (`smsOtps/{phoneKey}`):

- 6-digit code, **bcrypt-hashed**
- TTL **5 minutes**
- Max **5** verify attempts
- Resend cooldown **90 seconds** (server)
- Client read/write **denied** in security rules (Admin SDK only)
- Successful verify may write `phoneVerifications/{phoneKey}` proof (~30 minutes) for register/update

---

### 4.4 Configurable by Secretary (per branch) vs fixed/hardcoded

**Secretary-configurable** (`/secretary/settings` → `systemConfiguration/{branchId}`):

| Key | Node | Range / notes |
|-----|------|----------------|
| `penaltyMoveBack` | `systemConfiguration/{branchId}` | 0–10; default 2; **0 = auto-forfeit on any penalty** |
| `penaltyGraceMinutes` | `systemConfiguration/{branchId}` | 0–5; default 2 |
| `penaltyTimerMinutes` | `systemConfiguration/{branchId}` | 5–30; default 15 |
| `nearingTurnAheadCount` | `systemConfiguration/{branchId}/sms` | 1–10; default 3 |
| `templateSlotReserved` | `systemConfiguration/{branchId}/sms` | Secretary text + placeholders |
| `templateSlotReservedActiveQueue` | `systemConfiguration/{branchId}/sms` | Used when booking after queue start |
| `templateQueueStarted` | `systemConfiguration/{branchId}/sms` | Secretary text + placeholders |
| `templateNearingTurn` | `systemConfiguration/{branchId}/sms` | Secretary text + placeholders |
| `templatePenalized` | `systemConfiguration/{branchId}/sms` | Secretary text + placeholders |
| `templateForfeited` | `systemConfiguration/{branchId}/sms` | Secretary text + placeholders |

Secretary may read/write **only their assigned branch**. Doctors may read any branch (schedule display). Parents may read the `sms` child (near-turn threshold). Admin may read/write all branches. TextBee API key stays in server/Functions env (global).

**Fixed / not Secretary-editable:**

- Which events send SMS (SLOT_RESERVED, QUEUE_STARTED, NEARING_TURN, PENALIZED, FORFEITED + OTP purposes)
- OTP message wording and TTL/attempt limits
- TextBee as the gateway
- Dedupe key strategy / `smsDispatchedAt`
- Push/toast copy for most events (near-turn **count** is shared; push/toast wording for near-turn is system-managed but count-synced)
- Parents-only persistent notifications rule
- All other notification event types (ALMOST_NEXT, YOU_ARE_NEXT, etc.) → Notification Center + push/toast, **not SMS**

---

## 5. PUSH & IN-APP NOTIFICATION SYSTEM (NON-SMS)

*(Included so the document is complete for feature planning; SMS is only one channel.)*

### 5.1 Channels

1. **In-app toasts** — while parent app is open (`inAppNotificationsEnabled`, default true).
2. **Notification Center** — persistent RTDB records under `notifications/{parentId}`.
3. **Web Push / native local notifications** — background/closed app (`devicePushEnabled` + OS permission + VAPID subscription).

Staff (secretary/doctor/admin): **local toasts only**; no Notification Center; cleanup removes accidental non-parent notification nodes.

### 5.2 Event catalog (parents)

| Event ID | Trigger |
|----------|---------|
| `SCHEDULE_AVAILABLE` | Schedule published |
| `SLOT_RESERVED` | Patient info saved (`patientInfoCompleted`) |
| `QUEUE_STARTED` / `QUEUE_PAUSED` / `QUEUE_RESUMED` / `QUEUE_CLOSED` | Queue session transitions |
| `CLINIC_SESSION_ENDED` | Schedule/session completed |
| `NEARING_TURN` | At queue start only, if `0 < aheadOfYou <=` configured count; `nearTurnSmsSent` on the reservation |
| `ALMOST_NEXT` / `YOU_ARE_NEXT` | Queue engine positions #2 / #1 in active pipeline |
| `CHECK_IN_REQUESTED` | Secretary requests check-in |
| `QR_VERIFIED` | Check-in validated |
| `CONSULTATION_STARTED` | Sent to doctor |
| `CONSULTATION_COMPLETED` | Doctor completes |
| `PENALIZED` / `FORFEITED` | Penalty actions |

Priority when delivering: **role restriction** → **dedupe** → **DB write** → **push**.

---

## 6. DATA MODEL (RTDB) — SUMMARY

| Node | Purpose |
|------|---------|
| `users/{uid}` | Profile, role, status, branch, children, push subscriptions, prefs; soft-delete flags |
| `branchConfigurations/{branchId}` | Name, address, weekly open hours |
| `schedules/{scheduleId}` | Clinic day capacity + queue session |
| `reservations/{reservationId}` | Tickets / patients / queue fields / penalties / `nearTurnSmsSent` |
| `notifications/{parentId}/{id}` | Parent Notification Center |
| `auditLogs/{logId}` | Immutable staff/admin actions |
| `systemConfiguration/{branchId}` | Penalty Move-Back, Grace Period, Penalty Timer, SMS templates (per branch) |
| `smsOtps/{phoneKey}` | Hashed OTPs (server only) |
| `phoneVerifications/{phoneKey}` | Short-lived phone proofs (server only) |

Business logic services of note: `reservationService.js`, `queueEngine.js`, `queueEligibilityService.js`, `scheduleService.js`, `systemConfigurationService.js`, `adminService.js`, `notificationService.js`, `notificationCenterService.js`, `positionEventEngine.js`.

---

## 7. SECURITY & ACCESS CONTROL (SUMMARY)

From `database.rules.json`:

| Node | Read | Write |
|------|------|-------|
| `users` | Admin list; own profile | Own (active) / admin; parent reactivation edge cases |
| `notifications` | Own | Own (active parent) |
| `branchConfigurations` | Authenticated | Admin |
| `schedules` | Authenticated | Active secretary / doctor |
| `reservations` | Authenticated | Active parent / doctor / secretary |
| `auditLogs` | Admin | Admin / doctor / secretary |
| `systemConfiguration/{branchId}` | Admin, doctor; secretary own branch | Admin; secretary own branch |
| `systemConfiguration/{branchId}/sms` | + parents | (same write as parent node) |
| `smsOtps`, `phoneVerifications` | **denied** | **denied** (Admin SDK only) |

App-level isolation still matters: secretaries filter by `assignedBranch`; role routes block cross-role UI access.

---

## 8. CORE INVARIANTS (DO NOT BREAK)

1. **One consultation at a time.**
2. **Permanent ticket (`queueNumber`) never changes**; only `sortTimestamp` / `queueOrder` / `aheadOfYou` / `queueState` change.
3. **One active reservation per parent per clinic date** (walk-ins exempt — no parent).
4. **Secretary branch isolation.**
5. **One active doctor account** at staff creation time.
6. **Parents only** get persistent notifications / clinic SMS / Web Push records.
7. **No physical deletes** of reservations or audit logs.
8. **Parent cannot cancel after check-in.**
9. **Slot counting** uses active statuses only; terminal including `consultation_completed` releases capacity.
10. Any queue-affecting mutation must call **`recalculateEntireQueue`**.

---

## 9. END-TO-END CLINIC DAY (HAPPY PATH)

1. Admin has branches + one doctor + branch secretaries configured; SMS/queue settings saved as needed.
2. Secretary or Doctor drafts & **publishes** a schedule → parents notified schedule available.
3. Parents **reserve** → receive ticket numbers → **Save Information** → confirmation SMS/push.
4. Secretary or Doctor **starts queue** → QUEUE_STARTED SMS/push.
5. When the queue **starts**, parents who are approaching (`0 < aheadOfYou <=` Near Turn count) get **NEARING_TURN** SMS once. The parent already first in line does not. Later Almost Next / You’re Next stay push/in-app as the line advances.
6. Parent arrives → secretary **checks in** via QR/code.
7. Secretary **sends** checked-in #1 to doctor (if room free).
8. Doctor **completes** consultation → lock opens → next patient.
9. Absent #1 → secretary **penalizes** (move back or forfeit).
10. Doctor **completes schedule** when day ends → history & reports retain the record.

---

## 10. KNOWN DOC / UI DRIFT (FOR PLANNERS)

Keep these in mind when designing features so you do not “fix” the wrong layer:

| Topic | Reality in code |
|-------|-----------------|
| SMS passwordless login | Server OTP `login` exists; **Login UI is password-only** |
| Who starts the queue | **Secretary** on Schedules (some Manage Queue empty-state copy may still say otherwise) |
| Completed slots vs capacity | **Released** on `consultation_completed` |
| Public Status vs Monitoring | Driven by **active reservation presence**, not a dedicated “penalized UI mode” |
| Dual dispatch path | Express listeners (local/dev) + Cloud Functions (prod) must stay aligned for push/SMS |
| Capacitor config | Use **`client/capacitor.config.json`** (`dist`); root `www` config is stale |
| `rollingValidationService.js` | Deprecated no-op (rolling validation windows removed) |

---

## 11. WHERE TO LOOK IN THE REPO

| Concern | Location |
|---------|----------|
| Routes / role surfaces | `client/src/routes/AppRoutes.jsx` |
| Reservation + walk-in + penalize | `client/src/services/reservationService.js` |
| Queue math | `client/src/services/queueEngine.js`, `queueEligibilityService.js` |
| Schedules / queue session | `client/src/services/scheduleService.js` |
| Secretary SMS/queue/late-limit settings | `client/src/services/systemConfigurationService.js`, `pages/secretary/SystemSettings.jsx` |
| Parent dashboard modes | `client/src/pages/parent/Dashboard.jsx` |
| SMS gateway | `server/services/smsService.js` |
| OTP | `server/services/otpService.js`, `server/routes/smsAuth.js` |
| Push + clinic SMS engine | `server/services/notificationEngine.js`, `client/functions/` |
| RTDB rules | `database.rules.json` |
| Shorter rule specs | `docs/SystemBusinessRules.md`, `QueueEngineRules.md`, `ReservationRules.md`, `NotificationRules.md` |

---

*End of Full System Description & Rules Document.*
