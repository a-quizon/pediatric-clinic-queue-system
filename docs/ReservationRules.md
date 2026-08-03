# Reservation Rules & Specification

This document serves as the **official specification** for the pediatric clinic Reservation System. It documents the current lifecycle, state management, interactions with the Queue Engine, and the strict rules governing reservations from creation to historical archiving.

---

## 1. Overview
The Reservation System handles the generation, tracking, and progression of patient appointments within a specific clinic schedule. It works directly alongside the Queue Engine; while the Reservation System tracks *what* a reservation is (its data, code, parent, and status), the Queue Engine tracks *where* that reservation sits relative to others in the physical clinic (its dynamic queue order).

---

## 2. Reservation Lifecycle
A reservation follows a strict linear progression, with early exits for cancellations or penalties.

**Standard Flow:**
1. **Reservation Created** (Status: `reserved`)
2. **Checked In** (Status: `checked_in`)
3. **Consultation In Progress** (Status: `in_consultation` / `with_doctor`)
4. **Consultation Completed** (Status: `consultation_completed`)
5. **Reservation History** (Archived permanently)

**Early Exits:**
* **Cancelled**: Terminated manually by the parent.
* **Forfeited**: Terminated by the Secretary due to exceeding the clinic's late penalty limit.

---

## 3. Reservation Statuses
| Status | Meaning | Trigger | Next Possible Statuses |
|--------|---------|---------|------------------------|
| **reserved** | Initial state upon creation. Parent has a slot. | Parent completes reservation form. | `checked_in`, `cancelled` |
| **waiting** | Same as reserved, awaiting check-in. | Alternate string used interchangeably. | `checked_in`, `cancelled` |
| **checked_in** | Patient is physically at the clinic. | Secretary validates QR or Code. | `with_doctor`, `in_consultation`, `cancelled` |
| **with_doctor** | Patient has been called to the Doctor's room. | Secretary clicks "Send to Doctor". | `consultation_completed` |
| **in_consultation** | Patient is actively being seen. | Interchangeable with `with_doctor`. | `consultation_completed` |
| **consultation_completed**| The medical visit is finished. | Doctor clicks "Complete Consultation". | *(Terminal State)* |
| **cancelled** | The reservation was abandoned. | Parent clicks "Cancel". | *(Terminal State)* |
| **forfeited** | Exceeded late limit. Slot is lost. | Secretary applies final penalty. | *(Terminal State)* |

*(Note: Statuses like `expired`, `validation_expired`, `validation_open`, and `waiting_for_window` exist in code strings for legacy compatibility but are effectively inactive in modern progression.)*

---

## 4. Reservation Creation Rules
* **Schedule Selection**: Parents can only reserve slots on schedules marked as `published`.
* **Slot Consumption**: Creating a reservation immediately consumes 1 slot from the schedule's `slotCapacity`.
* **Unique Validation**: A parent may only have **one active reservation** per clinic date. The system actively checks for existing non-terminal reservations before allowing creation.
* **Identity Generation**: Upon creation, the system generates a 6-character alphanumeric `reservationCode`.
* **Queue Number Assignment**: The system queries existing reservations for that schedule and assigns the next incremental integer as the permanent `queueNumber`.

---

## 5. Reservation Cancellation Rules
* **Who Can Cancel**: Only the Parent can cancel a reservation. The Secretary penalizes; the Parent cancels.
* **When Allowed**: A parent can cancel as long as the status is `reserved` or `waiting`. They cannot cancel once they are `checked_in`.
* **Slot Release**: Cancelling instantly transitions the status to the terminal `cancelled` state, which excludes it from "active" calculations. This effectively frees up the slot for another user to claim.
* **Queue Recalculation**: Cancellation triggers `recalculateEntireQueue`, which shifts all patients waiting behind the cancelled user forward by one position.

---

## 6. Check-in Rules
* **Responsibility**: Only the Secretary can check in a patient.
* **Validation Method**: The Secretary scans the parent's generated QR Code, or manually enters the 6-character `reservationCode`.
* **Verification**: The system looks up the code. If valid and matching an active reservation for today, the status is updated to `checked_in`.
* **Requirement**: A patient MUST be `checked_in` before they can be sent to the Doctor.

---

## 7. Consultation Rules
* **Initiation**: The Secretary clicks "Send to Doctor", shifting the `checked_in` patient to `with_doctor`.
* **Queue Engine Block**: This action triggers the Queue Engine's Active Consultation lock. 
* **Restriction**: While this reservation holds the `with_doctor` or `in_consultation` status, the Secretary is explicitly barred from sending any other patient into the room. 

---

## 8. Reservation Completion Rules
* **Initiation**: The Doctor is exclusively responsible for clicking "Complete Consultation".
* **Data Attachment**: The Doctor may attach `doctorNotes` which are permanently saved to the reservation record.
* **Slot State**: Completing a consultation formally removes the reservation from the active queue pipeline. This immediately releases the slot back into the pool, allowing a new reservation to be created if capacity permits.
* **Queue Unlocking**: This terminal state signals the Queue Engine to lift the Active Consultation lock, allowing the Secretary to send the next patient.

---

## 9. Slot Management Rules
Slots are evaluated dynamically at runtime by counting active reservations.
* **Total Capacity**: Defined by the Doctor upon Schedule creation (e.g., 30 slots).
* **Consumption**: Any reservation that is `reserved`, `waiting`, `checked_in`, `with_doctor`, or `in_consultation` counts as 1 consumed slot.
* **Release**: Any reservation that reaches a terminal state (`cancelled`, `forfeited`, or `consultation_completed`) is excluded from the active count, immediately releasing the slot back to the public pool for a new reservation.

---

## 10. Parent Rules
* **Reserve**: May book one active reservation per clinic day.
* **View Ticket**: Can view their live digital ticket, displaying their permanent `queueNumber`, generated QR code, and `reservationCode`.
* **View Queue Status**: Can monitor their dynamic `queueState` (e.g., "Almost Next") and `aheadOfYou` count relative to the live clinic floor.
* **Cancel**: May cancel at any time before consultation begins.
* **History**: Can view all past `consultation_completed` and `cancelled` reservations.

---

## 11. Secretary Rules
* **Monitor Floor**: Observes the physical clinic flow.
* **Check In**: Validates QR codes.
* **Penalize**: Applies penalties to absent patients. If the penalty count reaches the schedule's `lateLimit` (usually 3), the Secretary's action automatically transitions the reservation to `forfeited`.
* **Send to Doctor**: Manages the final gateway into the consultation room, strictly abiding by the Active Consultation lock.

---

## 12. Doctor Rules
* **Schedule Creation**: Defines the framework (date, time, slot capacity) within which reservations are created.
* **Queue Control**: Starts the queue, which enables the live pipeline.
* **Consultation**: Receives the patient.
* **Completion**: Ends the reservation lifecycle by completing the consultation and providing optional notes.

---

## 13. Historical Records
Reservations are never deleted from the database. 
* **Archiving**: Once a reservation reaches a terminal state (`consultation_completed`, `cancelled`, `forfeited`), it is permanently excluded from dynamic queue sorting and capacity (except completed, which still counts against capacity).
* **Preservation**: The original `queueNumber`, timestamps (`createdAt`, `completedAt`), attached `doctorNotes`, and the final `status` are preserved indefinitely.
* **Parent View**: Parents access these records via their "Reservation History" page.

---

## 14. Edge Cases
* **Cancelling After Check-in**: A parent is **not** allowed to cancel their reservation once they are marked `checked_in`. Cancellation is only permitted prior to check-in. Once checked in, the reservation becomes part of the active physical clinic workflow.
* **Penalized but Only One Waiting**: If a patient is penalized but no one is behind them, their penalty count increases but their `queueOrder` cannot shift backward.
* **Full Schedule / Released Slot**: If a schedule hits its capacity (e.g., 30/30), it appears "Full". If a parent cancels, the active count drops to 29/30, and the schedule instantly becomes available for a new parent to book.

---

## 15. Rule Priority Order
When conflicting reservation events occur, the system evaluates them in this order:

1. **Terminal State Rule**: Once a reservation is cancelled, forfeited, or completed, no further state mutations can occur on it.
2. **Duplication Rule**: A parent cannot create a reservation if an active one already exists for that day.
3. **Capacity Rule**: A reservation cannot be created if active + completed reservations >= slot capacity.
4. **Active Consultation Rule**: A reservation cannot transition to `with_doctor` if another reservation holds that state.
5. **Penalty Limit Rule**: A reservation cannot simply shift backward if its penalty count >= `lateLimit`; it must transition to `forfeited`.

*Why this order?* Data integrity is paramount. Terminal states protect historical records. Duplication and Capacity rules protect the physical clinic from overcrowding. The Consultation rule protects the Doctor's workflow.

---

## 16. Regression Protection Checklist
When modifying the Reservation System, developers must verify the following constraints remain intact:

- [ ] ✓ Reservation creation always consumes a slot.
- [ ] ✓ Completed consultation releases a slot back to the public pool.
- [ ] ✓ Cancellation releases a slot back to the public pool.
- [ ] ✓ A patient's original `queueNumber` never changes, even if their dynamic `queueOrder` does.
- [ ] ✓ QR Code and Reservation Code remain static and valid for the duration of the active reservation.
- [ ] ✓ Reservation History accurately preserves `consultation_completed`, `cancelled`, and `forfeited` records.
- [ ] ✓ Queue Engine synchronization (`recalculateEntireQueue`) fires accurately on creation, check-in, cancellation, and completion.
