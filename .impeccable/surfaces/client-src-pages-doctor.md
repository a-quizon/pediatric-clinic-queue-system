---
version: 1
slug: "client-src-pages-doctor"
primary_target: "client/src/pages/doctor"
related_targets: ["client/src/components/doctor"]
---

# Doctor operate — surface brief

Mode: Operate. Audience: the clinic doctor at a desk, tablet, or phone during a live session. Task: see today's load, control the queue, complete the current consultation, scan reports.

## Direction contract

THESIS: PlusQueue doctor is a clinic window onto the live room — one frost frame, opaque data, the current patient as the lit mark. Refuses nested SaaS cards, stacked blur on lists/tables, and a second design system beside Parent.

OWN-WORLD: Same daylight aqua-to-peach wash, Lexend, teal ink #16344A, mark-blue / coral / gold / live / wait / alert. One frost pane per region (`pq-glass`, 18px blur). Queue numbers, names, and table cells sit on opaque insets (`pq-row` / `pq-stat`), never a second `backdrop-filter`. PlusQueue mark as the window badge.

STORY: A doctor opens the app and can say, in one glance, session state, who is in consultation, and who is next — then take one next action (pause, complete, end session).

FIRST VIEWPORT: Desk-width. Wash canvas. Glass sidebar + header (Parent chrome, Doctor items). Dashboard: one frost pane of today's counts as inset tiles; schedule overview as inset rows. Queue: live-wash current-consultation plane with tabular queue plate and huge patient name; waiting list as numbered opaque rows. Complete is a solid live control. Walk-in is a wait chip; notes stay disabled and look disabled on purpose.

FORM: Established Parent world `daylight-waiting-room-frost` extended to Doctor Operate. No new identity. Signature interaction: current consultation is the now-serving analog — live wash + coral pip while a patient is in the room. Raises: one frost layer (Parent); opaque scan rows (doctor scanability constraint).

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.

## Constraints

- Frontend presentation only. No service, Firebase, queue, notes-for-walk-in, or reports-filter logic changes.
- Shared staff modals used by secretary/admin stay untouched.
- Reports date/branch filters keep the same values and handlers.
- WCAG 2.2 AA, 44px targets, `:focus-visible`.
- Queue list and Reports table: reduced glass (insets, not per-row blur) for scanability.
