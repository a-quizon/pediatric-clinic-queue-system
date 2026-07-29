# Official Specification: Queue Engine Business Rules

**Document Version:** 1.0.0  
**Status:** Official Single Source of Truth  
**Target Audience:** Developers, Software Engineers, Future Contributors, Capstone Panel Members  

---

## 1. Introduction

The **Queue Engine** is the core subsystem of the Pediatric Clinic Queue Management System. It governs how patient reservations enter the clinic queue, how priority order is dynamically calculated and maintained, how patients progress through waiting lines into consultation, and how penalties or forfeitures are applied when patients arrive late or miss their turn.

This document serves as the **official specification** of all queue-related business rules implemented across the project repository (`queueEngine.js`, `queueEligibilityService.js`, `positionEventEngine.js`, `reservationService.js`, and related queue management modules). All behaviors documented herein reflect the actual, existing implementation and must be preserved during future maintenance or enhancements.

---

## 2. Purpose

The purpose of this specification is to:
1. Provide an unambiguous definition of **what the system does** regarding queue ordering, movement, consultation eligibility, and status evaluations without requiring direct inspection of source code.
2. Prevent regressions when adding new features or optimizing existing code by establishing clear behavioral boundaries.
3. Serve as the benchmark for system validation, testing, and panel evaluation.

---

## 3. Definitions

* **Reservation:** A booked slot for a specific clinic session schedule containing patient details, unique QR validation code, and queue tracking properties.
* **Queue Number (`queueNumber` / `originalQueueNumber`):** A permanent, sequential integer assigned to a reservation at the time of creation based on booking order (`1, 2, 3...`). This number remains immutable across the entire reservation lifecycle to serve as the patient's identifier.
* **Queue Order (`queueOrder`):** The dynamic, relative priority rank (`1, 2, 3...`) of a reservation among currently active waiting patients in a clinic session. This rank adjusts automatically when earlier patients are penalized, cancelled, or completed.
* **Queue Position (`queuePosition`):** The displayed queue turn for a patient across live monitors and badges. For active waiting patients, it corresponds to their dynamic ranking or assigned permanent number depending on module context.
* **Ahead Of You (`aheadOfYou`):** The exact count of active, waiting patients currently queued before a specific patient in the same schedule.
* **Queue State (`queueState`):** A contextual indicator representing a patient's exact progression phase (`YOU_ARE_NEXT`, `ALMOST_NEXT`, `WAITING`, `CHECKED_IN`, `WITH_DOCTOR`, `COMPLETED`, `FORFEITED`, `CANCELLED`).
* **Active Pipeline (`ACTIVE_RESERVATION_STATUSES`):** The exact subset of reservation statuses that occupy clinic capacity and actively participate in queue sorting (`reserved`, `checked_in`, `waiting`, `in_consultation`, `with_doctor`).
* **Blocking vs. Non-Blocking Statuses:** Statuses that either hold priority over subsequent waiting patients (`reserved`, `checked_in`) versus statuses that do not block subsequent queue numbers (`in_consultation`, `with_doctor`, `completed`, `consultation_completed`, `cancelled`, `forfeited`, `penalized`, `late_limit_reached`).

---

## 4. Queue Lifecycle

### QR-001: Queue Initialization Upon Creation
* **Description:** When a parent creates a reservation, the system assigns a permanent `queueNumber` equal to the maximum existing `queueNumber` in that schedule plus one (`max + 1`), initialized with status `reserved`.
* **Notes:** Even if earlier reservations are cancelled or completed, the sequence never decrements to reuse past numbers.

### QR-002: Active Pipeline Statuses
* **Description:** A reservation remains part of the active queue and counts against the schedule's slot capacity as long as its status is one of: `reserved`, `checked_in`, `waiting`, `in_consultation`, or `with_doctor`.
* **Notes:** All formulas computing available clinic slots or live monitoring lines filter against this exact pipeline definition.

### QR-003: Terminal Status Transitions
* **Description:** A reservation exits the active queue pipeline upon transitioning to any terminal status: `completed`, `consultation_completed`, `cancelled`, `forfeited`, `penalized`, `late_limit_reached`.
* **Notes:** Once terminal, a reservation no longer occupies clinic capacity or affects the `aheadOfYou` counts of remaining waiting patients.

### QR-004: Full Queue Recalculation Trigger
* **Description:** Whenever any queue-altering event occurs (reservation creation, check-in, penalty, cancellation, sending to doctor room, or consultation completion), the system automatically executes a full recalculation of the schedule's queue (`recalculateEntireQueue`).
* **Notes:** This guarantees that `queueOrder`, `aheadOfYou`, and `queueState` are atomically re-ranked and persisted across all records.

---

## 5. Queue States

### QR-005: Pre-Session Status Assignment
* **Description:** If a clinic session has not officially started or progressed (no active consultation and no patient previously sent to the doctor room), a patient whose status is `checked_in` receives `queueState = CHECKED_IN`. All other active waiting patients (`reserved`, `waiting`) receive `queueState = WAITING`.
* **Notes:** This prevents premature `YOU_ARE_NEXT` notifications before the doctor is ready to see patients.

### QR-006: Active Waiting State Evaluation
* **Description:** Once the consultation session is active, all active waiting reservations (`reserved`, `waiting`, `checked_in`) are sorted by their effective queue timestamp (`sortTimestamp` or `createdAt`).
* **Notes:** Sorting determines exact line turn and eligibility for priority states.

### QR-007: First-In-Line State (`YOU_ARE_NEXT`)
* **Description:** When the consultation session is active (`consultationActive = true`), the waiting patient at index `0` of the active waiting list receives `queueState = YOU_ARE_NEXT`.
* **Notes:** This state alerts the patient and triggers the real-time position notification.

### QR-008: Second-In-Line State (`ALMOST_NEXT`)
* **Description:** When the consultation session is active (`consultationActive = true`), the waiting patient at index `1` of the active waiting list receives `queueState = ALMOST_NEXT`.
* **Notes:** Serves as a heads-up warning for the parent to prepare for clinic call.

### QR-009: Checked-In State Prioritization
* **Description:** For waiting reservations at index `2` or greater during an active session, if the patient has completed QR validation (`status = checked_in`), their state is assigned as `CHECKED_IN` rather than generic `WAITING`.
* **Notes:** Distinguishes physically present patients from those not yet checked in.

### QR-010: Consultation State (`WITH_DOCTOR`)
* **Description:** Any reservation whose status transitions to `in_consultation` or `with_doctor` is immediately assigned `queueState = WITH_DOCTOR`.
* **Notes:** This reflects that the patient is currently inside the examination room with the doctor.

### QR-011: Completed State (`COMPLETED`)
* **Description:** Any reservation whose status is `completed` or `consultation_completed` is assigned `queueState = COMPLETED`.
* **Notes:** Terminal successful state for the consultation lifecycle.

### QR-012: Forfeited and Expired State Assignment
* **Description:** Reservations with status `forfeited`, `penalized`, or `late_limit_reached` receive `queueState = FORFEITED`. Reservations with status `cancelled` receive `queueState = CANCELLED`.
* **Notes:** Preserves accurate historical tags in patient records.

---

## 6. Queue Position Rules

### QR-013: Permanent Queue Number Preservation
* **Description:** The `queueNumber` assigned at creation is permanently preserved and displayed as `Queue #N` across all cards, badges, and receipts.
* **Notes:** Never changes regardless of penalties or cancellations.

### QR-014: Dynamic Queue Order Ranking
* **Description:** Among all active reservations in a schedule, dynamic `queueOrder` (`1, 2, 3...`) is assigned sequentially by sorting active items ascending by `sortTimestamp` (or `createdAt` if `sortTimestamp` is absent).
* **Notes:** When a patient is penalized, their `sortTimestamp` increases, which shifts their `queueOrder` to a higher number and moves subsequent waiting patients forward.

### QR-015: Ahead Of You Calculation
* **Description:** For any active waiting reservation, `aheadOfYou` is calculated as the exact count of active pipeline reservations (`reserved`, `waiting`, `validation_open`, `waiting_for_window`, `checked_in`, `with_doctor`, `in_consultation`) that appear earlier in the sorted active pipeline (`index > 0 ? index : 0`).
* **Notes:** Reflects the total volume of patients (both waiting ahead and currently inside the doctor room) before this patient's turn.

### QR-016: Zero Ahead Of You During Consultation
* **Description:** When a patient enters consultation (`with_doctor` or `in_consultation`), or reaches terminal status (`completed`, `consultation_completed`, `cancelled`, `forfeited`), their `aheadOfYou` count is strictly set to `0`.
* **Notes:** Prevents negative or stale counts during examination or post-completion.

### QR-017: Blocking Status Priority Enforcement
* **Description:** In the queue eligibility check (`queueEligibilityService`), only reservations with status `reserved` or `checked_in` are treated as `BLOCKING_STATUSES` that hold a physical place in line.
* **Notes:** If an earlier patient is in `reserved` status (not yet checked in), they block subsequent checked-in patients from entering the doctor room until the earlier patient checks in or is penalized.

---

## 7. Waiting Queue Rules

### QR-018: Waiting Queue Section Independence
* **Description:** The waiting queue (`Section 2`) operates entirely independently of the active consultation room (`Section 1`). The presence of a patient inside the doctor room (`in_consultation` or `with_doctor`) does not halt, hide, or alter actions available for patients waiting in line.
* **Notes:** Secretary flow control actions evaluate solely against remaining waiting patients.

### QR-019: First Unchecked-In Patient Priority
* **Description:** In the waiting queue, the first patient whose status is `reserved` or `waiting` (not yet checked in via QR) is eligible for the `Penalize` action.
* **Notes:** Even if index `0` of the waiting queue is already `checked_in`, the system identifies the earliest unchecked-in patient (`firstUncheckedIdx`) so the secretary can penalize absent patients without blocking present patients.

### QR-020: Checked-In Patient Consultation Priority
* **Description:** In the waiting queue, the patient at index `0` (`isFirstWaiting`) is eligible to be sent to the doctor room (`Send to Doctor`) if and only if their status is `checked_in`.
* **Notes:** Ensures only physically present and verified patients are dispatched to the examination room.

---

## 8. Secretary Queue Rules

### QR-021: Secretary Live Queue Monitoring Sectioning
* **Description:** The Secretary Manage Queue interface strictly divides the active schedule into two visible sections: **Current Consultation** (`in_consultation` / `with_doctor`) and **Waiting Queue** (`checked_in`, `reserved`, `waiting` sorted by `queueOrder`).
* **Notes:** Provides clear visual distinction between inside-room and waiting area.

### QR-022: Send to Doctor Action Eligibility
* **Description:** The `Send to Doctor` button is enabled when the patient is first in the waiting queue (`isFirstWaiting === true`) and has successfully checked in (`status === 'checked_in'`).
* **Notes:** Clicking this button transitions the reservation status to `with_doctor` and sets `sentToDoctorAt` and `consultationStartedAt` timestamps.

### QR-023: Penalize Action Eligibility
* **Description:** The `Penalize` button is enabled for the first unchecked-in patient in the waiting queue (`idx === firstUncheckedIdx`), regardless of whether another patient is currently inside the consultation room.
* **Notes:** Clicking `Penalize` increments the penalty counter and reorders the absent patient further back in line.

### QR-024: Request Check-In Reminder Eligibility and Cooldown
* **Description:** The `Request Check-In` action identifies the earliest waiting patient who is not yet checked in (`status === 'reserved' || status === 'waiting'`) and sets `checkInRequestedAt = Date.now()`. This action enforces a mandatory **30-second cooldown** per click before another reminder can be sent.
* **Notes:** Triggers a real-time push/toast notification to the parent's device reminding them to proceed to the clinic for QR validation.

---

## 9. Doctor Queue Rules

### QR-025: Doctor Consultation Room Separation
* **Description:** On the Doctor Queue dashboard, the current ongoing consultation (`in_consultation` or `with_doctor`) is displayed separately from the `Waiting Validation Queue` and `Checked-In Queue`.
* **Notes:** The doctor can view patient details, notes, and consultation start times directly inside this dedicated view.

### QR-026: Consultation Completion Capacity Release
* **Description:** When the doctor completes an examination by submitting notes and clicking `Complete Consultation`, the reservation status transitions to `consultation_completed`. Exactly at this point, the reservation exits `ACTIVE_RESERVATION_STATUSES`, decrementing occupied capacity by `1` and releasing `1` available slot.
* **Notes:** Sending a patient to the doctor room does not release a slot; only consultation completion releases the slot.

### QR-027: Queue Session Closure Eligibility
* **Description:** The doctor can end the clinic session only when there are zero patients waiting (`waitingValidationQueue.length === 0` and `checkedInQueue.length === 0`) and no active ongoing consultation (`!inConsultation`).
* **Notes:** Prevents accidental session termination while patients are still being served.

---

## 10. Parent Queue Rules

### QR-028: Parent Live Queue Position Display
* **Description:** The parent dashboard and monitoring screens display real-time progress metrics including permanent `Queue #`, `Ahead Of You` count, and dynamic `queueState` badge (`You're Next`, `Almost Next`, `Waiting`, `Checked In`, `In Consultation`).
* **Notes:** Updates automatically via Firebase real-time database subscriptions without requiring manual page refreshes.

### QR-029: Parent Active Reservation Single View
* **Description:** If a parent has multiple reservations, the live monitor highlights their currently active reservation (`ACTIVE_RESERVATION_STATUSES`). If the schedule has ended or completed, it displays the terminal summary.
* **Notes:** Keeps parent UI focused on immediate action requirements.

---

## 11. Check-In Rules

### QR-030: QR Verification Check-In Transition
* **Description:** When the secretary scans or verifies a parent's QR code, the reservation transitions to `checked_in`, sets `checkedIn = true`, records `checkedInAt` timestamp, and stores the secretary's UID (`checkedInBy`).
* **Notes:** Triggers full queue recalculation (`recalculateEntireQueue`) to update states and notify the parent (`QR_VERIFIED`).

### QR-031: Checked-In Priority Over Unchecked Waiting Patients
* **Description:** While permanent queue numbers dictate base turn order, a checked-in patient at index `0` of the waiting queue can immediately proceed to consultation (`Send to Doctor`), whereas an unchecked patient at index `0` blocks the line until penalized or checked in.
* **Notes:** Enforces the clinic rule that patients must be physically verified before entering consultation.

---

## 12. Penalty Rules

### QR-032: Penalty Reordering Behind Next Two Waiting Patients
* **Description:** When a penalty is applied (`penalizeReservation`), the system filters all active waiting patients (`reserved`, `checked_in`, `waiting`) sorted by effective timestamp. If the penalized patient is at index `index`, the system locates the target patient two spots behind (`targetBehindIndex = Math.min(activePipeline.length - 1, index + 2)`).
* **Notes:** This moves the late patient exactly two turns back in the waiting queue pipeline.

### QR-033: Penalty Timestamp Averaging
* **Description:** To place the penalized reservation right behind the target patient (`targetBehind`) without colliding with the patient after them (`nextAfterTarget`), the system computes `newSortTimestamp = (targetTime + nextTime) / 2`. If no patient exists after the target, `newSortTimestamp = targetTime + 60000` (+1 minute).
* **Notes:** Ensures stable mathematical sorting without requiring fractional queue order integers.

### QR-034: Penalty Increment Limit
* **Description:** Each penalty application increments `penaltyCount` by `1` and records `lastPenalizedAt = Date.now()`.
* **Notes:** Tracked dynamically against the branch configuration's late arrival limit (`lateLimit`).

---

## 13. Forfeiture Rules

### QR-035: Late Limit Exceeded Forfeiture
* **Description:** When `penalizeReservation` is invoked and the new penalty count reaches or exceeds the schedule's configured late limit (`currentPenaltyCount >= lateLimit`, default `3`), the reservation is immediately revoked from the active queue and assigned status `forfeited`.
* **Notes:** Stores `forfeitureReason: "Exceeded the clinic's late arrival limit."`, `penaltyCount`, `forfeitedAt`, and `penalizedAt`.

### QR-036: Forfeited Status Removal from Active Pipeline
* **Description:** Upon transitioning to `forfeited`, the reservation immediately exits `ACTIVE_RESERVATION_STATUSES`. The system recalculates the entire queue, reducing active waiting counts and advancing all remaining waiting patients forward.
* **Notes:** Forfeited reservations move permanently to reservation history.

---

## 14. Consultation Rules

### QR-037: Consultation Eligibility Preconditions
* **Description:** A patient is eligible to begin consultation (`getNextEligiblePatient`) if and only if:
  1. The earliest blocking patient in line (`activeQueue[0]`) has status `checked_in`.
  2. There is no ongoing consultation (`in_consultation` or `with_doctor` does not exist).
* **Notes:** Governed strictly by `queueEligibilityService.js`.

### QR-038: Blocking by Unchecked Earlier Queue Numbers
* **Description:** If the earliest active patient in line (`activeQueue[0]`) has status `reserved` (not checked in), the system returns `eligible = false, blocked = true, reason = 'earlier_queue_waiting'`, with waiting message `"Waiting for Queue #N to check in at the clinic."`
* **Notes:** Prevents skipping earlier booked numbers without secretary intervention (such as applying a penalty).

### QR-039: Blocking by Active Ongoing Consultation
* **Description:** If any reservation in the schedule currently has status `in_consultation` or `with_doctor`, the system returns `eligible = false, blocked = true, reason = 'in_consultation'`, with waiting message `"Waiting for the current consultation to be completed."`
* **Notes:** Enforces single-patient occupancy of the examination room.

### QR-040: Consultation Transition Statuses
* **Description:** The consultation workflow uses two progressive statuses:
  - `with_doctor`: Assigned when the secretary clicks `Send to Doctor`.
  - `in_consultation`: Assigned when the doctor clicks `Start Consultation` inside the examination room.
  Both statuses are treated as active ongoing consultations (`NON_BLOCKING_STATUSES` inside `queueEligibilityService` and active inside `queueEngine`).
* **Notes:** Ensures seamless synchronization between secretary dispatch and doctor room reception.

---

## 15. Queue Movement Rules

### QR-041: Dynamic Reordering Upon Penalty or Cancellation
* **Description:** Whenever any reservation is penalized, cancelled, completed, or forfeited, `recalculateEntireQueue` re-evaluates `activeQueue` sorting by `sortTimestamp` / `createdAt` and re-assigns sequential `queueOrder` (`1, 2, 3...`) across all remaining active items.
* **Notes:** Guarantees no gaps or out-of-order rankings exist in the active pipeline.

### QR-042: State Enrichment After Movement
* **Description:** After sorting and updating `queueOrder`, `recalculateEntireQueue` recalculates `aheadOfYou` and `queueState` (`YOU_ARE_NEXT` for index `0`, `ALMOST_NEXT` for index `1` if session is active) and writes all updates atomically to Firebase.
* **Notes:** Ensures all connected clients receive synchronized updates instantly.

---

## 16. Reservation Capacity Rules

### QR-043: Active Status Occupancy Enforcement
* **Description:** Across all schedule management, reserve queue, and details modals, available slots (`availableSlots`) and reserved counts (`reservedCount`) are calculated by filtering schedule reservations against `ACTIVE_RESERVATION_STATUSES`.
* **Notes:** `availableSlots = schedule.slotCapacity - activeCount`.

### QR-044: Capacity Release Only Upon Consultation Completion
* **Description:** Because `with_doctor` and `in_consultation` are included inside `ACTIVE_RESERVATION_STATUSES`, sending a patient into consultation does not release a slot. Exactly one slot is released when the doctor marks the consultation as `consultation_completed` (`or completed`).
* **Notes:** Prevents overbooking during active consultation hours.

---

## 17. Real-Time Queue Monitoring Rules

### QR-045: Real-Time Subscription and Enrichment
* **Description:** All queue views subscribe to Firebase Realtime Database (`subscribeToAllReservations` / `subscribeToAllSchedules`). On every snapshot change, raw reservations are passed through `calculateDynamicQueuePositions` and `enrichReservationsWithState` before rendering.
* **Notes:** Ensures front-end state matches database calculations uniformly across roles.

### QR-046: Synchronized Server Clock Timestamp Offset
* **Description:** `timeService.js` subscribes to `.info/serverTimeOffset` to synchronize client clocks with Firebase server timestamps (`getServerTime = Date.now() + serverTimeOffset`).
* **Notes:** Prevents timestamp skew when ranking `createdAt` or `sortTimestamp` across different user devices.

---

## 18. Notification Interaction Rules

### QR-047: Position Threshold Event Evaluation
* **Description:** `NotificationObserver.jsx` listens to all reservation transitions and invokes `evaluatePositionEvents(allReservations, schedules, user)`. Whenever a parent's active reservation transitions to `queueState === QUEUE_STATES.YOU_ARE_NEXT` or `ALMOST_NEXT`, the system dispatches `notificationService.notify` with unique deduplication keys (`you_are_next_${id}` / `almost_next_${id}`).
* **Notes:** Ensures parents receive instant heads-up alerts precisely as their queue turn approaches.

### QR-048: Queue Session State Notification Triggers
* **Description:** When a schedule's `queueStatus` transitions (`active`, `paused`, `closed`, `ended`), `NotificationObserver.jsx` checks if the parent has an active reservation (`ACTIVE_RESERVATION_STATUSES`) on that schedule. If verified, it dispatches corresponding notification events (`QUEUE_STARTED`, `QUEUE_PAUSED`, `QUEUE_RESUMED`, `QUEUE_CLOSED`, `CLINIC_SESSION_ENDED`).
* **Notes:** Prevents spamming parents who are not actively queued in that session.

### QR-049: Penalty and Check-In Reminder Notification Triggers
* **Description:** `NotificationObserver.jsx` dispatches `CHECK_IN_REQUESTED` when `currCheckInReq > prevCheckInReq`, and dispatches `PENALIZED` when `currPenalty > prevPenalty && currStatus !== 'forfeited'`. If `currStatus === 'forfeited'`, it dispatches `FORFEITED`.
* **Notes:** Keeps parents fully informed of secretary flow enforcement actions.

---

## 19. Queue Constraints

### QR-050: Non-Negative Ahead Of You Floor
* **Description:** `computeAheadOfYou` enforces a floor of zero (`index > 0 ? index : 0` and returns `0` for ongoing/completed consultations).
* **Notes:** Guarantees that `aheadOfYou` is never negative.

### QR-051: Single Active Consultation Constraint
* **Description:** The system allows only one patient to hold `in_consultation` or `with_doctor` status at any given time per schedule (`getNextEligiblePatient` checks `reservations.find(r => r.status === 'in_consultation' || r.status === 'with_doctor')`).
* **Notes:** Prevents concurrent overlapping consultations within a single clinic room.

---

## 20. Edge Cases

### QR-052: Penalty Reordering Near End of Queue
* **Description:** When `penalizeReservation` moves a patient behind the next two waiting patients, if fewer than two waiting patients exist (`activePipeline.length <= 2` or `index + 2` reaches the last item), the penalized patient is placed at index `activePipeline.length - 1` with `newSortTimestamp = targetTime + 60000`.
* **Notes:** Handles small or near-empty queues gracefully without throwing indexing errors.

### QR-053: Simultaneous Check-In and Penalty Handling
* **Description:** Because all queue transitions (`checkInReservation`, `penalizeReservation`) trigger `recalculateEntireQueue`, concurrent updates sort deterministically based on `sortTimestamp` and `createdAt` before updating queue orders.
* **Notes:** Preserves consistent ranking even under rapid secretary operations.

---

## 21. Data Integrity Rules

### QR-054: Atomic Batch Update of Derived Queue Metrics
* **Description:** `recalculateEntireQueue` collects all `queueOrder`, `queuePosition`, `aheadOfYou`, and `queueState` updates across all schedule reservations into a single update map (`updates`) and writes them atomically via `update(ref(database), updates)`.
* **Notes:** Eliminates partial updates or race conditions where some reservations have updated ranks while others have stale ranks.

### QR-055: Single Source of Truth Synchronization
* **Description:** All UI components, badges, and notification observers are strictly prohibited from calculating standalone queue orders or states locally; they must consume the enriched outputs (`queueOrder`, `aheadOfYou`, `queueState`) generated by `queueEngine.js`.
* **Notes:** Ensures absolute visual and structural consistency across Parent, Secretary, and Doctor views.

---

## 22. Future Compatibility Notes

### QR-056: Rolling Validation Window Deprecation and Pass-Throughs
* **Description:** `rollingValidationService.js` (`recalculateRollingValidation`, `getEffectiveReservationStatus`, `getNumbersAheadForWindow`) has been preserved as safe pass-through functions (`return;` or `return reservation.status;`) for backwards compatibility after the refactored workflow removed rolling validation time windows.
* **Notes:** Ensures no errors occur in legacy call paths while supporting modern permanent QR validation without time window constraints.
