---
target: client/src/pages/parent
total_score: 23
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
target_identity: "file:C:\\Users\\canil\\OneDrive\\Documents\\CAPSTONE-PROJECT\\pediatric-clinic-queue-system\\client\\src\\pages\\parent"
timestamp: 2026-09-13T19-27-57Z
slug: client-src-pages-parent
---
# PlusQueue parent nav + glass cards critique — `client/src/pages/parent`

**Mode:** Operate  
**Target:** parent chrome after floating glass dock + thinner frost panes  
**Live inspection:** CLI detect clean (`[]`). No browser MCP overlay. Headless Edge on `/` captured auth spinner over the daylight wash only — parent dock not reachable without login.

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | Dock `aria-current` + header title + unread badge work; some dashboard status helpers are still unused |
| 2 | Match System / Real World | 3 | Queue / ahead / now-serving speak clinic; CalendarPlus vs Ticket does not map to waiting-room language |
| 3 | User Control and Freedom | 3 | Nested back + filters + logout exist; unlabeled idle dock needs a header title to confirm a mis-tap |
| 4 | Consistency and Standards | 2 | Square sticky header vs floating capsule footer; history filters still look like primary buttons |
| 5 | Error Prevention | 2 | 44px declared; four keys share a tight pill; “Reservations” is the longest active label |
| 6 | Recognition Rather Than Recall | 2 | Idle keys are icon-only by design (reference); header title is the fallback |
| 7 | Flexibility and Efficiency | 2 | Four-key IA is the right expert path; no accelerators; notifications stay in the top-right bell |
| 8 | Aesthetic and Minimalist Design | 3 | Ticket window is one pane with insets; filter bar dropped a second blur |
| 9 | Error Recovery | 2 | History empty copy is specific; chrome has no recovery path of its own |
| 10 | Help and Documentation | 2 | Profile rows explain themselves; idle dock icons have no visible hint |
| **Total** | | **23/40** | **Acceptable** |

## Design Specificity Verdict

**Start here.** Material and color are PlusQueue. Dock structure is a borrowed expanding-pill skeleton, recolored to mark-blue on daylight frost — not the reference’s neon purple or charcoal bar.

**LLM assessment:** The waiting-room window still lives in the ticket pane (split number, now-serving pip, wait keys). The dock could be reused on another product; the ticket could not. Thinning glass so the aqua/peach/gold wash shows through is the right instinct for this world.

**Deterministic scan:** `impeccable detect --json` on ParentLayout, parent pages, and `index.css` exited 0 with `[]`. Zero findings. A `layout-transition` warning on `max-width` was found mid-build and removed (labels now snap with `display`).

**Visual overlays:** No user-visible overlay. Browser visualization skipped: no browser automation exposed.

## Overall Impression

The footer is now furniture on the wash: a floating frost capsule with one mark-blue active pill. Cards are actually translucent instead of milky plates. The biggest remaining tension is recognition — the reference asked for unlabeled idle icons, which parents will have to learn.

## What's Working

1. **Token discipline vs the reference.** Active capsule is solid mark-blue, idle ink, white type — not purple, not charcoal.
2. **Ticket pane still one frost.** Clinic band, split number/ahead, now-serving, wait keys stay insets.
3. **History filter lost its second backdrop-filter.** `.pq-filter-bar` is an opaque mix so cards below are not a stacked blur.

## Cognitive load

**4 of 8 checklist items fail** (single focus, chunking, minimal choices, working memory). High load, mostly from icon-only idle keys and five equal history filters.

## Priority Issues

### [P1] Idle dock is icon-only
- **What:** Only the active key shows a label. CalendarPlus vs Ticket can be confused.
- **Why it matters:** A parent hunting the live number may tap Reservations instead of Home.
- **Fix:** Keep the expand (requested), or add a 2–3 letter idle cue if recognition fails in use.
- **Suggested command:** `/impeccable clarify`

### [P1] Active label “Reservations” is the longest pill
- **What:** 13 letters at 0.72rem/800, nowrap, flex 1.9.
- **Why it matters:** Small phones can squeeze idle icons.
- **Fix:** Shorter visual label if it overflows in device testing.
- **Suggested command:** `/impeccable adapt`

### [P1] Idle icon contrast on thin glass
- **What:** Dock is 58% white frost over a peach/gold wash. Idle color was raised to `--pq-ink` after the first critique pass.
- **Why it matters:** Thumb-zone icons must stay ≥4.5:1 on whatever is actually scrolling behind.
- **Fix:** Device-check on Profile and Home; darken idle further only if a real wash color fails.
- **Suggested command:** `/impeccable polish`

### [P2] Two chrome models
- **What:** Sticky square header vs floating capsule footer.
- **Why it matters:** DESIGN.md still describes an attached 64px frost bar.
- **Fix:** Document the hybrid or float a matching header capsule.
- **Suggested command:** `/impeccable document`

### [P2] History filters are five primary buttons
- **What:** Selected filter uses `.pq-btn-primary`.
- **Why it matters:** Same object language as “Make Reservation.”
- **Fix:** Quiet chips; one selected pill. Keep the no-blur bar.
- **Suggested command:** `/impeccable quieter`

## Persona Red Flags

**Casey (distracted mobile parent):** Thumb zone is right. Mis-tap cost is unlabeled neighbors. Bell is top-right. Live ticket is Home, not the Ticket key.

**Jordan (first-timer):** Must learn four glyphs. Reserve vs Reservations is a literal trap.

**Sam (a11y):** Dock has `aria-label` + `aria-current`. History cards remain clickable `<div>`s (pre-existing). Focus ring exists globally.

## Minor Observations

- Dock label toggle is snap (`display`), not a width animation — better for mobile jank, less like the reference’s expand motion.
- Unused `ParentQRCode.jsx` still has opaque white cards and is not on a route.
- Push-enable card can still sit as a second frost pane above the ticket (sibling, not nested).
