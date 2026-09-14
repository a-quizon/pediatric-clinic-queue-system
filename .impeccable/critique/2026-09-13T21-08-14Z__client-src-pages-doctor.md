---
target: doctor
total_score: 25
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
target_identity: "file:C:\\Users\\canil\\OneDrive\\Documents\\CAPSTONE-PROJECT\\pediatric-clinic-queue-system\\client\\src\\pages\\doctor"
timestamp: 2026-09-13T21-08-14Z
slug: client-src-pages-doctor
---
Method: dual-agent (A: 92fb904a-4306-4183-9ddd-ffc201552deb · B: 78be959f-1917-4e99-abca-557f70266adc)

Target: `client/src/pages/doctor` (related: `client/src/components/doctor`)
Mode: Operate — clinic doctor, live session

#### Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Session chips, pip, and live-wash current consult are clear; Home stats can diverge from QCC; empty state points at a screen the doctor does not have |
| 2 | Match System / Real World | 3 | Walk-in, In Consult, child name/age/sex/concern fit the room; Complete Session vs Complete Consultation vs End Clinic Session; Reports “Checked Up” vs Home “Completed” |
| 3 | User Control and Freedom | 3 | Cancel on Complete / Close / End / Logout; Resume undoes Pause; operate modals lack Escape/focus trap; no undo after Complete |
| 4 | Consistency and Standards | 2 | `pq-*` world holds the core; ReservationStatusBadge and Logout ConfirmationModal are a second Tailwind kit |
| 5 | Error Prevention | 3 | Destructive confirms exist; End Session looks disabled (opacity 0.55) but still clicks; Pause is unlabeled and unconfirmed |
| 6 | Recognition Rather Than Recall | 2 | Pause and Close Queue are icon-only; next patient is list order only; doctor must remember the secretary starts the queue |
| 7 | Flexibility and Efficiency | 2 | Desktop Home remounts full QCC as the only accelerator; no shortcuts for Pause / Complete / End |
| 8 | Aesthetic and Minimalist Design | 2 | Opaque inset rows are right; Home first viewport is seven stats + overview + three more frost QCC panes |
| 9 | Error Recovery | 2 | End-session toast when the line is not empty is actionable; most failures are “Failed to …” with no retry |
| 10 | Help and Documentation | 2 | Walk-in notes helper is good; empty “Go to Schedule Management” is a broken door, not help |
| **Total** | | **25/40** | **Acceptable** |

#### Design Specificity Verdict

**Start here.** Mixed — the live queue is authored for PlusQueue; the edges still look like clinic SaaS.

**LLM assessment**: QueueControlCenter is the thesis made visible: one live-wash current-consult plane, huge child name, Walk-in as a wait chip, numbered opaque wait rows, Complete as a solid live control, walk-in notes disabled and looking disabled. Layout reuses Parent frost chrome (PqBrand, glass header/sidebar/dock) with Doctor items. Home stats sit on `pq-stat` insets inside one frost pane; Schedule Overview uses `pq-row`, not per-row blur. That is not an interchangeable EMR.

The extension frays where a second kit leaks in (ReservationStatusBadge Tailwind pills; Logout ConfirmationModal gray/blue/red) and where the first Operate glance is a seven-tile load board with a remounted control center instead of the child in the room. Reports is category analytics (five KPIs, Recharts, “Checked Up”). Profile About copy is “A modern solution for managing clinic queues.” Unused `ScheduleDetailsModal` still lives under `components/doctor` but is only mounted from secretary Schedule Management.

**Deterministic scan**: `impeccable detect --json` on `client/src/pages/doctor` and `client/src/components/doctor` both exited 0 with **0 findings**. Detector and LLM agree that the tokenized `pq-*` markup is not generic-gradient / AI-slop. Detector did not catch IA, copy collisions, icon-only session controls, or the second-kit badges — those are not in its rule set. No false positives.

**Visual overlays**: No reliable user-visible overlay. Fallback signal: this session has no mutation-capable browser automation; live-server and `detect.js` injection were skipped. `/doctor/*` is auth-gated. Review is source + CLI scan, not a live [Human] tab.

#### Overall Impression

The consultation lock is designed. The doctor’s first minute is not. Biggest opportunity: make the first viewport answer “session state, who is in the room, who is next, one next action” — and stop sending an empty session to a Schedule Management screen the doctor cannot open.

#### What's Working

- **Current consultation plane.** Live-wash header, huge `ReservationPatientNames`, Walk-in chip, concern note, and `pq-btn-live` Complete Consultation. This is the now-serving analog the brief asked for.
- **Opaque scan rows.** Waiting list uses numbered `pq-queue-plate` on `pq-row` insets, not stacked glass. Reports/Home tiles follow the same inset rule. One frost layer holds.
- **Operational confirm copy.** Close Queue and End Clinic Session say what happens to existing reservations without panic. Walk-in notes that look disabled are the honest constraint, not a broken field.

#### Priority Issues

- **[P1] Dashboard first glance is load tiles, not the room**
  - **Why it matters**: Desk Home is seven counts (Total Reservations at display size, then Waiting / In Consult / Completed / Checked In / Cancelled / Forfeited), Schedule Overview, then a remounted QueueControlCenter. Dr. Mira cannot say who is in consult from the first viewport; she scans a SaaS board and scrolls. Phone Home strips QCC entirely.
  - **Fix**: First viewport = session chip + current child (or empty-session) + one next action. Keep today’s counts as ≤4 inset tiles. Do not remount full QCC on Home; send operate to `/doctor/queue`.
  - **Suggested command**: `/impeccable distill`

- **[P1] Session controls hide the next action**
  - **Why it matters**: Pause and Close Queue are icon-only `pq-icon-btn` (aria-label + title only). End Clinic Session uses `pq-btn-danger` or a still-clickable faded `pq-btn-secondary` (opacity 0.55, cursor not-allowed, not `disabled`). Complete’s modal primary says “Complete Session,” which reads like ending the clinic. Alex will click the ghost End; Sam will not hear disabled; Casey will miss Pause under the dock.
  - **Fix**: Label Pause / Resume / Close. Use `disabled` + `aria-disabled` when `canEndSession` is false. Keep Complete as the only solid live control. One verb for finishing a consult.
  - **Suggested command**: `/impeccable clarify`

- **[P1] Empty session is a dead door**
  - **Why it matters**: Empty QCC: “Go to Schedule Management and click Start Queue on a published schedule.” Doctor nav is Dashboard / Queue / Reports / Profile. Starting the queue is a secretary job. Home empty (“Publish a schedule…”) is equally un-actionable.
  - **Fix**: Empty copy must name the real path (wait for the secretary / published schedule) and show session-not-started status. Do not point at a missing nav item.
  - **Suggested command**: `/impeccable onboard`

- **[P2] Next patient is not the lit mark**
  - **Why it matters**: The brief requires session + current child + who is next. Waiting rows are equal weight. Secretary monitor already has `pq-row-you` / `pq-queue-plate-next`; doctor does not. Current queue number is a chip, not a tabular plate on the live-wash plane.
  - **Fix**: Mark waiting index 0 as next. Put a tabular plate beside the current name on the live-wash plane.
  - **Suggested command**: `/impeccable layout`

- **[P2] Second design system at the edges**
  - **Why it matters**: `ReservationStatusBadge` on wait rows and Logout `ConfirmationModal` on Profile are Tailwind gray/blue/red beside `pq-chip` / `pq-glass-modal`. “Checked Up” vs “Completed” forces a glossary mid-clinic.
  - **Fix**: Retoken badges and logout to the Parent/Doctor world. One status verb across Home and Reports. Do not restyle secretary-mounted ScheduleDetailsModal as a doctor-only leftover — it is shared.
  - **Suggested command**: `/impeccable polish`

#### Persona Red Flags

**Alex (Power User)**: No shortcuts for Pause / Complete / End. Complete always opens a notes modal, even empty. Home and Queue remount the same QCC. Waiting rows have zero actions (correct for consult lock; fatal if he expects Call Next). Toast “Queue status updated to ${status}” is intern copy.

**Sam (Accessibility)**: Current-consult block is a clickable `div`; View Details is the keyboard entry. QCC operate dialogs have no Escape or focus trap. End Session is not actually disabled. Hide-completed control is forced to 36×36. Profile email is a labeled non-input with no `htmlFor`. Status color on ReservationStatusBadge is a second palette. Reports error is a lone line with no retry.

**Casey (Distracted mobile)**: Below `lg`, QCC is stripped from Home; “Open Queue Control” only if status is published. Reports is `desktopOnly` in the dock — phone path is Profile hub → Reports. Complete sits mid-card above a 6.5rem dock. Pause / Close cluster in the session header, not the thumb zone. Wait list is `max-h-96` overflow.

**Dr. Mira (clinic pediatrician)**: Lands on Dashboard, sees Total Reservations, not the child in consult. Must open the schedule dropdown or scroll to QCC (desk) / switch to Queue (phone). Next child is unmarked. If the secretary has not started the queue, she is sent to a screen she does not have.

#### Minor Observations

- `ScheduleDetailsModal.jsx` is unused on `/doctor/*` (mounted from secretary `ScheduleManagement`); leftover Tailwind `getStatusColor`; computed queue list never painted — do not delete for “doctor unused” without checking secretary.
- Home unused: `isCompletedSession`, `formatDate`, `activeBranch`; dropdown shows raw `clinicDate`.
- QCC unused imports: `getNextEligiblePatient`, `expireReservation`, `ScheduleConfirmModal`, `CheckCircle2`.
- `ReservationPatientNames` on wait rows keep default `text-gray-800`.
- Hide completed control overrides `pq-icon-btn` to 36×36.
- Reports five-up KPI row and four equal-weight date buttons.
- Profile About: “A modern solution…” — not PlusQueue operate voice.
- Modal scrim blur(10px) + `pq-glass-modal` blur(18px) stacks frost on confirms (lists/tables themselves stay opaque).
- `PqSpinner` visible label is sr-only only.

#### Questions to Consider

- If the secretary starts the queue and sends the next child, why is the doctor’s first screen a seven-tile load board instead of the consultation lock?
- Should Pause be a labeled, reversible hold, not a gold icon next to a lock and a red End?
- What would “who is next” look like if the first wait row used the same now-serving language as the parent ticket?
- Can Home stop being a second Queue page on desktop without making Dr. Mira hunt?
- If walk-in notes must stay disabled, should Complete skip the notes modal entirely for walk-ins?
