import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { matchesAuditActionFilter, AUDIT_ACTION_FILTER_OPTIONS } from "../src/utils/auditLogFilters.js";
import {
  formatLockCountdown,
  saveManualCodeLockout,
  loadManualCodeLockout,
  clearManualCodeLockout,
} from "../src/utils/manualCodeLockoutUi.js";

const require = createRequire(import.meta.url);
const {
  MAX_FAILED_ATTEMPTS,
  WINDOW_MS,
  MANUAL_CODE_LOCKOUT_MINUTES,
  LOCKOUT_MS,
  maskReservationCode,
  formatManualCodeLockMessage,
  evaluateManualCodeRateLimit,
  nextFailedAttemptState,
  validateReservationCode,
} = require("../functions/validateReservationCodeRuntime.js");

const tick = () => new Promise((resolve) => setImmediate(resolve));

function createTreeDb(initial = {}) {
  const root = structuredClone(initial);
  const segs = (path) => String(path).split("/").filter(Boolean);
  const read = (path) => segs(path).reduce((node, key) => (node == null ? undefined : node[key]), root);
  const write = (path, value) => {
    const keys = segs(path);
    let node = root;
    for (const key of keys.slice(0, -1)) {
      if (node[key] == null || typeof node[key] !== "object") node[key] = {};
      node = node[key];
    }
    const last = keys[keys.length - 1];
    if (value === null || value === undefined) delete node[last];
    else node[last] = structuredClone(value);
  };
  const snap = (val, key) => ({
    key,
    exists: () => val !== undefined && val !== null,
    val: () => (val === undefined ? null : structuredClone(val)),
    forEach: (fn) => {
      if (!val || typeof val !== "object") return;
      Object.entries(val).forEach(([childKey, child]) => fn(snap(child, childKey)));
    },
  });
  let pushSeq = 0;

  const ref = (path = "") => ({
    key: segs(path).pop(),
    async once() {
      await tick();
      return snap(read(path));
    },
    async set(value) {
      await tick();
      write(path, value);
    },
    async update(value) {
      await tick();
      const current = read(path) || {};
      write(path, { ...current, ...value });
    },
    push() {
      pushSeq += 1;
      const childPath = path ? `${path}/push_${pushSeq}` : `push_${pushSeq}`;
      const child = ref(childPath);
      child.key = `push_${pushSeq}`;
      return child;
    },
    orderByChild(childKey) {
      return {
        equalTo(value) {
          return {
            async once() {
              await tick();
              const all = read(path) || {};
              const matched = {};
              Object.entries(all).forEach(([id, row]) => {
                if (row && row[childKey] === value) matched[id] = row;
              });
              return snap(Object.keys(matched).length ? matched : null);
            },
          };
        },
      };
    },
  });

  return {
    ref,
    _root: root,
  };
}

describe("lockout constants", () => {
  it("uses a 5-minute lockout from a single shared minutes constant", () => {
    assert.equal(MANUAL_CODE_LOCKOUT_MINUTES, 5);
    assert.equal(LOCKOUT_MS, 5 * 60 * 1000);
    assert.equal(MAX_FAILED_ATTEMPTS, 5);
    assert.equal(WINDOW_MS, 15 * 60 * 1000);
  });
});

describe("maskReservationCode", () => {
  it("masks middle characters of the reservation code", () => {
    assert.equal(maskReservationCode("ABC123"), "A****3");
    assert.equal(maskReservationCode("1ABCX1"), "1****1");
  });
});

describe("formatManualCodeLockMessage", () => {
  it("includes 5 minutes and the masked code, never 15 minutes", () => {
    const msg = formatManualCodeLockMessage("1****1");
    assert.equal(
      msg,
      "Manual reservation-code entry locked for 5 minutes after repeated failures (1****1)."
    );
    assert.ok(msg.includes("5 minutes"));
    assert.equal(msg.includes("15 minutes"), false);
  });
});

describe("evaluateManualCodeRateLimit", () => {
  it("allows a fresh window", () => {
    const now = 1_000_000;
    const result = evaluateManualCodeRateLimit(null, now);
    assert.equal(result.allowed, true);
    assert.equal(result.remainingAttempts, MAX_FAILED_ATTEMPTS);
  });

  it("blocks while locked", () => {
    const now = 1_000_000;
    const result = evaluateManualCodeRateLimit(
      { failCount: 5, windowStartedAt: now - 1000, lockedUntil: now + 60_000, updatedAt: now - 1000 },
      now
    );
    assert.equal(result.allowed, false);
    assert.equal(result.locked, true);
  });

  it("rejects at 4:59 into the lock and allows at 5:00", () => {
    const lockStart = 2_000_000;
    const lockedUntil = lockStart + LOCKOUT_MS;
    const state = {
      failCount: 5,
      windowStartedAt: lockStart - 1000,
      lockedUntil,
      updatedAt: lockStart,
    };

    const at459 = evaluateManualCodeRateLimit(state, lockedUntil - 1000);
    assert.equal(at459.allowed, false);
    assert.equal(at459.locked, true);
    assert.equal(at459.lockedUntil, lockedUntil);

    const at500 = evaluateManualCodeRateLimit(state, lockedUntil);
    assert.equal(at500.allowed, true);
    assert.equal(at500.locked, false);
  });

  it("caps legacy 15-minute locks to 5 minutes from updatedAt", () => {
    const lockStart = 3_000_000;
    const legacyUntil = lockStart + 15 * 60 * 1000;
    const state = {
      failCount: 5,
      windowStartedAt: lockStart - 500,
      lockedUntil: legacyUntil,
      updatedAt: lockStart,
    };

    const midLegacy = evaluateManualCodeRateLimit(state, lockStart + 4 * 60 * 1000);
    assert.equal(midLegacy.locked, true);
    assert.equal(midLegacy.lockedUntil, lockStart + LOCKOUT_MS);
    assert.equal(midLegacy.cappedLockedUntil, true);

    const afterCap = evaluateManualCodeRateLimit(state, lockStart + LOCKOUT_MS);
    assert.equal(afterCap.allowed, true);
    assert.equal(afterCap.locked, false);
  });

  it("resets after the window expires", () => {
    const now = 1_000_000;
    const result = evaluateManualCodeRateLimit(
      { failCount: 4, windowStartedAt: now - WINDOW_MS - 1, lockedUntil: null },
      now
    );
    assert.equal(result.allowed, true);
    assert.equal(result.failCount, 0);
  });
});

describe("nextFailedAttemptState", () => {
  it("locks on the 5th failure for LOCKOUT_MS", () => {
    const now = 2_000_000;
    let state = null;
    for (let i = 0; i < 4; i += 1) {
      state = nextFailedAttemptState(state, now + i, "branch-a", "B****1");
      assert.equal(state.justLocked, false);
    }
    state = nextFailedAttemptState(state, now + 4, "branch-a", "B****1");
    assert.equal(state.justLocked, true);
    assert.equal(state.failCount, MAX_FAILED_ATTEMPTS);
    assert.equal(state.lockedUntil, now + 4 + LOCKOUT_MS);
    assert.equal(state.lastMaskedCode, "B****1");
  });
});

describe("matchesAuditActionFilter", () => {
  it("matches security group for manual-code actions and all", () => {
    assert.equal(matchesAuditActionFilter({ action: "MANUAL_CODE_FAILED" }, "all"), true);
    assert.equal(matchesAuditActionFilter({ action: "MANUAL_CODE_FAILED" }, "security"), true);
    assert.equal(matchesAuditActionFilter({ action: "MANUAL_CODE_FAILED" }, "queue"), false);
    assert.ok(AUDIT_ACTION_FILTER_OPTIONS.some((o) => o.value === "security"));
  });
});

describe("manualCodeLockoutUi sessionStorage", () => {
  it("persists lock across load and clears when expired", () => {
    const store = new Map();
    globalThis.sessionStorage = {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
    };

    const uid = "sec-test";
    const lockedUntil = Date.now() + 60_000;
    const message = formatManualCodeLockMessage("1****1");
    saveManualCodeLockout(uid, { lockedUntil, message });

    const loaded = loadManualCodeLockout(uid);
    assert.equal(loaded.lockedUntil, lockedUntil);
    assert.equal(loaded.message, message);
    assert.ok(loaded.message.includes("5 minutes"));

    const expired = loadManualCodeLockout(uid, lockedUntil + 1);
    assert.equal(expired, null);

    saveManualCodeLockout(uid, { lockedUntil: Date.now() + 10_000, message });
    clearManualCodeLockout(uid);
    assert.equal(loadManualCodeLockout(uid), null);

    const now = 1_700_000_000_000;
    assert.equal(formatLockCountdown(now + 4 * 60 * 1000 + 32 * 1000, now), "4:32");
  });
});

describe("validateReservationCode runtime", () => {
  it("returns reservation on hit and records failures then lockout with 5-minute message", async () => {
    const db = createTreeDb({
      users: {
        sec1: {
          role: "secretary",
          status: "active",
          name: "Sec One",
          assignedBranchId: "b1",
          assignedBranch: "Angeles",
        },
        admin1: { role: "admin", status: "active", name: "Admin" },
      },
      reservations: {
        r1: {
          reservationCode: "GOOD12",
          scheduleId: "s1",
          status: "reserved",
        },
      },
    });
    const admin = { database: () => db };

    const hit = await validateReservationCode({
      admin,
      callerUid: "sec1",
      code: "GOOD12",
      source: "manual",
    });
    assert.equal(hit.reservation.id, "r1");

    for (let i = 0; i < 4; i += 1) {
      const miss = await validateReservationCode({
        admin,
        callerUid: "sec1",
        code: "BADBAD",
        source: "manual",
      });
      assert.equal(miss.reservation, null);
    }

    await assert.rejects(
      () =>
        validateReservationCode({
          admin,
          callerUid: "sec1",
          code: "1ABCX1",
          source: "manual",
        }),
      (err) =>
        err.code === "resource-exhausted" &&
        err.message.includes("5 minutes") &&
        err.message.includes("1****1") &&
        !err.message.includes("15 minutes") &&
        typeof err.lockedUntil === "number" &&
        err.lockedUntil > Date.now()
    );

    const audits = db._root.auditLogs || {};
    const actions = Object.values(audits).map((row) => row.action);
    assert.ok(actions.includes("MANUAL_CODE_FAILED"));
    assert.ok(actions.includes("MANUAL_CODE_LOCKED"));
    const lockAudit = Object.values(audits).find((row) => row.action === "MANUAL_CODE_LOCKED");
    assert.ok(lockAudit.description.includes("5 minutes"));
    assert.equal(lockAudit.description.includes("15 minutes"), false);

    const alerts = db._root.adminAlerts?.admin1 || {};
    assert.ok(Object.values(alerts).some((a) => a.type === "MANUAL_CODE_LOCKOUT"));

    const rate = db._root.rateLimits?.manualCode?.sec1;
    assert.ok(rate?.lockedUntil);
    assert.equal(rate.lastMaskedCode, "1****1");

    // Still locked: subsequent attempt returns same lock message with stored mask.
    await assert.rejects(
      () =>
        validateReservationCode({
          admin,
          callerUid: "sec1",
          code: "ZZZZZZ",
          source: "manual",
        }),
      (err) =>
        err.code === "resource-exhausted" &&
        err.message.includes("5 minutes") &&
        err.message.includes("1****1")
    );
  });
});
