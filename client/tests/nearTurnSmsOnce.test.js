import assert from "node:assert/strict";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const functionsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../functions");
const requireFromFunctions = createRequire(path.join(functionsDir, "package.json"));
const { runWithDatabase } = requireFromFunctions("./rtdbRouter.js");
const { deliverSmsForNotification } = requireFromFunctions("./smsNotificationService.js");
const {
  NEAR_TURN_SMS_PENDING_TTL_MS,
  claimAccountNearTurnSms,
} = requireFromFunctions("./nearTurnSmsGuard.js");
const { planNearTurnSmsBackfill, applyNearTurnSmsBackfill } = requireFromFunctions("./nearTurnSmsBackfill.js");

function createMemoryDb(initial = {}) {
  const root = structuredClone(initial);
  const parts = (nodePath) => String(nodePath || "").split("/").filter(Boolean);
  const get = (nodePath) =>
    parts(nodePath).reduce((node, key) => (node == null || typeof node !== "object" ? undefined : node[key]), root);
  const set = (nodePath, value) => {
    const keys = parts(nodePath);
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
  const ref = (nodePath = "") => ({
    child: (childPath) => ref(`${nodePath}/${childPath}`),
    once: async () => snapshot(get(nodePath)),
    set: async (value) => set(nodePath, value),
    remove: async () => set(nodePath, null),
    update: async (updates) => {
      for (const [key, value] of Object.entries(updates || {})) set(`${nodePath}/${key}`, value);
    },
    transaction: async (updater) => {
      await Promise.resolve();
      const current = get(nodePath);
      const next = updater(current == null ? null : structuredClone(current));
      if (next === undefined) return { committed: false, snapshot: snapshot(current) };
      set(nodePath, next);
      return { committed: true, snapshot: snapshot(get(nodePath)) };
    },
  });
  return { ref, read: (nodePath) => structuredClone(get(nodePath)) };
}

function seed() {
  return {
    users: {
      p1: { role: "parent", status: "active", phone: "09171234567", children: { c1: {}, c2: {} } },
      p2: { role: "parent", status: "active", phone: "09179876543" },
    },
    reservations: {
      r1: { parentId: "p1", childId: "c1", scheduleId: "s1", queueNumber: 4, status: "reserved" },
      r2: { parentId: "p1", childId: "c2", scheduleId: "s2", queueNumber: 2, status: "reserved" },
    },
  };
}

let fetchCalls;
let fetchMode;
let originalFetch;
let originalKey;

beforeEach(() => {
  fetchCalls = [];
  fetchMode = "ok";
  originalFetch = globalThis.fetch;
  originalKey = process.env.TEXTBEE_API_KEY;
  process.env.TEXTBEE_API_KEY = "test-key";
  globalThis.fetch = async (url, init) => {
    fetchCalls.push(JSON.parse(init.body));
    if (fetchMode === "slow") await new Promise((resolve) => setTimeout(resolve, 20));
    if (fetchMode === "fail") return { ok: false, status: 500, json: async () => ({ error: "boom" }) };
    if (fetchMode === "throw") throw new Error("socket hang up");
    return { ok: true, status: 200, json: async () => ({ success: true }) };
  };
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalKey === undefined) delete process.env.TEXTBEE_API_KEY;
  else process.env.TEXTBEE_API_KEY = originalKey;
});

function nearTurn(db, { parentId = "p1", reservationId = "r1", branchId = "angeles", clinicDate = "2026-10-01" } = {}) {
  return runWithDatabase(db, () =>
    deliverSmsForNotification(
      "NEARING_TURN",
      { parentId, reservationId, branchId, clinicDate, queueNumber: 4, nearingTurnAheadCount: 3 },
      `nearing_turn_${reservationId}`
    )
  );
}

function penalized(db, { parentId = "p1", reservationId = "r1", penaltyCount = 1 } = {}) {
  return runWithDatabase(db, () =>
    deliverSmsForNotification(
      "PENALIZED",
      { parentId, reservationId, queueNumber: 4, queuePosition: 7, penaltyCount },
      `penalized_${reservationId}_${penaltyCount}`
    )
  );
}

describe("Near Turn SMS once per parent account", () => {
  it("sends the first Near Turn SMS and marks the account", async () => {
    const db = createMemoryDb(seed());
    const result = await nearTurn(db);

    assert.equal(result.success, true);
    assert.equal(fetchCalls.length, 1);
    assert.deepEqual(fetchCalls[0].recipients, ["+639171234567"]);
    const state = db.read("users/p1/nearTurnSms");
    assert.ok(state.sentAt > 0);
    assert.equal(state.reservationId, "r1");
    assert.equal(state.pendingToken, undefined);
    assert.ok(db.read("notifications/p1/nearing_turn_r1/smsDispatchedAt") > 0);
  });

  it("does not resend when the trigger runs again for the same reservation", async () => {
    const db = createMemoryDb(seed());
    await nearTurn(db);
    const again = await nearTurn(db);
    const third = await nearTurn(db);

    assert.equal(fetchCalls.length, 1);
    assert.equal(again.skipped, true);
    assert.equal(again.reason, "already_sent_to_account");
    assert.equal(third.skipped, true);
  });

  it("does not resend after a penalty, while the penalty SMS itself still goes out", async () => {
    const db = createMemoryDb(seed());
    await nearTurn(db);
    const firstSentAt = db.read("users/p1/nearTurnSms/sentAt");

    const penalty = await penalized(db);
    assert.equal(penalty.success, true);
    assert.equal(penalty.skipped, undefined);
    assert.equal(fetchCalls.length, 2);

    const afterPenalty = await nearTurn(db);
    assert.equal(afterPenalty.skipped, true);
    assert.equal(fetchCalls.length, 2);
    assert.equal(db.read("users/p1/nearTurnSms/sentAt"), firstSentAt);
  });

  it("sends only one Near Turn SMS across children, reservations, dates, and branches", async () => {
    const db = createMemoryDb(seed());
    await nearTurn(db, { reservationId: "r1", branchId: "angeles", clinicDate: "2026-10-01" });
    const second = await nearTurn(db, { reservationId: "r2", branchId: "mabalacat", clinicDate: "2026-10-15" });

    assert.equal(fetchCalls.length, 1);
    assert.equal(second.reason, "already_sent_to_account");
    assert.equal(db.read("users/p1/nearTurnSms/reservationId"), "r1");
  });

  it("tracks accounts independently", async () => {
    const db = createMemoryDb(seed());
    await nearTurn(db, { parentId: "p1" });
    await nearTurn(db, { parentId: "p2", reservationId: "r9" });
    assert.equal(fetchCalls.length, 2);
  });

  it("leaves the account unmarked when the provider rejects the send, so a later attempt delivers", async () => {
    const db = createMemoryDb(seed());
    fetchMode = "fail";
    const failed = await nearTurn(db, { reservationId: "r1" });

    assert.equal(failed.success, false);
    assert.equal(db.read("users/p1/nearTurnSms"), undefined);
    assert.equal(db.read("notifications/p1/nearing_turn_r1/smsDispatchedAt"), undefined);

    fetchMode = "ok";
    const retry = await nearTurn(db, { reservationId: "r2" });
    assert.equal(retry.success, true);
    assert.equal(fetchCalls.length, 2);
    assert.ok(db.read("users/p1/nearTurnSms/sentAt") > 0);
  });

  it("leaves the account unmarked on a network error or when SMS is not configured", async () => {
    const db = createMemoryDb(seed());
    fetchMode = "throw";
    await nearTurn(db);
    assert.equal(db.read("users/p1/nearTurnSms"), undefined);

    delete process.env.TEXTBEE_API_KEY;
    const unconfigured = await nearTurn(db);
    assert.equal(unconfigured.reason, "not_configured");
    assert.equal(db.read("users/p1/nearTurnSms"), undefined);
  });

  it("sends at most one SMS when triggers run concurrently", async () => {
    const db = createMemoryDb(seed());
    fetchMode = "slow";
    const results = await Promise.all([
      nearTurn(db, { reservationId: "r1" }),
      nearTurn(db, { reservationId: "r1" }),
      nearTurn(db, { reservationId: "r2" }),
      nearTurn(db, { reservationId: "r2" }),
      nearTurn(db, { reservationId: "r1" }),
    ]);

    assert.equal(fetchCalls.length, 1);
    assert.equal(results.filter((r) => r.success && !r.skipped).length, 1);
    assert.equal(results.filter((r) => r.skipped).length, 4);
    assert.ok(db.read("users/p1/nearTurnSms/sentAt") > 0);
  });

  it("lets a new sender take over a stale pending claim left by a crashed sender", async () => {
    const db = createMemoryDb(seed());
    const stale = Date.now() - NEAR_TURN_SMS_PENDING_TTL_MS - 1;
    const crashed = await claimAccountNearTurnSms(db, "p1", { reservationId: "r1", now: stale });
    assert.equal(crashed.claimed, true);

    const result = await nearTurn(db, { reservationId: "r2" });
    assert.equal(result.success, true);
    assert.equal(fetchCalls.length, 1);
  });

  it("does not change other SMS types", async () => {
    const db = createMemoryDb(seed());
    await nearTurn(db);

    const reserved = await runWithDatabase(db, () =>
      deliverSmsForNotification("SLOT_RESERVED", { parentId: "p1", reservationId: "r2" }, "slot_reserved_r2")
    );
    const forfeited = await runWithDatabase(db, () =>
      deliverSmsForNotification("FORFEITED", { parentId: "p1", reservationId: "r2" }, "forfeited_r2")
    );
    await penalized(db, { reservationId: "r2", penaltyCount: 1 });
    await penalized(db, { reservationId: "r2", penaltyCount: 2 });

    assert.equal(reserved.success, true);
    assert.equal(forfeited.success, true);
    assert.equal(fetchCalls.length, 5);
  });
});

describe("Near Turn SMS backfill", () => {
  const data = {
    users: {
      p1: { role: "parent" },
      p2: { role: "parent" },
      p3: { role: "parent", nearTurnSms: { sentAt: 5 } },
      p4: { role: "parent" },
      doc: { role: "doctor" },
    },
    notifications: {
      p1: {
        nearing_turn_a: { type: "NEARING_TURN", smsDispatchedAt: 200, reservationId: "a" },
        nearing_turn_b: { type: "NEARING_TURN", smsDispatchedAt: 100, reservationId: "b" },
        penalized_a_1: { type: "PENALIZED", smsDispatchedAt: 50 },
      },
      p2: { nearing_turn_c: { type: "NEARING_TURN", reservationId: "c" } },
      p3: { nearing_turn_d: { type: "NEARING_TURN", smsDispatchedAt: 1 } },
      doc: { nearing_turn_x: { type: "NEARING_TURN", smsDispatchedAt: 1 } },
    },
    reservations: {
      e: { parentId: "p4", nearTurnSmsSent: true, updatedAt: 300 },
    },
  };

  it("marks parents with a dispatched Near Turn SMS, using the earliest record", () => {
    const plan = planNearTurnSmsBackfill(data);
    assert.deepEqual(
      plan.map(({ parentId, sentAt, reservationId }) => ({ parentId, sentAt, reservationId })),
      [{ parentId: "p1", sentAt: 100, reservationId: "b" }]
    );
  });

  it("optionally includes per-reservation claim flags", () => {
    const plan = planNearTurnSmsBackfill(data, { includeReservationFlags: true });
    assert.deepEqual(plan.map((entry) => entry.parentId).sort(), ["p1", "p4"]);
  });

  it("never overwrites an account that is already marked", async () => {
    const db = createMemoryDb({ users: data.users });
    const written = await applyNearTurnSmsBackfill(db, [
      { parentId: "p1", sentAt: 100, reservationId: "b" },
      { parentId: "p3", sentAt: 999, reservationId: "z" },
    ]);
    assert.equal(written, 1);
    assert.deepEqual(db.read("users/p1/nearTurnSms"), { sentAt: 100, reservationId: "b", backfilled: true });
    assert.deepEqual(db.read("users/p3/nearTurnSms"), { sentAt: 5 });
  });
});
