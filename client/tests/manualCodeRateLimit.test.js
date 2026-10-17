import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { matchesAuditActionFilter, AUDIT_ACTION_FILTER_OPTIONS } from "../src/utils/auditLogFilters.js";

const require = createRequire(import.meta.url);
const {
  MAX_FAILED_ATTEMPTS,
  WINDOW_MS,
  LOCKOUT_MS,
  maskReservationCode,
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

describe("maskReservationCode", () => {
  it("masks middle characters", () => {
    assert.equal(maskReservationCode("ABC123"), "A****3");
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
      { failCount: 5, windowStartedAt: now - 1000, lockedUntil: now + 60_000 },
      now
    );
    assert.equal(result.allowed, false);
    assert.equal(result.locked, true);
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
  it("locks on the 5th failure", () => {
    const now = 2_000_000;
    let state = null;
    for (let i = 0; i < 4; i += 1) {
      state = nextFailedAttemptState(state, now + i, "branch-a");
      assert.equal(state.justLocked, false);
    }
    state = nextFailedAttemptState(state, now + 4, "branch-a");
    assert.equal(state.justLocked, true);
    assert.equal(state.failCount, MAX_FAILED_ATTEMPTS);
    assert.equal(state.lockedUntil, now + 4 + LOCKOUT_MS);
  });
});

describe("matchesAuditActionFilter", () => {
  it("matches specific actions and all", () => {
    assert.equal(matchesAuditActionFilter({ action: "MANUAL_CODE_FAILED" }, "all"), true);
    assert.equal(matchesAuditActionFilter({ action: "MANUAL_CODE_FAILED" }, "MANUAL_CODE_FAILED"), true);
    assert.equal(matchesAuditActionFilter({ action: "MANUAL_CODE_FAILED" }, "MANUAL_CODE_LOCKED"), false);
    assert.ok(AUDIT_ACTION_FILTER_OPTIONS.some((o) => o.value === "MANUAL_CODE_LOCKED"));
  });
});

describe("validateReservationCode runtime", () => {
  it("returns reservation on hit and records failures then lockout", async () => {
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
          code: "BADBAD",
          source: "manual",
        }),
      (err) => err.code === "resource-exhausted"
    );

    const audits = db._root.auditLogs || {};
    const actions = Object.values(audits).map((row) => row.action);
    assert.ok(actions.includes("MANUAL_CODE_FAILED"));
    assert.ok(actions.includes("MANUAL_CODE_LOCKED"));

    const alerts = db._root.adminAlerts?.admin1 || {};
    assert.ok(Object.values(alerts).some((a) => a.type === "MANUAL_CODE_LOCKOUT"));
  });
});
