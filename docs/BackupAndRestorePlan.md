# Backup and Restore Plan

Owner-operated plan for Firebase data. There is **no in-app backup UI**. Never restore against production without explicit owner approval. Prefer practicing on **staging** (`pediatric-clinic-queue-testing`).

## What to back up

| Asset | Where it lives | Notes |
|-------|----------------|-------|
| Realtime Database (main) | `{project}-default-rtdb` (asia-southeast1) | Clinic data: users, reservations, schedules, auditLogs, systemHealth, etc. |
| Realtime Database (demo) | `{project}-demo` | Demo/sandbox instance only |
| Auth users | Firebase Authentication | Email/password accounts; not inside RTDB export |
| Database rules | `client/database.rules.json`, `client/database.demo.rules.json` | Also versioned in git |
| Cloud Functions source + config | `client/functions/` + deployed env (VAPID, TextBee, etc.) | Do not put secrets in this doc |
| Hosting | Firebase Hosting site(s) | Staging site `plus-queue`; production hosting target may be separate |
| Service accounts / API keys | Secure store (password manager) | Never commit; rotate after turnover |

## Not used by this app (no backup product work required)

| Product | Status |
|---------|--------|
| Cloud Firestore | **Not used.** No scheduled Firestore exports or point-in-time recovery to enable. |
| Firebase Storage | **Not used** for clinic files in app code. No Storage backup job required unless you later store uploads there. |

## Firebase plan capabilities (verify in Console)

On **Blaze** projects, Firebase can offer:

1. **Realtime Database automated backups** (Console → Realtime Database → Backups) — daily exports to a Cloud Storage bucket you own, when enabled for that database.
2. **Manual export** — Console download or CLI:
   ```bash
   # from client/ after firebase login
   npx firebase use staging
   npx firebase database:get / --output backup-staging.json --project staging
   ```
   Large trees may need path-scoped exports (`/users`, `/reservations`, …).
3. **Auth export** — `npx firebase auth:export auth-users.json --format=json --project staging` (Admin SDK / CLI).
4. **Rules / functions** — recover from git + `firebase deploy`; keep a dated zip of `.env` templates **without** secret values plus a private password-manager entry for real secrets.

Confirm in the Firebase Console whether automated RTDB backups are **enabled** for staging and production. Status at authoring time: **not verified from this repo** (requires Console access). Record the result in the owner checklist below.

## Frequency and who runs it

| Environment | RTDB | Auth | Rules/functions (git) | Who |
|-------------|------|------|------------------------|-----|
| Staging | Weekly manual export or Console automated backup | Monthly | Every merge to main | Capstone owner / designated admin |
| Production | Daily automated backup if Blaze+Backups enabled; otherwise weekly manual | Weekly | Every production deploy | Owner after turnover (see ProjectTurnover.md) |

Store exports in a private Cloud Storage bucket or encrypted drive. Name files `YYYY-MM-DD-{project}-{asset}.json`. Retention: keep at least **4 weekly** and **1 monthly** copy.

Suggested retention for clinic records (manuscript / turnover wording):

| Record type | Retention guidance |
|-------------|-------------------|
| Reservations / visit history | Keep indefinitely in RTDB (no physical deletes); backups follow the schedule above |
| Visit reminder notes | Stored on the reservation; same as reservations |
| Notifications | Parent notification center under `notifications/{uid}`; retained with account history |
| Audit logs | Retain indefinitely for compliance review |
| Deleted parent Auth | Login removed; past visits kept in RTDB |

## How to restore (staging practice)

### A. Restore a small RTDB path into a scratch node (safe)

1. Confirm project: `npx firebase use` → must show `pediatric-clinic-queue-testing`.
2. Export a small path, e.g. `systemHealth` or a test node:
   ```bash
   npx firebase database:get /systemHealth --output /tmp/systemHealth.json --project staging
   ```
3. Import into a **scratch** path (never overwrite live clinic roots blindly):
   ```bash
   npx firebase database:set /_restoreTests/systemHealth /tmp/systemHealth.json --project staging --force
   ```
4. Compare in Console: `/_restoreTests/systemHealth` vs `/systemHealth`.
5. Delete the scratch node when done:
   ```bash
   npx firebase database:remove /_restoreTests --project staging --force
   ```

### B. Full RTDB restore (destructive — staging only)

1. Take a fresh export of the whole DB (or rely on Console backup object).
2. Optionally wipe non-critical staging data only after a written checklist.
3. `database:set /` from the backup file with `--force` — **this overwrites the entire tree**.
4. Redeploy rules if needed: `npx firebase deploy --only database --project staging`.

### C. Auth restore

Use `firebase auth:import` with the exported JSON. Password hashes only work if exported with the correct hash parameters from the same project. Prefer resetting staff via Admin → Users / Admin SDK rather than full Auth import unless you know the hash config.

## Restore test result

| Date | Environment | Procedure | Result |
|------|-------------|-----------|--------|
| 2026-10-17 | Staging (`pediatric-clinic-queue-testing`) | Wrote sample JSON to `/_restoreTests/panelAdminFeatures`, read it back (`{"at":1,"restoreTest":true}`), removed `/_restoreTests` | **Pass** |

### Exact steps for the owner (if agent could not run the test)

1. `cd client`
2. `npx firebase login` (if needed)
3. `npx firebase use staging` — confirm `pediatric-clinic-queue-testing`
4. Run section A commands above
5. Update this table with the date and Pass/Fail

**Never** run section B against `pediatric-clinic-queue-system` (production) without written owner approval.

## Owner checklist (Console / ops — cannot be done from app code)

Complete and check off in your own notes; then update the “verified” lines below.

1. [ ] Confirm **Blaze** billing on staging (`pediatric-clinic-queue-testing`) and production (`pediatric-clinic-queue-system`).
2. [ ] Console → Realtime Database → **Backups**: enable daily backup for the **main** RTDB; note Cloud Storage bucket name.
3. [ ] If the demo RTDB is used in production/staging, enable backups for it too (or document that demo data is disposable).
4. [ ] Record here when enabled:
   - Staging automated RTDB backups: **not verified from repo** — owner date: ________ / bucket: ________
   - Production automated RTDB backups: **not verified from repo** — owner date: ________ / bucket: ________
5. [ ] Run Auth export on the cadence in the frequency table; store encrypted off-repo.
6. [ ] Confirm Firestore and Storage remain unused for clinic data (or add a backup job if that changes).
7. [ ] Secrets (VAPID, TextBee, service accounts) only in a password manager — never in git.
8. [ ] Re-run section A restore drill on staging at least once per semester; log Pass/Fail in the table above.

## Rollback of database rules

If a bad rules deploy lands on staging:

```bash
cd client
git checkout HEAD~1 -- database.rules.json database.demo.rules.json   # or a known good commit
npx firebase use staging
npx firebase deploy --only database --project staging
```
