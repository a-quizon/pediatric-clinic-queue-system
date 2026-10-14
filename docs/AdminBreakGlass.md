# Clinic Admin Break-Glass Recovery

Use when the **Doctor** cannot sign in (forgotten password and Forgot Password failed, Auth disabled), when the **Doctor must be deactivated or replaced**, or for any **System Admin** credential change.

- **Doctor creation**: the System Admin can create the Doctor in the app (**Admin → Users → Add Staff → Doctor**) only while **no active doctor** exists. The server enforces this too (callable `createDoctorAccount` and `POST /api/admin/create-doctor`, with a lock at `systemLocks/doctorProvisioning`). Deactivating or replacing a doctor is still break-glass only.
- **Admin credentials**: admins have no in-app Profile page and cannot change their own name, phone, email, or password in the app. Forgot Password is refused for admin emails. Use the Admin SDK steps below (create script, **Reset password (Auth)**).

**Never run against production until the project owner explicitly approves the target Firebase project.**

## Projects

| Alias | Firebase project id |
|-------|---------------------|
| Staging | `pediatric-clinic-queue-testing` |
| Production | `pediatric-clinic-queue-system` |

Confirm with `firebase use` / Console before any Admin SDK write.

## Preferred recovery (no script)

1. Doctor uses **Forgot Password** on the login screen (same 5/day Asia/Manila cap). Not available for admin accounts.
2. A System Admin can use **Admin → Users → Reset Password** for the doctor's email.

## Break-glass (Firebase Admin SDK)

Prerequisites: service account for the **correct** project; Node with `firebase-admin`.

### Create or replace a Doctor account

Prefer the in-app Admin flow when no active doctor exists. Use the Admin SDK (or Firebase Console Auth + RTDB) when no admin can sign in, or to **replace** a doctor (deactivate the outgoing one first). Keep **one active doctor** system-wide.

```js
// staging first — set PROJECT explicitly; never invent a second active doctor
const admin = require("firebase-admin");
admin.initializeApp({
  credential: admin.credential.cert(require("./serviceAccountKey.json")),
  databaseURL: "https://<PROJECT_ID>-default-rtdb.firebaseio.com",
});

// Optional: deactivate the outgoing doctor before creating a replacement
// await admin.database().ref("users/<OLD_DOCTOR_UID>").update({
//   status: "inactive",
//   deactivationSource: "admin",
//   updatedAt: Date.now(),
// });

const userRecord = await admin.auth().createUser({
  email: "<doctor@email>",
  password: "<temporary-strong-password>",
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
  createdAt: now,
  updatedAt: now,
});
```

After login, the doctor should change the temporary password.

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

### Reactivate an inactive doctor profile (RTDB)

```js
// staging first — set PROJECT and DOCTOR_UID explicitly
const admin = require("firebase-admin");
admin.initializeApp({
  credential: admin.credential.cert(require("./serviceAccountKey.json")),
  databaseURL: "https://<PROJECT_ID>-default-rtdb.firebaseio.com",
});

const uid = "<DOCTOR_UID>";
await admin.database().ref(`users/${uid}`).update({
  status: "active",
  deactivationSource: null,
  updatedAt: Date.now(),
});
```

### Reset password (Auth)

This is the **only** way to reset a System Admin password.

```js
const link = await admin.auth().generatePasswordResetLink("<doctor-or-admin@email>");
console.log(link); // send out-of-band to the account owner
// or:
await admin.auth().updateUser(uid, { password: "<temporary-strong-password>" });
```

### Reactivate a leftover admin account (rollback only)

While dual-allow code is still deployed:

```js
await admin.database().ref(`users/<ADMIN_UID>`).update({
  status: "active",
  deactivationSource: null,
  updatedAt: Date.now(),
});
```

Then sign in and restore doctor access. Do **not** leave two active doctor accounts.

## Rules

- Always try **staging** first and verify login.
- Do not delete Auth users as part of routine recovery (prefer deactivate + create replacement only when necessary).
- Record uid/email and timestamp in your deployment notes.
