# Queue Engine Rules & Specification

This document is the **single source of truth** for the pediatric clinic Queue Engine. It describes the precise, current implementation of queue logic, state definitions, business rules, and rule enforcement priorities.

---

## 1. Overview
The Queue Engine is a centralized processing system responsible for determining, maintaining, and updating patient queue positions and states. It functions as a dynamic orchestrator that ensures strict clinical workflow rules are obeyed—specifically, tracking who is currently in consultation, who is checked in, and who is penalized, then translating that data into relative queue positions (`aheadOfYou`, `queueOrder`) and parent-facing queue states (e.g., `YOU_ARE_NEXT`).

---

## 2. Queue States
The Queue Engine emits the following states (`QUEUE_STATES`) to parent dashboards and UI badges:

| State | Meaning | Trigger / Condition |
|-------|---------|---------------------|
| **WAITING** | Patient is reserved but not yet checked in. | Default active state. |
| **CHECKED_IN** | Patient has been verified at the clinic. | Secretary validates QR code. |
| **YOU_ARE_NEXT** | Patient is #1 in the active waiting queue. | Queue index === 0 during active consultation pipeline. |
| **ALMOST_NEXT** | Patient is #2 in the active waiting queue. | Queue index === 1 during active consultation pipeline. |
| **WITH_DOCTOR** | Patient is actively inside the consultation room. | Secretary sends patient to Doctor. |
| **COMPLETED** | Consultation is finished. | Doctor clicks "Complete Consultation". |
| **FORFEITED** | Patient was removed from the queue due to absence. | Penalty timer expired without check-in, or Penalty Move-Back is 0. |
| **CANCELLED** | Patient manually cancelled their reservation. | Parent clicks "Cancel Reservation". |

---

## 3. Queue Priority Rules
Queue ordering is dynamic and calculates relative turn order based on the following priorities:

1. **Permanent Numbering**: Every reservation is assigned a permanent, unchanging `queueNumber` (or `queuePosition` in history) based strictly on creation time (`createdAt`). This is what parents see as their "Ticket Number".
2. **Dynamic Sorting (`sortTimestamp`)**: The active order (`queueOrder`) is calculated by sorting active reservations by `sortTimestamp` (falling back to `createdAt`). 
3. **Queue Shifts**: When a patient is penalized, their `sortTimestamp` is artificially advanced to move them behind other waiting patients.

---

## 4. Check-in Rules
1. **Unverified Status**: All reservations start as `reserved` (or `waiting`).
2. **Arrival Verification**: The Secretary must scan the parent's QR code or manually verify their Reservation Code to mark them as `checked_in`.
3. **Queue Presence**: A patient being `checked_in` signifies they are physically at the clinic, making them eligible to be sent to the doctor.

---

## 5. Consultation Rules
The core tenet of the Queue Engine is clinical isolation:

1. **The Active Consultation Rule**: **Only ONE Consultation In Progress may exist at any given time.**
2. **Blocking Mechanisms**: If ANY patient holds the status `in_consultation` or `with_doctor`, the Queue Engine mandates that **no other patient** may be sent to the doctor.
3. **Button Visibility**: The Secretary UI will actively hide the "Send to Doctor" action for all patients until the current consultation is officially marked complete.

---

## 6. Penalty Rules
1. **Trigger**: Penalize is available on the first unchecked waiting patient only after that patient has been current-turn for the branch **Penalty Grace Period** (`systemConfiguration/{branchId}/penaltyGraceMinutes`, default 2, range 0–5). `becameCurrentTurnAt` is stamped by queue recalculation when the queue is live.
2. **Queue Shifting**: A penalized patient's `sortTimestamp` is recalculated to move them backward in the active queue by that branch’s **Penalty Move-Back** count (`systemConfiguration/{branchId}/penaltyMoveBack`, range 0–10), or to the very end if fewer patients remain behind them. There is no cap on how many times a parent can be moved back.
3. **Zero Move-Back Forfeit**: Setting the Penalty Move-Back count to 0 results in an automatic forfeit for the parent. The Secretary's penalty action immediately transitions the reservation to `forfeited` instead of shifting position or starting a timer.
4. **Penalty Timer**: When Move-Back is greater than 0, Penalize also starts a countdown (`penaltyTimerStartedAt` / `penaltyTimerExpiresAt`) using **Penalty Timer** minutes (`systemConfiguration/{branchId}/penaltyTimerMinutes`, default 15, range 5–30). Later penalties **keep the first expiry**. If the parent validates QR/code before expiry, the timer is cleared and they stay in queue at the new position. If the timer expires without check-in, the reservation is automatically `forfeited` (Cloud Function every minute, plus secretary desk fallback).
5. **Constraint**: Applying a penalty triggers a queue recalculation, but it **never bypasses the Active Consultation Rule**.

---

## 7. Queue Recalculation Rules
The `recalculateEntireQueue` function executes whenever a mutation occurs in the queue ecosystem:
* New Reservation
* Penalty Applied
* Penalty timer expiry / forfeiture
* Cancellation
* Check-In
* Consultation Start
* Consultation Complete

**Behavior**:
1. Fetches all active reservations for the schedule.
2. Sorts them by `sortTimestamp`.
3. Sequentially assigns `queueOrder` and `aheadOfYou`.
4. Evaluates `queueState` (identifying who is `YOU_ARE_NEXT`).
5. Persists the enriched data back to the database in a single batch update.

---

## 8. Secretary Rules
The Secretary manages schedules and the flow of the physical clinic:
* **Schedule Lifecycle**: Creates drafts, publishes schedules for their assigned branch, and starts the queue (`queueStatus: active`). The Doctor role has the same create/publish/start actions across all branches.
* **Check In**: Verifies arrivals via QR scan or 6-character code.
* **Penalize**: Applies penalties to absent patients who are #1 in the unchecked waiting queue, after the grace period has elapsed.
* **Send to Doctor**: Promotes a `checked_in` patient to `with_doctor` **ONLY IF** there are zero active consultations.
* **Remind Check-In**: Pings the next eligible patient to proceed to the desk.

---

## 9. Doctor Rules
The Doctor controls the consultation room and live queue session controls:
* **Schedule Lifecycle**: Creates drafts, publishes schedules for any branch, and starts the queue (`queueStatus: active`). Same validation and record shape as Secretary.
* **Queue Control**: Pauses, resumes, or closes the live queue during an active clinic session.
* **Consultation**: Receives the patient (status shifts to `in_consultation` / `with_doctor`).
* **Complete Consultation**: Ends the session, shifting the patient to `consultation_completed`. This crucially frees the Consultation Room, unlocking the Secretary's ability to send the next patient.
* **Complete Schedule**: Ends the entire clinic session when appropriate from Queue Control.

---

## 10. Parent Rules
* **Reservation Creation**: Locks in a permanent queue number.
* **Check-In Pass**: QR Code is generated upon reservation.
* **Monitoring**: Observes dynamic states (`WAITING` -> `YOU_ARE_NEXT`) and `aheadOfYou` counts relative to the active pipeline.
* **Cancellation**: Instantly triggers a recalculation, moving everyone behind them forward by one spot.

---

## 11. Reservation Completion Rules
When a Doctor clicks "Complete Consultation":
1. The patient's status becomes `consultation_completed`.
2. `doctorNotes` are attached to the record.
3. The patient is removed from the active pipeline.
4. `recalculateEntireQueue` runs immediately.
5. The `in_consultation` lock is lifted.
6. The next `checked_in` patient becomes eligible for the Secretary to send in.

---

## 12. Edge Cases
* **Empty Active Queue**: If no patients are waiting, no action can be taken.
* **Penalized but only one waiting**: The patient's timestamp updates, but since there is no one to fall behind, they effectively remain #1 (but their penalty count increases).
* **Missing Check-ins**: The Secretary can penalize the #1 patient if they haven't checked in, forcing the queue to bypass them.

---

## 13. Rule Priority Order
The Queue Engine evaluates state eligibility in strict descending priority:

1. **Active Consultation Rule (Highest)**
   * *If a consultation is active, NO ONE ELSE may enter the doctor's room.*
2. **Terminal Status Rule**
   * *Cancelled, completed, or forfeited patients are permanently excluded from the active pipeline calculations.*
3. **Check-In Eligibility Rule**
   * *A patient must be `checked_in` to be sent to the doctor.*
4. **Queue Position Rule**
   * *Only the #1 sorted patient in the waiting queue is eligible for promotion or penalty.*
5. **Penalty Timer Rule**
   * *Penalty Move-Back 0 forfeits immediately. Otherwise Penalize moves the parent back and starts (or keeps) the first penalty timer; expiry without check-in forfeits.*
   * *Setting the Penalty Move-Back count to 0 results in an automatic forfeit for the parent.*
6. **Queue Recalculation Rule (Lowest)**
   * *Recalculations update UI and numbers, but always respect the blocking rules above.*

**Why this order?**
Clinical safety and reality take precedence. No matter what a sorting algorithm says, if the doctor is busy, the door is closed. Terminal states cannot be undone. You cannot see a doctor if you aren't physically verified as checked in.

---

## 14. Regression Protection Checklist
Before merging any future Queue Engine changes, engineers **must** verify:

- [ ] ✓ Only one active consultation may exist at any time.
- [ ] ✓ Queue penalties must never bypass the consultation lock.
- [ ] ✓ Completed consultations immediately release schedule slots.
- [ ] ✓ Secretary Branch Isolation remains enforced.
- [ ] ✓ Permanent Ticket Numbers never change.
- [ ] ✓ Queue recalculation never changes Ticket Numbers.
- [ ] ✓ Reservation History remains immutable.
- [ ] ✓ No "Send to Doctor" button appears while a consultation is active.
- [ ] ✓ New check-ins do not bypass the Active Consultation Rule.
- [ ] ✓ Queue Position numbering remains consistent and does not skip unpredictably.
