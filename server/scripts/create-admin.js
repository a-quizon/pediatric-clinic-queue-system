#!/usr/bin/env node
/**
 * Provision a System Admin account with the Firebase Admin SDK (staging only).
 * See docs/AdminBreakGlass.md.
 *
 * Usage (PowerShell, from repo root):
 *   $env:ADMIN_PASSWORD = Read-Host "Admin password"
 *   npm --prefix server run create-admin -- --email admin@example.com --name "System Admin"
 *   Remove-Item Env:ADMIN_PASSWORD
 *
 * --password <value> is accepted but ADMIN_PASSWORD is preferred so the
 * password does not land in shell history.
 */
const STAGING_PROJECT_ID = "pediatric-clinic-queue-testing";
const MAX_ACTIVE_ADMINS = 2;

process.env.FIREBASE_PROJECT_ID = STAGING_PROJECT_ID;
process.env.FIREBASE_DATABASE_URL = `https://${STAGING_PROJECT_ID}-default-rtdb.asia-southeast1.firebasedatabase.app`;

const { admin, initFirebaseAdmin, loadServiceAccount } = require("../services/firebaseAdmin");

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (!key.startsWith("--")) continue;
    args[key.slice(2)] = argv[i + 1];
    i += 1;
  }
  return args;
}

function fail(message) {
  console.error(`[create-admin] ${message}`);
  process.exitCode = 1;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const email = (args.email || "").trim().toLowerCase();
  const name = (args.name || "System Admin").trim();
  const password = args.password || process.env.ADMIN_PASSWORD || "";

  if (!email) return fail("Missing --email");
  if (password.length < 6) return fail("Set ADMIN_PASSWORD (or --password) to at least 6 characters");

  const serviceAccount = loadServiceAccount();
  if (!serviceAccount) return fail("No service account key found (server/serviceAccountKey.json)");
  if (serviceAccount.project_id !== STAGING_PROJECT_ID) {
    return fail(`Service account is for "${serviceAccount.project_id}". This script only runs against ${STAGING_PROJECT_ID}.`);
  }

  initFirebaseAdmin();
  const db = admin.database();

  const usersSnap = await db.ref("users").once("value");
  const users = Object.entries(usersSnap.val() || {}).map(([uid, value]) => ({ uid, ...(value || {}) }));
  const hasAuthUser = async (uid) => {
    try {
      await admin.auth().getUser(uid);
      return true;
    } catch (err) {
      if (err.code === "auth/user-not-found") return false;
      throw err;
    }
  };
  const activeWithAuth = async (role) => {
    const candidates = users.filter((u) => u.role === role && u.status === "active" && u.isDeleted !== true);
    const live = [];
    for (const candidate of candidates) {
      if (await hasAuthUser(candidate.uid)) live.push(candidate);
      else console.warn(`[create-admin] Ignoring orphan ${role} profile ${candidate.uid} (no Auth user).`);
    }
    return live;
  };
  const activeAdmins = await activeWithAuth("admin");
  const activeDoctors = await activeWithAuth("doctor");

  let userRecord = null;
  try {
    userRecord = await admin.auth().getUserByEmail(email);
  } catch (err) {
    if (err.code !== "auth/user-not-found") throw err;
  }

  const alreadyAdmin = userRecord && activeAdmins.some((u) => u.uid === userRecord.uid);
  if (!alreadyAdmin && activeAdmins.length >= MAX_ACTIVE_ADMINS) {
    return fail(`There are already ${activeAdmins.length} active admins. Deactivate one before adding another.`);
  }

  if (userRecord) {
    const existing = users.find((u) => u.uid === userRecord.uid);
    if (existing && existing.role && existing.role !== "admin") {
      return fail(`${email} already exists with role "${existing.role}". Refusing to change its role.`);
    }
    console.log(`[create-admin] Auth user already exists: ${userRecord.uid}`);
  } else {
    userRecord = await admin.auth().createUser({
      email,
      password,
      displayName: name,
      emailVerified: true,
    });
    console.log(`[create-admin] Created Auth user: ${userRecord.uid}`);
  }

  const now = Date.now();
  const profileRef = db.ref(`users/${userRecord.uid}`);
  const profileSnap = await profileRef.once("value");
  const profile = profileSnap.val();

  if (profile) {
    await profileRef.update({
      role: "admin",
      status: "active",
      assignedBranch: null,
      assignedBranchId: null,
      deactivationSource: null,
      updatedAt: now,
    });
    console.log("[create-admin] Profile already existed; ensured role admin / active / no branch.");
  } else {
    await profileRef.set({
      uid: userRecord.uid,
      name,
      email,
      phone: "",
      role: "admin",
      status: "active",
      hasCompletedTour: true,
      createdAt: now,
      updatedAt: now,
    });
    console.log("[create-admin] Wrote users profile.");
  }

  const adminCount = activeAdmins.length + (alreadyAdmin ? 0 : 1);
  console.log("");
  console.log(`  project : ${STAGING_PROJECT_ID}`);
  console.log(`  uid     : ${userRecord.uid}`);
  console.log(`  email   : ${email}`);
  console.log(`  time    : ${new Date(now).toISOString()}`);
  console.log(`  active admins  : ${adminCount}`);
  console.log(`  active doctors : ${activeDoctors.length}${activeDoctors.length === 1 ? "" : "  <-- expected exactly 1"}`);
}

main()
  .catch((err) => fail(err.message || String(err)))
  .finally(() => {
    if (admin.apps.length) admin.app().delete().catch(() => {});
  });
