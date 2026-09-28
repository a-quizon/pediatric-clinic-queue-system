/**
 * Marks parent accounts that already received a Near Turn SMS so they never get another one.
 * Writes users/{parentId}/nearTurnSms = { sentAt, reservationId, backfilled: true }.
 *
 * Required env:
 *   FIREBASE_DATABASE_URL   (e.g. https://pediatric-clinic-queue-system-default-rtdb.asia-southeast1.firebasedatabase.app)
 *   GOOGLE_APPLICATION_CREDENTIALS or FIREBASE_SERVICE_ACCOUNT or server/serviceAccountKey.json
 *
 * Usage (from client/functions):
 *   node scripts/backfillNearTurnSms.js                              # dry run
 *   node scripts/backfillNearTurnSms.js --apply
 *   node scripts/backfillNearTurnSms.js --apply --include-reservation-flags
 */
const fs = require("fs");
const path = require("path");
const admin = require("firebase-admin");
const { planNearTurnSmsBackfill, applyNearTurnSmsBackfill } = require("../nearTurnSmsBackfill");

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

async function main() {
  const args = new Set(process.argv.slice(2));
  const apply = args.has("--apply");
  const includeReservationFlags = args.has("--include-reservation-flags");

  const databaseURL = process.env.FIREBASE_DATABASE_URL;
  if (!databaseURL) throw new Error("FIREBASE_DATABASE_URL is required.");
  const serviceAccount = loadServiceAccount();
  admin.initializeApp({
    credential: serviceAccount ? admin.credential.cert(serviceAccount) : admin.credential.applicationDefault(),
    databaseURL,
  });
  const db = admin.database();

  const [usersSnap, notificationsSnap, reservationsSnap] = await Promise.all([
    db.ref("users").once("value"),
    db.ref("notifications").once("value"),
    includeReservationFlags ? db.ref("reservations").once("value") : Promise.resolve(null),
  ]);

  const plan = planNearTurnSmsBackfill(
    {
      users: usersSnap.val() || {},
      notifications: notificationsSnap.val() || {},
      reservations: reservationsSnap?.val() || {},
    },
    { includeReservationFlags }
  );

  plan.forEach((entry) => {
    console.log(`account #${entry.parentId} sentAt=${new Date(entry.sentAt).toISOString()} from ${entry.source}`);
  });
  console.log(`${plan.length} account(s) to mark.`);

  if (!apply) {
    console.log("Dry run only. Re-run with --apply to write.");
    return;
  }
  const written = await applyNearTurnSmsBackfill(db, plan);
  console.log(`Marked ${written} account(s).`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err.message || err);
    process.exit(1);
  });
