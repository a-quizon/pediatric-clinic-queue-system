# Role Migration Checklist — Admin → Doctor

Code now dual-allows Doctor + leftover Admin for clinic-admin powers. Complete this checklist before deactivating any admin account.

## Pre-deploy

- [ ] Confirm git branch to deploy and which Firebase project is staging vs production
- [ ] Deploy hosting + functions + `database.rules.json` to **staging** first
- [ ] Record staging admin uid/email and active doctor uid/email (read-only Console)

## Staging verification (Doctor)

- [ ] Login as Doctor → lands on `/doctor`
- [ ] Clinic admin nav: Users, Branches, Audit Logs
- [ ] Create secretary; edit user; send password reset
- [ ] Deactivate / reactivate a test parent or secretary
- [ ] Last active doctor cannot be deactivated or deleted (expect error toast / API 400)
- [ ] Branch create/edit works
- [ ] Audit logs load and filter (including historical `actorRole: admin`)
- [ ] Reports → Clinic Overview tab loads
- [ ] `/admin/users` redirects to `/doctor/users`

## Staging verification (Secretary / Parent)

- [ ] Secretary cannot open `/doctor/users` (redirected away)
- [ ] Secretary cannot read `users` root or `auditLogs` (rules deny)
- [ ] Parent cannot call `POST /api/admin/delete-user` (403)
- [ ] Secretary settings and queue flows unchanged

## Staging data step

- [ ] After Doctor verified: set staging admin `users/{uid}.status` → `inactive` (do not delete Auth)
- [ ] Confirm Doctor still performs all clinic-admin actions
- [ ] Confirm inactive admin cannot log in

## Production (explicit owner approval required)

- [ ] Deploy same build to production
- [ ] Re-run Doctor checklist on production
- [ ] Deactivate production admin profile only after soak
- [ ] Keep dual-allow for one release; cleanup PR later removes admin acceptance

## Rollback

- [ ] Reactivate admin via [AdminBreakGlass.md](AdminBreakGlass.md) while dual-allow is live, **or** redeploy previous hosting/functions/rules
