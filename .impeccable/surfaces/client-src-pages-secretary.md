---
version: 1
slug: "client-src-pages-secretary"
primary_target: "client/src/pages/secretary"
related_targets: ["client/src/components/secretary","client/src/components/schedule"]
---

# Secretary operate — surface brief

Mode: Operate. Audience: the front-desk secretary at a branch desk, tablet, or phone during a live clinic day. Task: see today's published session, start the queue, check in arrivals, send the next patient, create walk-ins, watch the lobby monitor.

## Direction contract

THESIS: PlusQueue secretary is a clinic window onto the desk — one frost frame, opaque data, check-in and send-to-doctor as the lit marks. Refuses nested SaaS cards, stacked blur on queue lists and walk-in child groups, and a second design system beside Parent/Doctor.

OWN-WORLD: Same daylight aqua-to-peach wash, Lexend, teal ink #16344A, mark-blue / coral / gold / live / wait / alert. One frost pane per region (`pq-glass`, 18px blur). Queue numbers, names, walk-in child groups, and monitor plates sit on opaque insets (`pq-row` / `pq-stat` / `pq-queue-plate`), never a second `backdrop-filter`. PlusQueue mark as the window badge.

STORY: A secretary opens the app and can say, in one glance, whether today's schedule is live, who is with the doctor, and who is next — then take one next action (validate, send, penalize, walk-in, start queue).

FIRST VIEWPORT: Desk-width. Wash canvas. Glass sidebar + header (Parent/Doctor chrome, Secretary items: Dashboard, Schedules, Validate, Queue, Profile). Dashboard: one frost pane of published schedule; live-wash current-consultation plane; counts as inset tiles. Queue: numbered opaque rows. Walk-in: one glass modal, repeating child groups as opaque insets.

FORM: Established Parent world `daylight-waiting-room-frost` extended to Secretary Operate. No new identity. Signature interaction: current consultation is the now-serving analog — live wash + coral pip while a patient is in the room. Raises: one frost layer (Parent); opaque scan rows (secretary scanability constraint); walk-in child groups stay insets.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.

## Constraints

- Frontend presentation only. No service, Firebase, queue, walk-in, cancel-reservation, or SMS logic changes.
- Shared ConfirmationModal / MessageModal stay untouched.
- Walk-in dynamic child groups keep the same add/resize behavior.
- Cancel Reservation remains walk-in-only in the contact modal.
- System Configuration is admin-only; secretary profile does not gain it.
- Login is the shared auth surface (already redesigned).
- WCAG 2.2 AA, 44px targets, `:focus-visible`.
- Queue list, walk-in child groups, and monitor number plates: reduced glass (insets, not per-row blur) for scanability.
