# System Business Rules & Operations

This document is the highest-level business specification for the Pediatric Clinic Queue Management System. It describes how the core modules—User, Branch, Schedule, Reservation, Queue, and Notification—interact to support the clinic's overarching business processes and workflows.

---

## 1. Overview
The Pediatric Clinic Queue Management System is designed to digitize and orchestrate the flow of patients through a multi-branch physical clinic. The primary business goals are to eliminate chaotic physical waiting rooms, enforce strict capacity and consultation rules, provide real-time transparency to parents regarding their turn, and empower clinic staff with isolated, branch-specific control over operations.

---

## 2. System Actors

* **Parent / Guardian**: The end-user who consumes clinic services. They browse available schedules, reserve slots, monitor their dynamic queue position remotely, and bring the patient to the clinic for QR validation.
* **Secretary**: The frontline branch manager. They physically verify patient arrivals (Check In), enforce clinic attendance policies (Penalize), and control the flow of patients into the doctor's room (Send to Doctor).
* **Doctor**: The primary medical provider and schedule controller. They define when and where clinics operate (Schedules), when a session officially begins (Start Queue), and when a medical visit concludes (Complete Consultation).
* **Admin**: The system operator. They manage the internal business structure by creating staff accounts (Secretaries) and defining the clinic's physical locations (Branches). 

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

1. **Schedule Published** → The Doctor opens a clinic day for a specific branch.
2. **Parent Reserves** → Parent books an available slot, securing a permanent Ticket Number.
3. **Check-In Requested** → (Optional) Secretary pings the parent to approach the desk.
4. **Secretary Checks In** → Parent arrives at the physical clinic and the Secretary scans their QR code.
5. **Patient Waits** → Patient waits in the physical lobby while monitoring their live Queue State.
6. **Secretary Sends to Doctor** → The Secretary permits the #1 checked-in patient to enter the consultation room.
7. **Consultation** → The Doctor examines the patient.
8. **Doctor Completes Consultation** → The Doctor finalizes the visit, clearing the room.
9. **Reservation History** → The reservation is archived permanently.

---

## 5. Reservation Workflow
Reservations act as the gateway into the Queue Engine. 
* **Creation Requirements**: To successfully create a reservation, the following rigid conditions must be met:
  1. The target schedule must be `published`.
  2. The schedule must have active slot capacity available.
  3. The parent must not already have an active, non-terminal reservation for that specific clinic date.
*(Note: Branch clinic operating hours are enforced when the Doctor creates or edits the Schedule. The Reservation System simply trusts the already-validated Published Schedule.)*
* **Queue**: Once created, a reservation is instantly injected into the Queue Engine pipeline where it receives a permanent `queueNumber` and a dynamic `queueOrder`.
* **Consultation**: A reservation must traverse from `reserved` -> `checked_in` -> `with_doctor` -> `consultation_completed`.
* **History**: Upon reaching a terminal state (completed, cancelled, or forfeited), it drops out of the active queue and moves to the historical ledger.

---

## 6. Queue Workflow
The Queue Engine governs the flow of active reservations.
* **Queue Order**: The queue initially follows a strict First-In, First-Out (FIFO) pipeline based on creation time.
* **Dynamic Ordering vs Permanent Identity**: Every reservation receives a permanent Ticket Number (`queueNumber`) that never changes. However, official penalty actions dynamically adjust the active `queueOrder` (the relative line position) without altering the original Ticket Number.
* **Penalties**: If a patient is absent when called, the Secretary applies a penalty. This shifts their internal sorting timestamp backward, dynamically moving them behind other waiting patients.
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
* **Configuration**: Admins define Branch Names, Clinic Addresses, and operational metadata.
* **Secretary Assignment**: Secretaries are strictly bound to a single Branch Configuration, ensuring they only see data relevant to their physical location.
* **Schedule Creation**: Doctors attach every clinic schedule to a specific Branch, ensuring patients know exactly where to go and separating queue pipelines.

---

## 10. User Management
User Management ensures role-based access control.
* **Admin**: Operates purely in the back-office. They create Doctor and Secretary accounts, assign roles, and bind Secretaries to Branches. They do not interact with patients.
* **Doctor & Secretary**: Staff accounts created by the Admin.
* **Parent**: Self-registering consumer accounts that authenticate via the public-facing app. 

---

## 11. Notification Workflow
Notifications provide real-time transparency, reducing physical clinic congestion.
* **Queue Updates**: Pings parents proactively when their dynamic state shifts to "Almost Next" or "You're Next", or when the Secretary requests they approach the desk.
* **Consultation Updates**: Confirms when they enter and exit the consultation room.
* **Penalty Updates**: Alerts parents if they are penalized for absence or permanently forfeited due to exceeding the late limit.
* **Schedule Updates**: Informs parents when a new schedule becomes available, when the queue starts/pauses/closes, and when the session ends.
*(Note: Notifications for reservation creation and manual cancellation are not currently implemented, relying instead on UI state changes).*

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
* **Doctor Schedule Ownership**: Only the Doctor role is authorized to manage clinic schedules. This includes creating, editing, publishing, completing schedules, as well as starting and closing the live queue.
* **Admin Exclusivity**: Only the Admin can create or modify staff accounts.
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
