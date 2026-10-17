# Admin Separation Checklist

The System Admin (`/admin`) and the Doctor (`/doctor`) are separate roles. The admin manages staff, branches, audit logs, and clinic-wide reports. The doctor runs the clinic (schedules, queue, consultations, reports) and has no admin powers. Phases 2 and 3 enforce the split at all three levels: UI, server (Cloud Functions + Express mirror), and RTDB rules. Use this checklist for every deploy that touches roles, rules, or the admin module.

## Status

Done:

- [x] Phase 1: separate `/admin` module (Dashboard, Users, Branches, Audit Logs, Reports with Clinic Overview + read-only Session History; System Health added in panel-admin-features); doctor nav has no Users/Branches/Audit Logs; admin has no Profile page.
- [x] Phase 2: admin-only guards in the server runtimes (`assertActiveAdmin`) and RTDB rules; admin is not clinical staff; admin creates/deactivates/reactivates/deletes secretaries and the doctor (one active doctor); staff password reset by temporary password; suspicious-account alerts moved to `adminAlerts` + admin Web Push.
- [x] Phase 3: admin accounts listed read-only in Users ("You" marker, no row actions); rules block any client from removing an admin profile or changing its `role`, `status`, or `isDeleted`; admin policy rename and audit text.
- [x] Phase 4: doctor tour has no admin steps and every step has a rendered target (test-enforced); docs updated; `npm test` passes.
- [x] Phase 5 (staging, 2026-10-16): staging redeployed (rules, functions, hosting); 92 server and rules checks passed (see "Staging verification evidence"); admin password rotation documented in [AdminBreakGlass.md](AdminBreakGlass.md).

Panel admin features (`feature/panel-admin-features`, staging):

- [x] System Health page + `systemHealth` / `rateLimits` rules (admin read health; server-only writes).
- [x] Manual reservation-code rate limit + server audit (`MANUAL_CODE_FAILED` / `MANUAL_CODE_LOCKED`) + Audit Logs action filter.
- [x] Admin empty states + analytics honesty (`docs/ImplementedAnalytics.md`).
- [x] `docs/BackupAndRestorePlan.md`, `docs/ProjectTurnover.md`.
- [ ] Items 3–4 (delete/archive policy; admin password recovery) waiting on owner decision.

Remaining:

- [ ] Manual UI walkthrough on staging (items marked "UI pending" below), including a real suspicious-account push to the admin, System Health, and manual-code lockout.
- [ ] Decide who the production admin is and build a production-safe create script (the current one is staging-only).
- [ ] Production deploy only with explicit owner approval (see "Production").

The original Phase 5 item "Admin Profile works" is obsolete: the admin has no Profile page by design, and `/admin/profile` redirects to `/admin`.

Rules live only in `client/database.rules.json` (mirrored in `client/database.demo.rules.json` with the `isDemo` guard flipped, test-enforced); `client/firebase.json` deploys both. There is no repo-root rules file.

## Pre-deploy

- [x] Confirm the git branch and that `firebase use` prints `pediatric-clinic-queue-testing` (staging). Never deploy to `pediatric-clinic-queue-system` (production) without explicit owner approval.
- [x] `cd client && npm test` passes (includes `adminRoleRules.test.js` and `demoDatabaseRules.test.js`). Phase 5: 272/272.
- [ ] Save the currently deployed rules (Console → Realtime Database → Rules, or a copy of the last deployed commit) for rollback. Phase 5 staging: not saved separately. The rules file has not changed since `a2fd6f4` (already on staging from Phase 3/4), so the Phase 5 rules redeploy did not change behavior. Rolling back the Phase 3 rules would use `git show a2fd6f4^:client/database.rules.json`. Required before production.
- [x] Record the staging admin uid/email and the active doctor uid/email. Staging: admin `admin@plus.queue` (`hqoFVUvI9ke3nb52U0kG5L1aKsB2`), doctor `doctor@plus.queue` (`YTYg8GpBPbPzVrQZmxtRxIBSG022`). Neither has custom claims.

## Deploy (staging)

Run from `client/`:

- [x] `npx firebase deploy --only database --project staging` (main + demo targets)
- [x] `npx firebase deploy --only functions --project staging`
- [x] `npm run build` (staging env) then `npx firebase deploy --only hosting --project staging` (site `plus-queue`)

## Staging verification evidence (2026-10-16)

Server and rules checks ran as the real staging admin, doctor, and secretary using Admin SDK custom tokens (no passwords), plus three temporary fixtures (an inactive admin, a secretary target, an inactive doctor) that were deleted afterwards. Denied writes changed nothing; allowed writes used a probe key or rewrote the existing value. All 92 checks passed:

- Rules: doctor/secretary denied `branchConfigurations` write, `auditLogs` read, `users` list read, other users' profile/`role`/`assignedBranch`/`mustChangePassword`, admin profile write/delete, and `adminAlerts` read. Admin allowed `branchConfigurations` write, `auditLogs` and `users` read, and read of `reservations`/`bookingLocks`/`parentBookingCaps`; admin denied `reservations` write, `systemConfiguration/{branchId}` write, and its own `status` change or profile delete. Doctor and secretary allowed to save `systemConfiguration/{branchId}` (including `sms`).
- Server (callables and the Express mirror `server/routes/admin.js`): doctor, secretary, and an inactive admin get 403 from `deleteUserAccount`, `updateUserAccount`, `resetSecretaryPassword`, `createDoctorAccount`, `setDoctorAccountStatus`. An active admin can update, reset, and delete a secretary; is refused when deleting, editing, deactivating, or resetting themselves or another admin; and gets 409 when creating a second doctor or reactivating a doctor while one is active. Admin is refused by `claimReservationSlot`, `/api/reservations/claim`, `/api/reservations/release`, and the staff `/api/send-notification`.

## Staging verification: Admin

- [ ] UI pending: login lands on `/admin`; Dashboard (Active Staff = active doctors + secretaries, 10 recent audit entries), Users, Branches, Audit Logs, Reports (Clinic Overview, date presets and range, Session History with the read-only row side panel) load.
- [ ] UI pending: create a secretary; edit a secretary; reset a secretary and a doctor password (temporary password, forced change on next login); Forgot Password refuses doctor/secretary emails; deactivate/reactivate a parent or secretary. Server side verified (update, reset, delete on a secretary).
- [ ] UI pending: create a doctor only when none is active; deactivate, reactivate, delete the doctor. Server side verified (409 while a doctor is active, for create and reactivate).
- [ ] UI pending: admin accounts appear in Users with the Admin badge and filter, the own row is marked "You", and admin rows have no Edit/Reset/Deactivate/Delete actions. Server and rules side verified (every admin-target and self action refused).
- [x] There is no admin Profile page: `/admin/profile` and any unknown `/admin/*` path redirect to `/admin` (`AppRoutes.jsx`). An admin opening `/doctor/*` or `/secretary/*` is redirected to `/admin` (`RoleRoute`).
- [ ] UI pending: create, rename, and delete a branch. Renaming a branch with schedules updates the schedules' `branch`/`branchId` and secretaries' `assignedBranch`.
- [x] Admin cannot claim, release, or write reservations (rules and server verified); the Session History drawer is read-only.
- [ ] UI pending: a suspicious-account flag produces an `adminAlerts/{adminUid}` entry, a toast/push for the admin, and the link opens `/admin/audit-logs?highlight={logId}`.

## Staging verification: Doctor

- [ ] UI pending: login lands on `/doctor`; Dashboard, Queue, Schedules, Reports (both tabs, date presets and range, Session History), Profile work end to end (start queue, consult, complete).
- [x] Branch queue/SMS settings save (`systemConfiguration/{branchId}`), rules verified for the doctor and the branch secretary. UI pending.
- [x] Direct calls to `deleteUserAccount`, `updateUserAccount`, `resetSecretaryPassword` (callable and `/api/admin/*`) return a permission error.
- [x] Rules deny: write `branchConfigurations`, read `auditLogs`, read the `users` list, write another user's profile/role/`assignedBranch`/`mustChangePassword`, write or delete an admin profile.
- [x] Doctor nav has no Users, Branches, or Audit Logs; a doctor opening `/admin/*` is redirected to `/doctor`; the doctor tour has no admin steps (`doctorTourSteps.test.js`).
- [x] No suspicious-account toast or push reaches the doctor: the doctor cannot read `adminAlerts`, the in-app fallback runs for admins only, and `sendPushToAdmin` refuses non-admin targets. Real push pending with the admin alert test.

## Staging verification: Secretary / Parent

- [ ] UI pending: Secretary validates QR, manages the queue, schedules, settings, and gets the notifications they should. Rules deny the `users` list and other users' profiles (verified).
- [ ] UI pending: Parent reserve, QR ticket, queue monitor, notifications unchanged.
- [x] A deactivated admin is rejected by every admin-only server action.

## Production (explicit owner approval required)

- [ ] Resolve blockers: production hosting target in `client/.firebaserc`, a production client build env, production functions env (`client/functions/.env.pediatric-clinic-queue-system`), and a production-safe admin create script.
- [ ] Read-only production data check (counts only): admins, active doctors (must be 1), staff with admin-style fields, missing `status`, old `auditLogs` entries with `actorRole: "doctor"`.
- [ ] Back up the production rules.
- [ ] Create the production admin (Admin SDK, password from an env variable; never `admin@plus.queue`).
- [ ] Deploy the same commit in this order, in one window outside clinic hours: functions, database rules, hosting.
- [ ] Re-run the Admin and Doctor sections on production.

## Rollback

- [ ] Rules (riskiest): restore the previous `client/database.rules.json` and `client/database.demo.rules.json` from the last deployed commit (`git show <commit>:client/database.rules.json`) and redeploy `--only database`, or restore from Console → Realtime Database → Rules history.
- [ ] Functions/hosting: redeploy the previous commit (hosting can also be rolled back in Console → Hosting → release history).
- [ ] Admin locked out: see [AdminBreakGlass.md](AdminBreakGlass.md) (Admin SDK only; the doctor has no admin powers to fall back on).
