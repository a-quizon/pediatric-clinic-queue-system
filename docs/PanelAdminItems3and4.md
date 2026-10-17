# Panel items 3 and 4 — waiting on owner decision

No code changes for delete/archive policy or admin password recovery until you choose. Findings below.

## Item 3 — Archive / deactivate vs permanent delete

### What admin can permanently delete today

| Target | Behavior |
|--------|----------|
| Secretary / Doctor / Parent | Hard delete: Auth user + `users/{uid}` + `notifications/{uid}` removed |
| Admin | Blocked (UI, server, rules) |
| Branch | Hard delete of `branchConfigurations/{id}` only — **no branch archive exists** (task text assumed archives; code does not) |

### What survives user delete

- Reservations (active ones are forfeited first)
- Audit logs (including a new `USER_DELETED` entry)
- Schedules’ `doctorId` string; `doctorAlerts/{uid}` for doctors

### Parent self-delete (manuscript)

Parents soft-delete: Auth revoked; `users/{uid}` kept with `isDeleted: true`; reservations kept for clinic analytics. Admin hard-delete is stricter (profile removed).

### Options (pick one)

1. **Deactivate by default**; hard Delete only if the account has no clinical history (no reservations; doctor has no schedules referencing them).
2. **Replace Delete with Archive** for staff (disable Auth, keep `users/{uid}` tombstone like parent soft-delete).
3. **Keep hard Delete**; clarify UI/docs only.
4. Also add true **branch archive** (hide from lists, keep config).

---

## Item 4 — Admin account recovery / forgot password

| Role | Forgot Password | How they reset |
|------|-----------------|----------------|
| Parent | Allowed (5/day claim) | Firebase reset email → `/reset-password` |
| Doctor / Secretary | Refused (`auth_denied`) | Admin temporary password |
| Admin | Refused | Admin SDK only (`docs/AdminBreakGlass.md`) |

Admin has no Profile page and cannot change password in-app. No plain bug found in parent/staff flows; config risks remain (`VITE_APP_URL`, native origin fallback).

### Options (pick one)

| Option | Pros | Cons |
|--------|------|------|
| **A.** Allow Firebase reset email for admins | Familiar UX | Weakens Admin-SDK-only posture |
| **B.** Keep Admin SDK only; improve break-glass docs | Matches Phase 5 security | No self-service |
| **C.** In-app admin change-password (reauth) | No email dependency | Still need break-glass if locked out |
