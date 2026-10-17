import assert from "node:assert/strict";
import path from "node:path";
import { describe, it } from "node:test";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { addManilaDays, manilaDateString } from "../src/utils/manilaDate.js";

const functionsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../functions");
const requireFromFunctions = createRequire(path.join(functionsDir, "package.json"));
const {
  expirePastUnusedReservations,
  isUnusedActive,
} = requireFromFunctions("./expirePastUnusedReservations.js");

function createMemoryDb(initial = {}) {
  const root = structuredClone(initial);
  const parts = (nodePath) => String(nodePath || "").split("/").filter(Boolean);
  const get = (nodePath) =>
    parts(nodePath).reduce(
      (node, key) => (node == null || typeof node !== "object" ? undefined : node[key]),
      root
    );
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
    forEach: (cb) => {
      if (value == null || typeof value !== "object") return;
      Object.keys(value).forEach((key) => {
        cb({
          key,
          val: () => structuredClone(value[key]),
          exists: () => true,
        });
      });
    },
  });

  const ref = (nodePath = "") => ({
    key: parts(nodePath).slice(-1)[0] || null,
    child: (childPath) => ref(`${nodePath}/${childPath}`),
    once: async () => snapshot(get(nodePath)),
    set: async (value) => set(nodePath, value),
    update: async (updates) => {
      const current = get(nodePath) || {};
      set(nodePath, { ...current, ...updates });
    },
    transaction: async (fn) => {
      const current = get(nodePath);
      const next = fn(current == null ? null : structuredClone(current));
      if (next === undefined) {
        return { committed: false, snapshot: snapshot(get(nodePath)) };
      }
      set(nodePath, next);
      return { committed: true, snapshot: snapshot(get(nodePath)) };
    },
  });

  return {
    root,
    ref: (nodePath) => ref(nodePath),
  };
}

describe("expirePastUnusedReservations", () => {
  it("marks isUnusedActive only for never-checked-in waiting statuses", () => {
    assert.equal(isUnusedActive({ status: "reserved" }), true);
    assert.equal(isUnusedActive({ status: "waiting" }), true);
    assert.equal(isUnusedActive({ status: "checked_in" }), false);
    assert.equal(isUnusedActive({ status: "consultation_completed" }), false);
    assert.equal(isUnusedActive({ status: "reserved", checkedIn: true }), false);
  });

  it("expires a past unused reservation and keeps a completed one", async () => {
    const today = manilaDateString();
    const past = addManilaDays(today, -2);
    const mem = createMemoryDb({
      schedules: {
        "sched-past": { clinicDate: past, booking: { holdersTracked: true, holders: { "res-unused": 1 }, activeSlotCount: 1 } },
        "sched-done": { clinicDate: past, booking: { holdersTracked: true, holders: {}, activeSlotCount: 0 } },
      },
      reservations: {
        "res-unused": {
          status: "reserved",
          scheduleId: "sched-past",
          clinicDate: past,
          parentId: "parent-1",
          queueNumber: 3,
        },
        "res-done": {
          status: "consultation_completed",
          scheduleId: "sched-done",
          clinicDate: past,
          parentId: "parent-2",
          queueNumber: 1,
          checkedIn: true,
        },
      },
    });

    const rtdbRouter = requireFromFunctions("./rtdbRouter.js");
    const originalGetRtdb = rtdbRouter.getRtdb;
    rtdbRouter.getRtdb = () => mem;

    try {
      // Stub queue recalc / slot release internals by ensuring TERMINAL path works via slotRelease
      const result = await expirePastUnusedReservations({ today });
      assert.equal(result.expired, 1);
      assert.equal(mem.root.reservations["res-unused"].status, "expired");
      assert.ok(mem.root.reservations["res-unused"].expiredAt);
      assert.equal(mem.root.reservations["res-done"].status, "consultation_completed");
    } finally {
      rtdbRouter.getRtdb = originalGetRtdb;
    }
  });
});
