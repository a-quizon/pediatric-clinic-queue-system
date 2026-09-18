---
target: ManageQueue session card
total_score: 25
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
target_identity: "file:C:\\Users\\canil\\OneDrive\\Documents\\CAPSTONE-PROJECT\\pediatric-clinic-queue-system\\client\\src\\pages\\secretary\\ManageQueue.jsx"
target_fingerprint: "sha256:000d6ba76c52098f9c2477995d88be9e30af2ce5d64e84b3313286c2e92a91a8"
target_path: "C:\\Users\\canil\\OneDrive\\Documents\\CAPSTONE-PROJECT\\pediatric-clinic-queue-system\\client\\src\\pages\\secretary\\ManageQueue.jsx"
timestamp: 2026-09-18T03-05-47Z
slug: client-src-pages-secretary-managequeue-jsx
---
# Critique — ManageQueue session card (reference mobile + tablet/desktop equivalent)

Target: `client/src/pages/secretary/ManageQueue.jsx` session section + `QueueSessionControls` `layout="cluster"`.
Mode: Operate. Assessments A and B ran as isolated subagents. Browser visualization skipped (no browser tool).

## Design-specificity verdict

Authored PlusQueue frost: one `pq-glass` pane, live pip, wait-gold / coral / alert orbs, mark-blue pill Request Check-In, duration as opaque `pq-row` inset. Structure follows the mobile reference; colors stay PlusQueue, not the mock’s generic iOS blue/red kit. Doctor `layout="inline"` is unchanged.

## Heuristics (Operate, 25/40)

| # | Heuristic | Score |
|---|-----------|-------|
| 1 | Visibility of system status | 3 |
| 2 | Match system / real world | 3 |
| 3 | User control and freedom | 3 |
| 4 | Consistency and standards | 3 |
| 5 | Error prevention | 2 |
| 6 | Recognition rather than recall | 2 |
| 7 | Flexibility and efficiency | 2 |
| 8 | Aesthetic and minimalist design | 3 |
| 9 | Error recovery | 2 |
| 10 | Help and documentation | 2 |

## Cognitive load

Four simultaneous desk actions (Pause, Close, End, Request Check-In). Grouping matches the reference. Icon-only orbs rely on `aria-label` (reference match; Operate recognition remains a gap).

## Strengths

1. Token-true session language inside one frost pane; duration is an inset, not nested glass.
2. Mobile stack matches the reference: chip + orbs, duration meter, full-width Check-In, full-width count.
3. `@2xl` (~672px container) moves duration between chip and orbs and places Check-In beside Total Active.

## Priority issues remaining (intentionally not changed)

1. [P1] Pause/Lock/Stop remain icon-only to match the reference. Names exist via `aria-label`.
2. [P1] End Session stays clickable when dimmed — same behavior as before.
3. [P2] Paused and Queue Closed still share the wait chip.

## Mechanical fixes applied after detector review

- Defined `--pq-alert-deep` so stop-orb hover is not white-on-white.
- Removed 1Hz `aria-live` from the duration clock.
- Cluster row can wrap at ~320px.
- Orb icons marked `aria-hidden`.

## Detector (Assessment B)

`impeccable detect --json` → `[]`, exit 0.
