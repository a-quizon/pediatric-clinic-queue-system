---
target: Admin operate surface (IA restructure)
total_score: 22
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 1
target_identity: "file:C:\\Users\\canil\\OneDrive\\Documents\\CAPSTONE-PROJECT\\pediatric-clinic-queue-system\\client\\src\\pages\\admin"
timestamp: 2026-09-14T21-28-23Z
slug: client-src-pages-admin
closed: true
---
Method: dual-agent (A: 7660e96f-71c6-48b9-b994-98bf81afca1e · B: 5e0c8320-0729-41ca-8f5d-19adc7649613)

#### Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Per-branch ops rows on Home; Activity is nested with a visible back control. Live feedback (spinners, toasts, confirms) is in place. |
| 2 | Match System / Real World | 3 | Queue Active / branch addresses / doctor-secretary language; Reports still says “System Analytics” and “Global Outcomes.” |
| 3 | User Control and Freedom | 3 | Modals cancel; filters clear; Activity has a back control on phone and desk. Deletes cannot be undone (warned). |
| 4 | Consistency and Standards | 2 | Frost/tokens are shared. Names split (Dashboard/Home, Users/User Management). Activity tabs look like primary/secondary buttons. |
| 5 | Error Prevention | 3 | Branch/user delete confirms; in-use branch blocked; self/admin delete blocked. |
| 6 | Recognition Rather Than Recall | 2 | Four labeled nav keys help. Activity and Reports must be remembered from Home. Preview log rows are not objects you can reopen. |
| 7 | Flexibility and Efficiency | 1 | Search/filter/pagination only. Users pagination still mints a button per page. |
| 8 | Aesthetic and Minimalist Design | 2 | Opaque rows and one-frost panes are clean. Home still stacks four jobs; Profile is empty rather than minimal; Reports is a third dashboard. |
| 9 | Error Recovery | 2 | Users/Branches offer Try again. Activity/Reports errors often name the failure and stop. |
| 10 | Help and Documentation | 1 | Empty-state one-liners only. Nested Activity and audit categories are unexplained. |
| **Total** | | **22/40** | **Acceptable** |

#### Design Specificity Verdict

**Start here.** Home is a PlusQueue clinic window. Users, Reports, and Profile are still a generic admin kit wearing frost.

**LLM assessment**: The IA restructure is the right Operate move (Home + Users + Branches + Profile, Activity nested). `PqBrand`, mark-blue Add Staff / Add Branch, per-branch operation rows, and opaque `pq-row` / `pq-stat` / `pq-table` insets belong to this clinic. System Overview census tiles, the Users table chrome, and Reports charts could ship on another product.

**Deterministic scan**: `impeccable detect --json --scope type,layout` on `client/src/pages/admin` and `client/src/components/admin` returned `[]` (exit 0). Zero findings.

Extra mechanical notes (not detector hits): desktop Users `<tr onClick>` with a nested name button; `AddStaffModal` / `UserDetailsModal` nest `pq-modal-scrim` blur with `pq-glass-modal` blur; password-toggle hit width under 44px; Recharts hex values match tokens but are not `var(--pq-*)`.

**Visual overlays**: No reliable user-visible overlay is available. This session has no browser automation tools. Vite is running at localhost:5173; `/admin` was not inspected in a live tab.

#### Overall Impression

The sitemap finally matches how an admin works: structure on primary keys, history on demand from Home. The remaining hole is Profile occupying a dock slot while showing almost nothing, and Activity still hosting a second analytics suite.

#### What's Working

1. Four-key spine (Home, Users, Branches, Profile) puts Branches on the phone dock and stops treating Activity as a fifth primary.
2. Home answers the one-glance story: overview stats, per-branch session rows, branch snapshot, 8-log feed with View all.
3. Add Staff / Add Branch stay solid mark-blue controls in the header pill; scan rows stay opaque inside one frost pane.

#### Priority Issues

### [P1] Profile occupies a primary nav slot and contains almost nothing
- **What:** Profile is “Administrator Account”, a generic User icon, and Logout. No name, email, or clinic role.
- **Why it matters:** Activity was demoted so this key could sit in the four-item dock. A busy operator opens it expecting an account and hits a logout wall.
- **Fix:** Put identity on the page (name/email/role) and any real account actions, or do not spend a primary key on a logout sheet.
- **Suggested command:** `/impeccable onboard`

### [P2] Activity/Reports is still a second, generic dashboard
- **What:** The nested Activity page still hosts Audit Logs and a full Reports suite (adoption trend, global outcomes) that restates census Home already owns.
- **Why it matters:** Nesting hid the page; it did not make the page a clinic close-of-day.
- **Fix:** Distill reports to branch sessions, reservations, outcomes — with retry and copy that matches the audit empty state.
- **Suggested command:** `/impeccable distill`

### [P2] Home still offers too many first-viewport destinations
- **What:** Three stat links, Manage, Reports, View all, and up to four branch rows compete before a first task.
- **Why it matters:** First-time admins hesitate; Reports and View all used to share identical weight (View all is now secondary-button, Reports ghost).
- **Fix:** Keep one primary continuation from the feed; treat stats as status, not a link farm.
- **Suggested command:** `/impeccable distill`

### [P2] Activity tabs look like actions, not location
- **What:** Audit Logs / Reports use `pq-btn-primary` / `pq-btn-secondary` without a complete tab pattern (`aria-controls`, `tabpanel`, arrow keys).
- **Why it matters:** First-timers do not read them as two views of one place.
- **Fix:** Real tab chrome on the nested Activity page.
- **Suggested command:** `/impeccable layout`

### [P3] Three vocabularies for the same places
- **What:** Sidebar Dashboard / User Management / Branch Management vs dock Home / Users / Branches vs header Users / Branches.
- **Why it matters:** Extra recall for a four-key product.
- **Fix:** One label set across sidebar, dock, and header.
- **Suggested command:** `/impeccable clarify`

#### Persona Red Flags

**Jordan — first-time clinic admin:** Looks for “System Activity” in the sidebar; it is gone (reachable from Home). Opens Profile to set up an account and finds only Logout.

**Casey — busy operator on a phone:** Four-key dock is in the thumb zone. Add Staff / Add Branch sit in the top header. Branch Delete sits beside Edit as a full-width ghost on small screens.

**Sam — keyboard / screen-reader:** User table rows still activate on `<tr onClick>` besides the inner name button. Activity tabs are not a complete tab pattern.

#### Minor Observations

- Header Add Branch still shows on branches error/empty states, duplicating the in-pane Add Branch.
- Add Branch is wired through `window` `openAddBranchModal`.
- DESIGN.md still says staff/admin must not inherit parent frost; this surface correctly extends it.
- “Load Older Logs” vs pagination will confuse novices.

#### Questions to Consider

- If Home is the clinic window, should the first row be today’s queues by branch instead of a census of parents/staff/branches?
- If Profile earned a dock key, what account is it the window onto?
- What would View all open if each Home log row were a real object?
