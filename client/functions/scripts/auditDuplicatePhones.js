/**
 * Read-only audit: list mobile numbers that collide across formats.
 * Does NOT delete or merge accounts.
 *
 * Usage (from client/functions):
 *   node scripts/auditDuplicatePhones.js
 */
const fs = require("fs");
const path = require("path");
const admin = require("firebase-admin");
const { normalizePhoneE164 } = require("../smsService");

function loadServiceAccount() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  }
  const candidates = [
    process.env.GOOGLE_APPLICATION_CREDENTIALS,
    path.join(__dirname, "..", "serviceAccountKey.json"),
    path.join(__dirname, "..", "..", "..", "server", "serviceAccountKey.json"),
  ].filter(Boolean);
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return JSON.parse(fs.readFileSync(candidate, "utf8"));
    }
  }
  return null;
}

function phoneFields(user) {
  return [user.phone, user.phoneNumber, user.contactNumber]
    .map((v) => String(v || "").trim())
    .filter(Boolean);
}

async function main() {
  const sa = loadServiceAccount();
  if (!sa) {
    console.error(
      "No service account found. Set FIREBASE_SERVICE_ACCOUNT or place serviceAccountKey.json."
    );
    process.exit(2);
  }

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(sa),
      databaseURL:
        process.env.FIREBASE_DATABASE_URL ||
        `https://${sa.project_id}-default-rtdb.asia-southeast1.firebasedatabase.app`,
    });
  }

  const snap = await admin.database().ref("users").once("value");
  const byNormalized = new Map();

  snap.forEach((child) => {
    const uid = child.key;
    const user = child.val() || {};
    if (user.isDeleted === true) return;

    const seen = new Set();
    for (const raw of phoneFields(user)) {
      const normalized = normalizePhoneE164(raw);
      if (!normalized || seen.has(normalized)) continue;
      seen.add(normalized);
      if (!byNormalized.has(normalized)) byNormalized.set(normalized, []);
      byNormalized.get(normalized).push({
        uid,
        email: user.email || "",
        role: user.role || "",
        status: user.status || "",
        raw,
        fieldHint: raw === user.phone ? "phone" : raw === user.phoneNumber ? "phoneNumber" : "contactNumber",
      });
    }
  });

  const collisions = [...byNormalized.entries()]
    .map(([phone, accounts]) => {
      const uniqueUids = [...new Map(accounts.map((a) => [a.uid, a])).values()];
      return { phone, accounts: uniqueUids };
    })
    .filter((row) => row.accounts.length > 1)
    .sort((a, b) => a.phone.localeCompare(b.phone));

  if (!collisions.length) {
    console.log("No duplicate mobile numbers found (after E.164 normalization).");
    return;
  }

  console.log(`Found ${collisions.length} duplicate mobile number group(s):\n`);
  for (const group of collisions) {
    console.log(group.phone);
    for (const a of group.accounts) {
      console.log(
        `  - uid=${a.uid} role=${a.role} status=${a.status} email=${a.email} raw=${a.raw} (${a.fieldHint})`
      );
    }
    console.log("");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
