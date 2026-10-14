# Admin Separation Checklist

The System Admin (`/admin`) and the Doctor (`/doctor`) are separate roles. The admin manages staff, branches, audit logs, and clinic-wide reports. The doctor runs the clinic (schedules, queue, consultations, reports) and has no admin powers. Phase 2 enforces the split at all three levels: UI, server (Cloud Functions + Express mirror), and RTDB rules. Use this checklist for every deploy that touches roles, rules, or the admin module.

Rules live only in `client/database.rules.json` (mirrored in `client/database.demo.rules.json`); `client/firebase.json` deploys both. There is no repo-root rules file.

## Pre-deploy

- [ ] Confirm the git branch and that `firebase use` prints `pediatric-clinic-queue-testing` (staging). Never deploy to `pediatric-clinic-queue-system` (production) without explicit owner approval.
- [ ] `cd client && npm test` passes (includes `adminRoleRules.test.js` and `demoDatabaseRules.test.js`).
- [ ] Save the currently deployed staging rules (Console → Realtime Database → Rules, or a copy of the last deployed commit) for rollback.
- [ ] Record the staging admin uid/email and the active doctor uid/email (read-only Console).

## Deploy (staging)

- [ ] `npx firebase deploy --only database --project staging` (main + demo targets)
- [ ] `npx firebase deploy --only functions --project staging`
- [ ] `npm run build` (staging env) then `npx firebase deploy --only hosting --project staging`

## Staging verification: Admin

- [ ] Login lands on `/admin`; Dashboard, Users, Branches, Audit Logs, Reports (Clinic Overview + Session History) load.
- [ ] Create a secretary; edit a secretary; reset a secretary password; deactivate/reactivate a parent or secretary.
- [ ] Create a doctor only when none is active; deactivate, reactivate, delete the doctor.
- [ ] Create, rename, and delete a branch. Renaming a branch with schedules succeeds and updates the schedules' `branch`/`branchId` and secretaries' `assignedBranch`.
- [ ] No reservation actions are offered anywhere in the admin UI (Session History drawer is read-only).
- [ ] A suspicious-account flag produces an `adminAlerts/{adminUid}` entry, a toast/push for the admin, and the link opens `/admin/audit-logs?highlight={logId}`.

## Staging verification: Doctor

- [ ] Login lands on `/doctor`; Dashboard, Queue, Schedules, Reports, Profile work end to end (start queue, consult, complete).
- [ ] Branch queue/SMS settings save (`systemConfiguration/{branchId}`).
- [ ] Direct calls to `deleteUserAccount`, `updateUserAccount`, `resetSecretaryPassword` (callable or `/api/admin/*`) return a permission error.
- [ ] Rules deny: write `branchConfigurations`, read `auditLogs`, read the `users` list, write another user's profile/role/`assignedBranch`/`mustChangePassword`, write or delete an admin profile.
- [ ] No suspicious-account toast or push reaches the doctor.

## Staging verification: Secretary / Parent

- [ ] Secretary: validate QR, manage queue, schedules, settings unchanged. Rules deny the `users` list and other users' profiles.
- [ ] Parent: reserve, QR ticket, queue monitor, notifications unchanged.
- [ ] A deactivated admin is rejected by every admin-only server action.

## Production (explicit owner approval required)

- [ ] Deploy the same commit to production.
- [ ] Re-run the Admin and Doctor sections on production.

## Rollback

- [ ] Rules (riskiest): restore the previous `client/database.rules.json` and `client/database.demo.rules.json` from the last deployed commit (`git show <commit>:client/database.rules.json`) and redeploy `--only database`, or restore from Console → Realtime Database → Rules history.
- [ ] Functions/hosting: redeploy the previous commit.
- [ ] Admin locked out: see [AdminBreakGlass.md](AdminBreakGlass.md) (Admin SDK only; the doctor has no admin powers to fall back on).
