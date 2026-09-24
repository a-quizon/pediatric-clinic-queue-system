# Clinic Admin Break-Glass Recovery

Use when the **Doctor** cannot sign in (forgotten password and Forgot Password failed, Auth disabled) or when a **Doctor account must be created or replaced**. In-app User Management cannot create, deactivate, or delete Doctor accounts.

**Never run against production until the project owner explicitly approves the target Firebase project.**

## Projects

| Alias | Firebase project id |
|-------|---------------------|
| Staging | `pediatric-clinic-queue-testing` |
| Production | `pediatric-clinic-queue-system` |

Confirm with `firebase use` / Console before any Admin SDK write.

## Preferred recovery (no script)

1. Doctor uses **Forgot Password** on the login screen (same 5/day Asia/Manila cap).
2. If a second machine still has a doctor session, use **Users → Reset Password** for that email.

## Break-glass (Firebase Admin SDK)

Prerequisites: service account for the **correct** project; Node with `firebase-admin`.

### Create or replace a Doctor account

The app never mints Doctor roles. Use Admin SDK (or Firebase Console Auth + RTDB) for the **first** doctor and for **replacement**. Keep **one active doctor** system-wide.

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

```js
const link = await admin.auth().generatePasswordResetLink("<doctor@email>");
console.log(link); // send out-of-band to the doctor
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
