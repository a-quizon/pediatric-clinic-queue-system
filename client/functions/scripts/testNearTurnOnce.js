/**
 * Live Near Turn SMS check: sends real SMS through textbee, but uses an in-memory
 * database so production RTDB is never touched. Each phone becomes one parent
 * account that gets hit with repeat, concurrent, multi-reservation, and
 * post-penalty Near Turn triggers. Pass = exactly one SMS per phone.
 *
 * Requires TEXTBEE_API_KEY in client/functions/.env.
 *
 * Usage (from client/functions):
 *   node scripts/testNearTurnOnce.js 09171234567 09181234567 ...
 *
 * Avoid process.exit() after fetch on Windows (Node libuv assertion).
 */
const fs = require("fs");
const path = require("path");

function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (match && process.env[match[1]] === undefined) {
      process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
    }
  }
}
loadEnv(path.join(__dirname, "..", ".env"));

const { runWithDatabase } = require("../rtdbRouter");
const { deliverSmsForNotification } = require("../smsNotificationService");

function createMemoryDb(initial = {}) {
  const root = structuredClone(initial);
  const parts = (p) => String(p || "").split("/").filter(Boolean);
  const get = (p) => parts(p).reduce((n, k) => (n == null || typeof n !== "object" ? undefined : n[k]), root);
  const set = (p, value) => {
    const keys = parts(p);
    let node = root;
    for (let i = 0; i < keys.length - 1; i += 1) {
      if (node[keys[i]] == null || typeof node[keys[i]] !== "object") node[keys[i]] = {};
      node = node[keys[i]];
    }
    if (value == null) delete node[keys[keys.length - 1]];
    else node[keys[keys.length - 1]] = structuredClone(value);
  };
  const snapshot = (value) => ({
    exists: () => value != null,
    val: () => (value == null ? null : structuredClone(value)),
  });
  const ref = (p = "") => ({
    child: (c) => ref(`${p}/${c}`),
    once: async () => snapshot(get(p)),
    set: async (value) => set(p, value),
    remove: async () => set(p, null),
    update: async (updates) => {
      for (const [k, v] of Object.entries(updates || {})) set(`${p}/${k}`, v);
    },
    transaction: async (updater) => {
      await Promise.resolve();
      const current = get(p);
      const next = updater(current == null ? null : structuredClone(current));
      if (next === undefined) return { committed: false, snapshot: snapshot(current) };
      set(p, next);
      return { committed: true, snapshot: snapshot(get(p)) };
    },
  });
  return { ref, read: (p) => structuredClone(get(p)) };
}

async function main() {
  const phones = process.argv.slice(2);
  if (!phones.length) {
    console.error("Usage: node scripts/testNearTurnOnce.js <phone> [phone...]");
    process.exitCode = 1;
    return;
  }
  if (!process.env.TEXTBEE_API_KEY) {
    console.error("TEXTBEE_API_KEY is missing in client/functions/.env");
    process.exitCode = 1;
    return;
  }

  const users = {};
  phones.forEach((phone, i) => {
    users[`test-parent-${i + 1}`] = { role: "parent", status: "active", phone };
  });
  const db = createMemoryDb({ users });

  const providerCalls = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    if (String(url).includes("textbee")) providerCalls.push(JSON.parse(init.body).recipients);
    return realFetch(url, init);
  };

  const trigger = (parentId, reservationId, clinicDate, branchId) =>
    runWithDatabase(db, () =>
      deliverSmsForNotification(
        "NEARING_TURN",
        { parentId, reservationId, clinicDate, branchId, queueNumber: 4, nearingTurnAheadCount: 3 },
        `nearing_turn_${reservationId}`
      )
    );

  const summary = [];
  for (const parentId of Object.keys(users)) {
    const results = [];
    // First trigger + two concurrent repeats on the same reservation.
    results.push(
      ...(await Promise.all([
        trigger(parentId, `${parentId}-r1`, "2026-10-01", "angeles"),
        trigger(parentId, `${parentId}-r1`, "2026-10-01", "angeles"),
        trigger(parentId, `${parentId}-r1`, "2026-10-01", "angeles"),
      ]))
    );
    // Second child / new reservation on another date and branch.
    results.push(await trigger(parentId, `${parentId}-r2`, "2026-10-15", "mabalacat"));
    // Penalized, re-queued, turn near again.
    await db.ref(`reservations/${parentId}-r2/penaltyCount`).set(1);
    results.push(await trigger(parentId, `${parentId}-r2`, "2026-10-15", "mabalacat"));

    const sent = results.filter((r) => r?.success && !r.skipped).length;
    const skipped = results.filter((r) => r?.skipped).map((r) => r.reason);
    const failed = results.filter((r) => r && !r.success && !r.skipped);
    summary.push({
      account: parentId,
      phone: users[parentId].phone,
      triggers: results.length,
      smsSent: sent,
      skipped: skipped.join(", "),
      failed: failed.map((r) => `${r.reason} ${r.status || ""}`.trim()).join(", "),
      flagSentAt: db.read(`users/${parentId}/nearTurnSms/sentAt`) || null,
    });
  }

  globalThis.fetch = realFetch;
  console.table(summary);
  console.log(`Provider calls: ${providerCalls.length} (expected ${phones.length})`);
  const ok = providerCalls.length === phones.length && summary.every((row) => row.smsSent === 1);
  console.log(ok ? "PASS: exactly one Near Turn SMS per account." : "FAIL: see table above.");
  process.exitCode = ok ? 0 : 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
