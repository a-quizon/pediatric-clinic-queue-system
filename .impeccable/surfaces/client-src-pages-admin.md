---
version: 1
slug: "client-src-pages-admin"
primary_target: "client/src/pages/admin"
related_targets: ["client/src/components/admin"]
---

# Admin operate — surface brief

Mode: Operate. Audience: the clinic administrator on desk, tablet, or phone. Task: manage branches, staff/parent accounts, and the immutable activity trail without leaving PlusQueue's clinic-window language.

## Direction contract

THESIS: PlusQueue admin is a clinic window onto the business structure — one frost dashboard that already shows live ops, branches, and the latest audit row, with Users, Branches, and Audit Logs as dedicated workspaces. Log Out lives in chrome (sidebar foot on desk, hamburger menu on phone), not an empty account page. Refuses nested SaaS cards, gray-50 chrome, Shield/"Admin Portal" branding, and a second design system beside Parent/Secretary/Doctor.

OWN-WORLD: Same daylight aqua-to-peach wash, Lexend, teal ink #16344A, mark-blue / coral / gold / live / wait / alert. One frost pane per region (`pq-glass`, 18px blur). User rows, audit rows, and branch details sit on opaque insets (`pq-row` / `pq-stat` / `pq-table`), never a second `backdrop-filter`. PlusQueue mark as the window badge.

STORY: An admin opens Dashboard and can say, in one glance, whether a clinic is running, which branches exist, and what just happened — then take one next action (add staff, add branch, inspect a user, open the full log).

FIRST VIEWPORT: Desk and tablet: wash canvas, glass sidebar (Dashboard, Users, Branches, Audit Logs) with Log Out at the foot, no hamburger. Phone: header hamburger only (hidden from `md` / 768px up); the menu holds Dashboard, Users, Branches, Audit Logs, and Log Out. No bottom dock. Dashboard: overview stats as status (not links), operation + branch snapshot side-by-side with one Manage continuation, recent audit-log feed with one View all into the Audit Logs section. Users: one frost pane, opaque table/list. Branches: one frost pane, opaque rows. Audit Logs is a primary section (`/admin/audit-logs`); Audit Logs / Reports remain `pq-tab` location chrome (Reports stays a tab until a later split). `/admin/activity` redirects to `/admin/audit-logs`.

FORM: Established Parent world `daylight-waiting-room-frost` extended to Admin Operate. No new identity. Signature interaction: Add Staff / Add Branch as solid mark-blue controls in the header pill. Raises: one frost layer (Parent); opaque scan rows (admin scanability constraint for users table and audit logs).

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.

## Constraints

- Frontend presentation only. No service, Firebase, adminService, audit, or branch-delete logic changes.
- Keep existing routes (`/admin/users`, `/admin/branches`) so no feature is lost. Audit Logs is a primary nav item at `/admin/audit-logs`; `/admin/activity` redirects there (preserving search). `/admin/profile` and `/admin/settings` redirect to Dashboard. Log Out remains reachable from the sidebar (tablet/desk) and the phone hamburger menu.
- Shared ConfirmationModal / MessageModal stay untouched.
- WCAG 2.2 AA, 44px targets, `:focus-visible`.
- Users table, Activity logs, and branch rows: reduced glass (insets / opaque table, not per-row blur) for scanability.
