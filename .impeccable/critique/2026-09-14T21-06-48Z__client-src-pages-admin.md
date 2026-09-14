---
target: Admin pages (Manage Branch, Manage Users, System Activity)
total_score: 22
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
target_identity: "file:C:\\Users\\canil\\OneDrive\\Documents\\CAPSTONE-PROJECT\\pediatric-clinic-queue-system\\client\\src\\pages\\admin"
timestamp: 2026-09-14T21-06-48Z
slug: client-src-pages-admin
---
Method: dual-agent (A: 96777b78-45f4-417f-b0dd-37fd83cf0392 · B: edf4d728-883e-4851-b074-625aaad66603)

#### Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | Branch fetch failure can land as “No branches found”; Users treats any Firebase error as “Access Denied.” |
| 2 | Match System / Real World | 3 | Clinic floor language is strong; “Global Outcomes” and User ID still sound like SaaS analytics. |
| 3 | User Control and Freedom | 2 | Frost dialogs have X/Cancel but no Escape or scrim-dismiss; ConfirmationModal does. |
| 4 | Consistency and Standards | 2 | Sidebar says “User Management” / “Branch Management”; header says “Users” / “Branches.” Shared confirm dialogs remain gray-50. |
| 5 | Error Prevention | 2 | Delete was a filled danger control on every scan row (quieted in polish after this scoring). Doctor create still has no one-doctor warning until submit fails. |
| 6 | Recognition Rather Than Recall | 2 | Phone dock hides Branch Management; Profile tile has no subtitle. |
| 7 | Flexibility and Efficiency | 2 | Search and filters exist; Users pagination can mint a button per page. |
| 8 | Aesthetic and Minimalist Design | 3 | One frost pane + opaque scan rows works; Activity stacks Audit and Reports under primary tabs. |
| 9 | Error Recovery | 2 | Most failures are toasts. Branch save and reports errors name the problem without a retry path. |
| 10 | Help and Documentation | 2 | Add Staff role cards explain the floor; audit categories and the phone Branches detour are unexplained. |
| **Total** | | **22/40** | **Acceptable** |

#### Design Specificity Verdict

**Start here.** Authored for PlusQueue, not a generic admin kit. Wash, Lexend, teal ink, official mark, header-pill Add Staff / Add Branch, live-wash “Queue Active” with coral pip, and +63 phone fields belong to this clinic window. Chrome matches Secretary/Doctor.

**LLM assessment**: Clinic-window transplant succeeded. Profile’s nameless silhouette, Reports’ stock chart suite, and monospace User ID remain category-interchangeable.

**Deterministic scan**: `impeccable detect` returned `[]` (exit 0) across admin pages, admin components, and BranchConfiguration. Zero primary findings, zero advisories.

**Visual overlays**: No reliable user-visible overlay is available. This session has no browser MCP (no tab, inject, or evaluate APIs). Vite is running at localhost:5173 but `/admin` was not inspected in a live tab.

#### Overall Impression

Admin now sits in the same daylight frost as the rest of PlusQueue. The remaining gap is operate density: Delete used to scream, Activity is two products, and Profile is a logout dock rather than an identity card.

#### What's Working

1. Same clinic window as Secretary/Doctor — `pq-shell`, glass nav, header pill, dock, PlusQueue mark.
2. Reduced glass on Users and Audit — one frost pane, opaque `pq-table` / `pq-row` insets.
3. Floor language — Queue Active / Paused / Closed, secretary branch chips, role cards that describe the desk.

#### Priority Issues

- **[P1] Destructive Delete was the visual primary on scan surfaces.** Every user row and branch card treated Delete as a filled twin to inspect/edit. Confirmation exists, but the scan posture was “destroy.” (Polish after scoring: Delete demoted to ghost/alert text; confirm remains destructive.)
- **[P1] Inspect and compose paths are pointer-only.** Rows and branch cards open on click with no row keyboard access. Frost dialogs do not handle Escape.
- **[P1] Failure looks like emptiness or a locked door.** Branch load errors can read as “No branches found.” User list errors become “Access Denied,” including network failure.
- **[P2] System Activity is two operate products.** Audit log and Reports share one route and a pair of primary-styled tabs.
- **[P2] Profile identity is hollow.** Generic “Administrator Account” with no name/email, while Secretary’s profile is an identity card. Phone Branch Management tile has no subtitle.

#### Persona Red Flags

**Alex (clinic admin power user):** No bulk actions. Opening a user is click-row then modal then Edit. Pagination can become a strip of 44px page buttons. Two “more” models on the audit log (pages vs Load Older Logs).

**Sam (keyboard / screen reader):** Table rows and branch cards are not in the tab order. Frost modals lack Escape. Dock idle keys are icon-only until selected. Outcome donut encodes status mainly by color.

**Clinic administrator (PlusQueue back office):** Home shows one “current” clinic in a multi-branch product. Phone Branches lives behind Profile with no “clinic locations” subtitle.

#### Minor Observations

- Header title vs sidebar label mismatch (Users vs User Management).
- Phone header CTA collapses to “Add.”
- Filter bars are not sticky (`pq-filter-stick` exists unused).
- Confirmation / Message modals remain gray-50 by constraint.
- Unused `client/src/pages/admin/SystemSettings.jsx` is still a leftover; `/admin/settings` redirects to Profile.

#### Questions to Consider

- If the admin’s job is “which branch am I looking after,” why does home show one “current” clinic?
- Why was Delete the brightest object on a find-and-inspect table?
- Does immutable accountability need a BI suite on the same page?
- What would Profile be if it had to prove this is a named administrator of PlusQueue?
