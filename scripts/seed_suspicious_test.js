/**
 * seed_suspicious_test — idempotent fixtures for Suspicious Account Detection QA.
 *
 * SAFETY:
 *   - Refuses production RTDB hosts unless you override (blocked by default).
 *   - Requires ALLOW_SUSPICIOUS_SEED=1
 *   - Only writes under keys prefixed with seed_suspicious_test_
 *
 * Usage:
 *   ALLOW_SUSPICIOUS_SEED=1 node scripts/seed_suspicious_test.js --dry-run
 *   ALLOW_SUSPICIOUS_SEED=1 node scripts/seed_suspicious_test.js
 *   ALLOW_SUSPICIOUS_SEED=1 node scripts/seed_suspicious_test.js --cleanup
 *
 * Env:
 *   RTDB_URL (must contain "testing" or "127.0.0.1" / "localhost")
 *   FIREBASE_SERVICE_ACCOUNT or GOOGLE_APPLICATION_CREDENTIALS
 */
const path = require("path");

let admin;
try {
  admin = require("firebase-admin");
} catch (_err) {
  admin = require(path.join(__dirname, "../client/functions/node_modules/firebase-admin"));
}

const PREFIX = "seed_suspicious_test";
const TODAY = "2026-10-10";

const IDS = {
  parentA: `${PREFIX}_parent_a`,
  parentB: `${PREFIX}_parent_b`,
  parentC: `${PREFIX}_parent_c`,
  parentD: `${PREFIX}_parent_d`,
  parentEBelowA: `${PREFIX}_parent_e_below_a`,
  parentEAtA: `${PREFIX}_parent_e_at_a`,
  parentEBelowB: `${PREFIX}_parent_e_below_b`,
  parentEAtB: `${PREFIX}_parent_e_at_b`,
  parentEBelowC: `${PREFIX}_parent_e_below_c`,
  parentEAtC: `${PREFIX}_parent_e_at_c`,
  parentF: `${PREFIX}_parent_f`,
  doctor: `${PREFIX}_doctor`,
  secretary: `${PREFIX}_secretary`,
};

const dryRun = process.argv.includes("--dry-run");
const cleanup = process.argv.includes("--cleanup");

function assertSafeEnvironment(databaseURL) {
  if (process.env.ALLOW_SUSPICIOUS_SEED !== "1") {
    throw new Error("Refusing to run: set ALLOW_SUSPICIOUS_SEED=1 to confirm this is intentional.");
  }
  const url = String(databaseURL || "");
  const looksProd =
    url.includes("pediatric-clinic-queue-system-default-rtdb") &&
    !url.includes("testing");
  const looksSafe =
    url.includes("testing") ||
    url.includes("127.0.0.1") ||
    url.includes("localhost") ||
    url.includes("emulator");
  if (looksProd || !looksSafe) {
    throw new Error(
      `Refusing to seed non-testing RTDB (${url || "missing RTDB_URL"}). Use staging/emulator only.`
    );
  }
}

function userProfile(uid, { role, name, extra = {} }) {
  return {
    uid,
    role,
    name,
    email: `${uid}@example.test`,
    status: "active",
    createdAt: Date.parse("2026-09-01T00:00:00+08:00"),
    updatedAt: Date.now(),
    note: PREFIX,
    ...extra,
  };
}

function reservation(id, parentId, clinicDate, fields = {}) {
  return {
    parentId,
    clinicDate,
    status: "reserved",
    checkedIn: false,
    source: "parent",
    queueNumber: 1,
    reservationCode: id.replace(/[^A-Z0-9]/gi, "").slice(-6).toUpperCase() || "SEED01",
    createdAt: Date.parse(`${clinicDate}T08:00:00+08:00`),
    concern: PREFIX,
    children: [{ name: "Test Child", age: 4, sex: "F" }],
    note: PREFIX,
    ...fields,
  };
}

function buildUpdates() {
  const updates = {};

  updates[`users/${IDS.parentA}`] = userProfile(IDS.parentA, {
    role: "parent",
    name: "Parent A NoShow",
  });
  updates[`users/${IDS.parentB}`] = userProfile(IDS.parentB, {
    role: "parent",
    name: "Parent B Attended",
  });
  updates[`users/${IDS.parentC}`] = userProfile(IDS.parentC, {
    role: "parent",
    name: "Parent C Upcoming",
  });
  updates[`users/${IDS.parentD}`] = userProfile(IDS.parentD, {
    role: "parent",
    name: "Parent D Cancelled",
  });
  updates[`users/${IDS.parentEBelowA}`] = userProfile(IDS.parentEBelowA, {
    role: "parent",
    name: "Parent E Below A",
  });
  updates[`users/${IDS.parentEAtA}`] = userProfile(IDS.parentEAtA, {
    role: "parent",
    name: "Parent E At A",
  });
  updates[`users/${IDS.parentEBelowB}`] = userProfile(IDS.parentEBelowB, {
    role: "parent",
    name: "Parent E Below B",
  });
  updates[`users/${IDS.parentEAtB}`] = userProfile(IDS.parentEAtB, {
    role: "parent",
    name: "Parent E At B",
  });
  updates[`users/${IDS.parentEBelowC}`] = userProfile(IDS.parentEBelowC, {
    role: "parent",
    name: "Parent E Below C",
  });
  updates[`users/${IDS.parentEAtC}`] = userProfile(IDS.parentEAtC, {
    role: "parent",
    name: "Parent E At C",
  });
  updates[`users/${IDS.parentF}`] = userProfile(IDS.parentF, {
    role: "parent",
    name: "Parent F Already Flagged",
    extra: {
      suspiciousFlag: {
        isSuspicious: true,
        status: "open",
        rulesTriggered: ["consecutive_no_shows"],
        evidence: [],
        flaggedAt: Date.parse("2026-10-09T20:00:00+08:00"),
        reviewedAt: null,
        reviewedBy: null,
      },
    },
  });

  updates[`users/${IDS.doctor}`] = userProfile(IDS.doctor, {
    role: "doctor",
    name: "Doctor Seed",
    extra: {
      notificationPermission: "granted",
      devicePushEnabled: true,
      pushSubscriptions: {
        seed_suspicious_test_sub: {
          endpoint: "https://push.example.test/seed_suspicious_test_doctor",
          expirationTime: null,
          keys: {
            p256dh: "TEST_P256DH_PUBLIC_KEY_NOT_SECRET",
            auth: "TEST_AUTH_SECRET_NOT_REAL",
          },
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      },
    },
  });

  updates[`users/${IDS.secretary}`] = userProfile(IDS.secretary, {
    role: "secretary",
    name: "Secretary Seed",
    extra: { assignedBranch: "Angeles" },
  });

  const octWeek = ["2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08", "2026-10-09"];
  octWeek.forEach((d, i) => {
    updates[`reservations/${IDS.parentA}_res_${i + 1}`] = reservation(
      `${IDS.parentA}_res_${i + 1}`,
      IDS.parentA,
      d,
      { status: i === 1 ? "forfeited" : "reserved", checkedIn: false }
    );
    updates[`reservations/${IDS.parentB}_res_${i + 1}`] = reservation(
      `${IDS.parentB}_res_${i + 1}`,
      IDS.parentB,
      d,
      { status: "consultation_completed", checkedIn: true }
    );
    updates[`reservations/${IDS.parentF}_res_${i + 1}`] = reservation(
      `${IDS.parentF}_res_${i + 1}`,
      IDS.parentF,
      d,
      { status: "reserved", checkedIn: false }
    );
  });

  updates[`reservations/${IDS.parentC}_res_1`] = reservation(
    `${IDS.parentC}_res_1`,
    IDS.parentC,
    TODAY,
    { status: "reserved", checkedIn: false }
  );
  updates[`reservations/${IDS.parentC}_res_2`] = reservation(
    `${IDS.parentC}_res_2`,
    IDS.parentC,
    "2026-10-11",
    { status: "reserved", checkedIn: false }
  );

  ["2026-10-05", "2026-10-06", "2026-10-07"].forEach((d, i) => {
    updates[`reservations/${IDS.parentD}_res_${i + 1}`] = reservation(
      `${IDS.parentD}_res_${i + 1}`,
      IDS.parentD,
      d,
      { status: "cancelled", checkedIn: false }
    );
  });

  ["2026-10-07", "2026-10-08"].forEach((d, i) => {
    updates[`reservations/${IDS.parentEBelowA}_res_${i + 1}`] = reservation(
      `${IDS.parentEBelowA}_res_${i + 1}`,
      IDS.parentEBelowA,
      d
    );
    updates[`reservations/${IDS.parentEBelowC}_res_${i + 1}`] = reservation(
      `${IDS.parentEBelowC}_res_${i + 1}`,
      IDS.parentEBelowC,
      d
    );
  });
  ["2026-10-07", "2026-10-08", "2026-10-09"].forEach((d, i) => {
    updates[`reservations/${IDS.parentEAtA}_res_${i + 1}`] = reservation(
      `${IDS.parentEAtA}_res_${i + 1}`,
      IDS.parentEAtA,
      d
    );
    updates[`reservations/${IDS.parentEAtC}_res_${i + 1}`] = reservation(
      `${IDS.parentEAtC}_res_${i + 1}`,
      IDS.parentEAtC,
      d
    );
  });

  const bBelow = [
    ["2026-10-01", "consultation_completed", true],
    ["2026-10-02", "consultation_completed", true],
    ["2026-10-03", "reserved", false],
    ["2026-10-04", "reserved", false],
  ];
  bBelow.forEach(([d, status, checkedIn], i) => {
    updates[`reservations/${IDS.parentEBelowB}_res_${i + 1}`] = reservation(
      `${IDS.parentEBelowB}_res_${i + 1}`,
      IDS.parentEBelowB,
      d,
      { status, checkedIn }
    );
  });
  const bAt = [
    ["2026-10-01", "consultation_completed", true],
    ["2026-10-02", "reserved", false],
    ["2026-10-03", "reserved", false],
    ["2026-10-04", "reserved", false],
  ];
  bAt.forEach(([d, status, checkedIn], i) => {
    updates[`reservations/${IDS.parentEAtB}_res_${i + 1}`] = reservation(
      `${IDS.parentEAtB}_res_${i + 1}`,
      IDS.parentEAtB,
      d,
      { status, checkedIn }
    );
  });

  return updates;
}

async function cleanupSeedData(db) {
  const updates = {};
  Object.values(IDS).forEach((uid) => {
    updates[`users/${uid}`] = null;
  });
  const resSnap = await db.ref("reservations").once("value");
  if (resSnap.exists()) {
    resSnap.forEach((child) => {
      const val = child.val() || {};
      if (val.note === PREFIX || String(child.key).startsWith(PREFIX)) {
        updates[`reservations/${child.key}`] = null;
      }
    });
  }
  const alertSnap = await db.ref(`doctorAlerts/${IDS.doctor}`).once("value");
  if (alertSnap.exists()) {
    updates[`doctorAlerts/${IDS.doctor}`] = null;
  }
  await db.ref().update(updates);
  return Object.keys(updates).length;
}

async function main() {
  const databaseURL =
    process.env.RTDB_URL ||
    "https://pediatric-clinic-queue-testing-default-rtdb.asia-southeast1.firebasedatabase.app";

  assertSafeEnvironment(databaseURL);

  const updates = buildUpdates();
  console.log(`seed_suspicious_test: ${Object.keys(updates).length} paths (today=${TODAY})`);
  console.log("Parent IDs:", IDS);

  if (dryRun) {
    console.log("--dry-run: no writes performed");
    console.log(JSON.stringify({ sampleParentA: updates[`users/${IDS.parentA}`], sampleRes: updates[`reservations/${IDS.parentA}_res_1`] }, null, 2));
    return;
  }

  if (!admin.apps.length) {
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
  }

  const db = admin.database();

  if (cleanup) {
    const n = await cleanupSeedData(db);
    console.log(`Cleanup removed/nullled ${n} paths under ${PREFIX}_*`);
    return;
  }

  await db.ref().update(updates);
  console.log("Seed applied (idempotent overwrite of known keys).");
  console.log("Next: deploy/run evaluateSuspiciousAccounts with todayManila override, or:");
  console.log("  In Functions shell: evaluateAndFlagParent('seed_suspicious_test_parent_a', { todayManila: '2026-10-10' })");
  console.log("Expect Parent A flagged; B/C/D not; E at-threshold flagged; F no duplicate while open.");
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
