/**
 * Seed helper: simulate the Oct 5–9 bulk no-show pattern for suspicious-account testing.
 *
 * From repo root (uses client/functions firebase-admin):
 *   node scripts/seed-suspicious-noshow.js <parentUid>
 *   node scripts/seed-suspicious-noshow.js <parentUid> --dry-run
 *
 * Requires GOOGLE_APPLICATION_CREDENTIALS or FIREBASE_SERVICE_ACCOUNT, and optional RTDB_URL.
 */
const path = require("path");

let admin;
try {
  admin = require("firebase-admin");
} catch (_err) {
  admin = require(path.join(__dirname, "../client/functions/node_modules/firebase-admin"));
}

const parentId = process.argv[2];
const dryRun = process.argv.includes("--dry-run");

if (!parentId) {
  console.error("Usage: node scripts/seed-suspicious-noshow.js <parentUid> [--dry-run]");
  process.exit(1);
}

function manilaDateString(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function addManilaDays(dateStr, days) {
  const [y, m, d] = String(dateStr).split("-").map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d, 4, 0, 0));
  utc.setUTCDate(utc.getUTCDate() + Number(days || 0));
  return manilaDateString(utc);
}

const today = manilaDateString();
const dates = [1, 2, 3, 4, 5].map((n) => addManilaDays(today, -n)).reverse();

const payload = dates.map((clinicDate, index) => ({
  parentId,
  clinicDate,
  status: "reserved",
  checkedIn: false,
  source: "parent",
  queueNumber: index + 1,
  reservationCode: `SD${index + 1}${String(Date.now()).slice(-3)}`.slice(0, 6).toUpperCase(),
  createdAt: Date.now() - (dates.length - index) * 86400000,
  concern: "Seeded no-show test",
  children: [{ name: "Seed Child", age: 5, sex: "M" }],
  note: "seed-suspicious-noshow",
}));

console.log("Will create reservations for parent", parentId);
console.log("Clinic dates (past Manila):", dates.join(", "));

if (dryRun) {
  console.log(JSON.stringify(payload, null, 2));
  process.exit(0);
}

const databaseURL =
  process.env.RTDB_URL ||
  "https://pediatric-clinic-queue-testing-default-rtdb.asia-southeast1.firebasedatabase.app";

if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
    databaseURL,
  });
} else {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    databaseURL,
  });
}

async function main() {
  const userSnap = await admin.database().ref(`users/${parentId}`).once("value");
  if (!userSnap.exists() || userSnap.val().role !== "parent") {
    throw new Error(`users/${parentId} must exist and have role parent`);
  }

  const updates = {};
  payload.forEach((row) => {
    const key = admin.database().ref("reservations").push().key;
    updates[`reservations/${key}`] = row;
  });
  await admin.database().ref().update(updates);
  console.log(`Created ${payload.length} no-show reservations.`);
  console.log("Next: deploy functions (evaluateSuspiciousAccounts) or wait for 20:00 Manila.");
  console.log("Expect Rules A and C to fire (consecutive / multi-date zero attendance).");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
