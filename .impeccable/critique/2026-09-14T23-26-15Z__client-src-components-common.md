---
target: solid modal style after glass removal
total_score: 23
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
p2_count: 2
target_identity: "file:C:\\Users\\canil\\OneDrive\\Documents\\CAPSTONE-PROJECT\\pediatric-clinic-queue-system\\client\\src\\components\\common"
timestamp: 2026-09-14T23-26-15Z
slug: client-src-components-common
---
# PlusQueue solid modal system (post glass removal)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | Spinners exist but are silent divs; some errors close the dialog and dump to toast |
| 2 | Match System / Real World | 3 | Clinic language is good; “Okay” and title/button wording drift leak generic-app voice |
| 3 | User Control and Freedom | 3 | Esc + Cancel on most; MessageModal has no Esc/scrim dismiss |
| 4 | Consistency and Standards | 2 | Shared confirm interiors still Tailwind gray/blue/red on a PlusQueue plate |
| 5 | Error Prevention | 2 | Delete Account is strong; cancel reservation still looks like an info confirm |
| 6 | Recognition Rather Than Recall | 2 | Complete consult keeps name + queue #; cancel reservation does not restate ticket |
| 7 | Flexibility and Efficiency | 2 | Esc inconsistent; no focus trap; Walk-in is a full form in a dialog |
| 8 | Aesthetic and Minimalist Design | 3 | Solid plate + dim scrim is the right Operate move over frost chrome |
| 9 | Error Recovery | 2 | Delete shows inline error; cancel reservation error dismisses the modal |
| 10 | Help and Documentation | 2 | Close-queue / end-session / retention copy is honest; cancel copy is thin |
| **Total** | | **23/40** | **Acceptable** |

## Design Specificity Verdict

**LLM assessment:** The solid `#ffffff` plate over frost nav/cards does not read as a second kit at the chrome level. Teal umbra, 1px glass-line, 1.5rem radius, and ink-48% dim (no blur) are the same family as pane frost — paper dropped on the waiting-room window. Role-specific task dialogs stay in-token. Shared commons still dress the inside as generic Tailwind SaaS, which undermines the unified container. Frost-era 55% white insets on `#ffffff` go ghost.

**Deterministic scan:** Impeccable detect returned 0 findings (exit 0, `[]`) across common, parent, secretary, doctor, admin, schedule, and branch component trees. JSX `pq-glass-modal` usages: 0. `backdrop-filter` on `.pq-modal` / `.pq-modal-scrim`: absent. `.pq-glass` / `.pq-glass-nav` still have blur.

**Visual overlays:** No reliable user-visible overlay is available. Browser visualization skipped (no browser tool exposed).

## Overall Impression

The glass-off-modals brief landed. Dialogs now lift as opaque plates while chrome stays frost. The remaining seam is interior language (Tailwind confirms, ghost insets), not the container.

## What's Working

1. Elevation split: opaque plate + ink dim, no blur, teal lift.
2. Tokened task dialogs (Walk-in, QCC, Reservation Details, Add Staff) still speak PlusQueue.
3. Staff high-stakes copy (close-queue, end-session, delete retention) stays operationally honest.

## Priority Issues

**[P1] Shared confirms are a second kit — cancel reservation wears the casual skin**
- **Why it matters:** Plate says PlusQueue; guts say Tailwind dashboard. Slot-loss looks like “OK to continue?” in blue.
- **Fix:** Rebuild commons on `pq-btn-*` and alert/ink tokens. Mark cancel reservation destructive; restate ticket + child + date.
- **Suggested command:** `/impeccable polish`

**[P1] Frost-era insets go ghost on solid white**
- **Why it matters:** 55% white rows and 72% inputs were mixed for wash-behind-glass. On `#ffffff` grouping dies.
- **Fix:** Modal-scoped insets: paper/mist or ink-4% fill, full glass-line, solid field fills.
- **Suggested command:** `/impeccable layout`

**[P1] Dialog a11y is incomplete (WCAG 2.2 AA)**
- **Why it matters:** No focus trap. MessageModal is not a dialog. Several titles not wired. Unnamed icon buttons.
- **Fix:** One labelled dialog primitive: trap, Esc, restore focus, aria-busy.
- **Suggested command:** `/impeccable audit`

**[P2] Two (really four) confirm species**
- **Why it matters:** ConfirmationModal vs QCC custom vs MessageModal vs InformationModal.
- **Fix:** One tokened confirm; one tokened alert.
- **Suggested command:** `/impeccable distill`

**[P2] Cancel reservation is a memory bridge**
- **Why it matters:** Parent must remember which visit they are killing.
- **Fix:** Show queue #, child, branch, date; keep dialog open on error.
- **Suggested command:** `/impeccable clarify`

## Persona Red Flags

**Sam:** Tab leaves the dialog. MessageModal never announced as a dialog. Confirm titles not wired. Contrast of ink on white is fine (~11:1); the miss is structure.

**Casey:** Cancel reservation looks like a blue info card. Reservation Details is a long scroll of ghosted blocks.

**Alex / Secretary:** Walk-in is a full check-in form in a 90vh modal. Success opens MessageModal on top of Walk-in.

## Minor Observations

- Shared confirm interiors still use gray/blue/red Tailwind — constraint of this pass (container only).
- Inner `color-mix(#ffffff … transparent)` remains in some modal bodies (Reservation Details, Walk-in, Add Staff).
- DESIGN.md overview still says staff must not inherit this palette; `.pq-shell` + `.pq-modal` are already cross-role.

## Questions to Consider

- If the plate is paper, why are the rows still mixed as frost?
- Should ConfirmationModal be replaced by the QCC header/footer pattern?
- Is Walk-in a modal because it is a dialog, or because the desk never got a page?
