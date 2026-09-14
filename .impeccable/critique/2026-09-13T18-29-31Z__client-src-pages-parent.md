---
target: client/src/pages/parent
total_score: 20
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 4
target_identity: "file:C:\\Users\\canil\\OneDrive\\Documents\\CAPSTONE-PROJECT\\pediatric-clinic-queue-system\\client\\src\\pages\\parent"
timestamp: 2026-09-13T18-29-31Z
slug: client-src-pages-parent
---
# PlusQueue parent + auth critique — `client/src/pages/parent`

**Mode:** Operate  
**Target:** parent pages + shared auth after daylight-waiting-room-frost restyle  
**Live inspection:** CLI detect clean. No browser MCP overlay. Valid screenshots: login, register, forgot. `parent-desktop.png` / `parent-mobile.png` are unauthenticated Sign in redirects — ignored.

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | Ticket + pip exist in source; auth errors are toasts; Register stays dead with no inline “why” |
| 2 | Match System / Real World | 3 | Queue / ahead / now-serving speak clinic; “Validation Open”, “Waiting for Window”, “Authenticating...” leak system language |
| 3 | User Control and Freedom | 2 | Login/forgot exits exist; reserve creates the slot first, then “Cancel Reservation” is the only modal escape |
| 4 | Consistency and Standards | 2 | `pq-*` on parent/auth; staff badge + Confirmation/Message/Information modals rupture ticket/QR; two ticket metaphors |
| 5 | Error Prevention | 2 | OTP and capacity guards exist; reserve-then-fill trap; forgot can reveal “No user found” |
| 6 | Recognition Rather Than Recall | 3 | Labeled 4-key nav; ticket # vs people-ahead vs now-serving still unexplained |
| 7 | Flexibility and Efficiency | 1 | One rigid path; forced child onboarding; OTP + email + child before the product |
| 8 | Aesthetic and Minimalist Design | 2 | Ticket split is the designed moment; auth is empty-card SaaS; empty home is KPI tiles |
| 9 | Error Recovery | 2 | Some inline OTP/password copy; most failures are toast; reserve errors use unstyled staff MessageModal |
| 10 | Help and Documentation | 1 | QR has one secretary hint; no help on ticket vs turn, late/penalty, or why Register is disabled |
| **Total** | | **20/40** | **Acceptable** |

## Design Specificity Verdict

**Start here.** Tokens are authored for PlusQueue. Captured auth is still category-interchangeable glass-SaaS. Parent home (source) has a real ticket window, then breaks the thesis with a second frost pane and a 2×2 public-status KPI board.

**LLM assessment:** Lexend, teal ink, mark-blue / coral / gold, 18px frost, ticket split, now-serving pip, and wait keys are product-specific. Login/register/forgot screenshots are a centered card on an aqua–peach wash: swap the PNG and it is any healthcare login. Coral and gold live mainly in the logo. Dashboard ticket composition exists in `Dashboard.jsx` (`pq-ticket`, `pq-now`, `pq-pip`) and cannot be proven from login captures.

**Deterministic scan:** `impeccable detect --json` on 25 parent/auth markup files exited 0 with `[]`. Zero findings. No `border-b-2` spinner hits. Detector did not see KPI empty-home, dual frost panes, 10–11px captions, or toast-only errors.

**Visual overlays:** No user-visible overlay. No browser MCP; live-server and `detect.js` were not started. Fallback: CLI + `.impeccable/review` screenshots.

## Overall Impression

The skin is no longer gray Tailwind SaaS. The waiting-room window only appears after a parent has a live reservation — and even then it is split across two glass panes. Empty Home still looks like a secretary status board. Auth is calm and generic.

The single biggest opportunity: make Home one frost pane (ticket, or one Reserve action) and stop using a KPI grid as the public status card.

## What's Working

1. **Ticket split in source** — huge “My Queue Number” beside people ahead, now-serving strip, coral pip.
2. **Login as a single-task pane** — official mark, two fields, solid mark-blue Sign In, 44px targets.
3. **Phone chrome** — frost header, four labeled footer keys, profile as identity + inset list.

## Cognitive load

**7 of 8 checklist items fail** (only grouping passes). High load.

Decision points with >4 visible options: history filters (5), profile links + logout (5), unbounded reserve cards, register field wall.

## Priority Issues

### [P1] Captured auth is interchangeable glass-SaaS, not a waiting-room window
- **What:** Wash + logo + white card. No frost-through, no coral/gold grammar, no ticket preview.
- **Why it matters:** Parents never meet the product thesis before sign-in.
- **Fix:** Auth pane as one window against the wash; keep operational copy.
- **Suggested command:** `/impeccable polish`

### [P1] Empty dashboard is a KPI board the thesis refuses
- **What:** “Today’s Clinic Status” 2×2 Status/Branch/Queue/Reservations.
- **Why it matters:** No-reservation / penalized parents get an admin board instead of one next action.
- **Fix:** One frost pane, one status sentence, one mark-blue Reserve.
- **Suggested command:** `/impeccable distill`

### [P1] Live ticket is two glass panes, not one window
- **What:** Ticket + now-serving share a pane; Waiting Queue is a second `pq-glass`; push banner can be a third.
- **Why it matters:** The contract is one frost layer onto the live room.
- **Fix:** Wait keys as insets inside the ticket pane.
- **Suggested command:** `/impeccable layout`

### [P1] Register is a one-page cognitive wall
- **What:** Phone + OTP + email + passwords on one pane; disabled Register with no inline reason.
- **Why it matters:** First-run valley before the parent ever sees a ticket.
- **Fix:** Disclose using the existing onboarding stepper already on Verify Email / Add Child. Do not change OTP/register order.
- **Suggested command:** `/impeccable onboard`

### [P2] Reserve creates the slot, then asks who it’s for
- **What:** Patient-info modal after `createReservation`. Escape is Cancel Reservation.
- **Why it matters:** High-stakes trap. Handler order is a logic constraint and must not be reordered in this UI pass.
- **Fix:** Present the modal as “slot is held — finish or release” with the queue number visible.
- **Suggested command:** `/impeccable clarify`

## Persona Red Flags

**Casey (parent on a phone):** Long register scroll; empty home tiles; 10–11px ticket captions; “My Reservations” fights the 4-key bar; Cancel Reservation sits under Expand QR.

**Jordan (first-timer):** Ticket vs people-ahead vs now-serving unexplained; “Validation Open” / “Waiting for Window” on the untouched staff badge; Register does not say why it is disabled.

**Sam (accessibility):** 10–11px captions; logo `alt=""` when the header mark is the only identity; toast errors; disabled Register with no accessible reason. `:focus-visible` ring on `.pq-shell` is in place.

## Minor observations

- Desktop auth is a small card in a vast unused wash.
- Dashboard still computes unused `getStatusDisplay` / `clinicStatusDisplay` (logic-adjacent leftovers).
- QRTicket boarding-pass notches mix paper cutouts with laminated glass.
- `ParentQRCode.jsx` is unused and still leftover Tailwind; not routed.
- Shared staff modals intentionally unstyled — parent confirm/cancel/delete still look old.
- Copy constraint respected: operational strings intact; PlusQueue only in lockups.

## Provocative questions

- If the product is a waiting-room window, why is login a floating SaaS card with nothing behind the glass?
- If empty home is “Today’s Clinic Status,” who is that for — a parent with a sick child, or a secretary?
- Why does Register get the whole gauntlet on one pane when Verify Email already knows how to step?
