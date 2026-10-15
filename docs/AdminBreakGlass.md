# Clinic Admin Break-Glass Recovery

Use when the **Doctor** cannot sign in (forgotten password, Auth disabled) and no admin can fix it in the app, when **no System Admin can sign in**, or for any **System Admin** credential change.

- **Doctor lifecycle is in-app**: the System Admin creates, deactivates, reactivates, and permanently deletes the Doctor from **Admin → Users**. Create and reactivate are allowed only while **no other active doctor** exists (server-enforced with a lock at `systemLocks/doctorProvisioning`). Deactivate and delete are refused while a patient is in consultation on a running session. To replace a doctor: deactivate (or delete) the current one, then add or reactivate the new one. The Admin SDK steps below are only for when no admin can sign in.
- **Doctor status is server-only**: RTDB rules refuse client writes to a doctor's `status`. The Admin SDK bypasses rules, so the snippets below still work.
- **Admin records are owner-only in the rules**: no other account (doctor, secretary, or another admin) can write or delete a `role: "admin"` profile from the client. The owner also cannot remove their own profile or change its `role`, `status`, or `isDeleted` (the only allowed status write is filling in a missing status as `active`). Use the Admin SDK for any admin profile change.
- **Admin credentials**: admins have no in-app Profile page and cannot change their own name, phone, email, or password in the app. Forgot Password is refused for admin emails, and **Admin → Users → Reset Password** refuses admin targets (including yourself). The only way to change an admin password is **Rotate a System Admin password** below (Admin SDK). The create script does not change the password of an account that already exists.

**Never run against production until the project owner explicitly approves the target Firebase project.**

## Projects

| Alias | Firebase project id |
|-------|---------------------|
| Staging | `pediatric-clinic-queue-testing` |
| Production | `pediatric-clinic-queue-system` |

Confirm with `firebase use` / Console before any Admin SDK write, and check that `serviceAccountKey.json` has the matching `project_id`. Both databases live in `asia-southeast1`, so the `databaseURL` is `https://<PROJECT_ID>-default-rtdb.asia-southeast1.firebasedatabase.app`.

Never put a password in source, docs, tests, logs, or shell history. Read it into an environment variable and remove it afterwards:

```powershell
$env:NEW_PASSWORD = Read-Host "Password"
# ... run the snippet ...
Remove-Item Env:NEW_PASSWORD
```

## Preferred recovery (no script)

1. A System Admin opens **Admin → Users → (doctor) → Reset Password**. This issues a one-time temporary password (no email), revokes the doctor's sessions, and sets `mustChangePassword`, so the doctor must pick a new password at `/doctor/change-password` on next login. Secretaries are reset the same way.
2. **Forgot Password** (reset email) is for parents only; the claim endpoint refuses doctor, secretary, and admin emails.

## Break-glass (Firebase Admin SDK)

Prerequisites: service account for the **correct** project; Node with `firebase-admin`.

### Create or replace a Doctor account

Prefer the in-app Admin flow. Use the Admin SDK (or Firebase Console Auth + RTDB) only when no admin can sign in. Deactivate the outgoing doctor first and keep **one active doctor** system-wide.

```js
// staging first — set PROJECT explicitly; never invent a second active doctor
const admin = require("firebase-admin");
admin.initializeApp({
  credential: admin.credential.cert(require("./serviceAccountKey.json")),
  databaseURL: "https://<PROJECT_ID>-default-rtdb.asia-southeast1.firebasedatabase.app",
});

// Optional: deactivate the outgoing doctor before creating a replacement
// await admin.database().ref("users/<OLD_DOCTOR_UID>").update({
//   status: "inactive",
//   deactivationSource: "admin",
//   updatedAt: Date.now(),
// });

const userRecord = await admin.auth().createUser({
  email: "<doctor@email>",
  password: process.env.NEW_PASSWORD, // temporary, 12+ characters
  displayName: "<Doctor Name>",
  emailVerified: true,
});

const now = Date.now();
await admin.database().ref(`users/${userRecord.uid}`).set({
  uid: userRecord.uid,
  name: "<Doctor Name>",
  email: "<doctor@email>",
  phone: "",
  role: "doctor",
  status: "active",
  hasCompletedTour: false,
  mustChangePassword: true,
  createdAt: now,
  updatedAt: now,
});
```

`mustChangePassword: true` sends the doctor to `/doctor/change-password` on first login.

### Create a System Admin account (staging script)

Admin accounts (Users, Branches, Audit Logs) are never created in the app. Keep 1–2 active admins. The script refuses to run unless the service account belongs to `pediatric-clinic-queue-testing`, refuses a third active admin, and never changes an existing non-admin account's role. It writes `role: "admin"` with no `assignedBranch`.

Never put the password in source, docs, or tests. Pass it through `ADMIN_PASSWORD`:

```powershell
# from the repo root, with server/serviceAccountKey.json for staging
$env:ADMIN_PASSWORD = Read-Host "Admin password"
npm --prefix server run create-admin -- --email <admin@email> --name "System Admin"
Remove-Item Env:ADMIN_PASSWORD
```

The script prints the uid, the active admin count, and the active doctor count (expected: exactly 1). Record the uid in your deployment notes.

If the email already has an Auth user, the script keeps its current password and only ensures the profile (`role: "admin"`, `status: "active"`, no branch). To change the password, use **Rotate a System Admin password**.

The script is staging-only. Production needs a production-safe variant (explicit project, typed confirmation, same env-variable password and two-admin limit), which requires owner approval. Never reuse the staging admin email or password in production.

### Remove an orphan admin profile

An admin profile with no matching Auth user (for example, the Auth user was deleted and the email was reused by the create script) still shows in **Admin → Users** and still counts as an active admin for alerts. The create script ignores it and logs "Ignoring orphan admin profile". The rules block clients from removing admin profiles, so use the Admin SDK: confirm `admin.auth().getUser(uid)` returns `auth/user-not-found`, then remove `users/<uid>` (and `adminAlerts/<uid>` if present).

### Reactivate an inactive doctor profile (RTDB)

Prefer **Admin → Users → (doctor) → Activate Account**. Use this only when no admin can sign in, and only if no other doctor is active.

```js
// staging first — set PROJECT and DOCTOR_UID explicitly
const admin = require("firebase-admin");
admin.initializeApp({
  credential: admin.credential.cert(require("./serviceAccountKey.json")),
  databaseURL: "https://<PROJECT_ID>-default-rtdb.asia-southeast1.firebasedatabase.app",
});

const uid = "<DOCTOR_UID>";
await admin.database().ref(`users/${uid}`).update({
  status: "active",
  deactivationSource: null,
  updatedAt: Date.now(),
});
```

### Rotate a System Admin password

This is the **only** way to change a System Admin password (scheduled rotation, a forgotten password, or a suspected leak). Run it from `server/` with `serviceAccountKey.json` for the target project and `NEW_PASSWORD` set as shown at the top of this page.

```js
// set PROJECT and ADMIN_EMAIL explicitly; never print the password
const admin = require("firebase-admin");
admin.initializeApp({ credential: admin.credential.cert(require("./serviceAccountKey.json")) });

const password = process.env.NEW_PASSWORD;
if (!password || password.length < 12) throw new Error("Set NEW_PASSWORD (12+ characters)");

const { uid } = await admin.auth().getUserByEmail("<admin@email>");
await admin.auth().updateUser(uid, { password });
await admin.auth().revokeRefreshTokens(uid); // signs out every open admin session
console.log(`Password rotated for ${uid}`);
```

Give the new password to the admin out-of-band, then sign in once to confirm it works. Record the uid and time (not the password) in your deployment notes.

### Reset a Doctor or Secretary password (no admin can sign in)

Prefer **Admin → Users → Reset Password**. When no admin can sign in, use the same snippet with the staff email, then set `mustChangePassword` so the forced change runs on next login:

```js
await admin.database().ref(`users/${uid}`).update({ mustChangePassword: true, updatedAt: Date.now() });
```

### Reactivate an inactive System Admin

Admins are never deactivated in the app, but a profile can end up `inactive` (manual Console edit, old migration). An inactive admin is refused by every admin-only server action (user delete/update, staff password reset, doctor create/status) and by the admin-only RTDB writes, so it cannot recover itself. Keep 1–2 active admins; the create script refuses a third.

```js
await admin.database().ref(`users/<ADMIN_UID>`).update({
  status: "active",
  deactivationSource: null,
  updatedAt: Date.now(),
});
```

Doctors no longer hold any admin powers (Users, Branches, Audit Logs, staff password reset), so a missing admin cannot be worked around by signing in as the doctor. Use this snippet or the create script instead.

## Rules

- Always try **staging** first and verify login.
- Do not delete Auth users as part of routine recovery (prefer deactivate + create replacement only when necessary). Permanent doctor deletion belongs in the app (Admin → Users), which also writes the audit entry.
- Record uid/email and timestamp in your deployment notes.
