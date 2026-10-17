import assert from "node:assert/strict";
import path from "node:path";
import { describe, it } from "node:test";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import {
  AUDIT_ACTION_FILTER_OPTIONS,
  matchesAuditActionFilter,
} from "../src/utils/auditLogFilters.js";

const functionsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../functions");
const requireFromFunctions = createRequire(path.join(functionsDir, "package.json"));
const {
  updateQueueSessionStatus,
  endClinicSession,
  updateScheduleSlotCapacity,
} = requireFromFunctions("./queueSessionRuntime.js");

function createMemoryDb(initial = {}) {
  const root = structuredClone(initial);
  let pushCount = 0;
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
    node[keys[keys.length - 1]] = structuredClone(value);
  };
  const snapshot = (value) => ({
    exists: () => value != null,
    val: () => (value == null ? null : structuredClone(value)),
  });
  const ref = (nodePath = "") => ({
    key: parts(nodePath).slice(-1)[0] || null,
    once: async () => snapshot(get(nodePath)),
    set: async (value) => set(nodePath, value),
    push() {
      pushCount += 1;
      return ref(`${nodePath}/sess-new-${pushCount}`);
    },
    update: async (updates) => {
      for (const [key, value] of Object.entries(updates || {})) set(`${nodePath}/${key}`, value);
    },
    orderByChild: (field) => ({
      equalTo: (value) => ({
        once: async () => {
          const rows = get(nodePath) || {};
          const matched = Object.fromEntries(
            Object.entries(rows).filter(([, row]) => row && row[field] === value)
          );
          return snapshot(Object.keys(matched).length ? matched : null);
        },
      }),
    }),
  });
  return { ref, read: (nodePath) => structuredClone(get(nodePath)) };
}

function listAuditLogs(db) {
  return Object.values(db.read("auditLogs") || {});
}

function seed(overrides = {}) {
  return {
    users: {
      doc1: { role: "doctor", status: "active", name: "Dr. Ada" },
      secMag: {
        role: "secretary",
        status: "active",
        assignedBranchId: "magalang",
        assignedBranch: "Magalang",
        name: "Sec Mag",
      },
      secAng: {
        role: "secretary",
        status: "active",
        assignedBranchId: "angeles",
        assignedBranch: "Angeles",
        name: "Sec Ang",
      },
    },
    schedules: {
      sched1: {
        status: "published",
        queueStatus: "active",
        queueStartedAt: 1,
        branch: "Magalang",
        branchId: "magalang",
        clinicDate: "2026-10-17",
        openingTime: "09:00",
        closingTime: "12:00",
        slotCapacity: 20,
        ...overrides.schedule,
      },
    },
    reservations: overrides.reservations || {},
  };
}

describe("updateQueueSessionStatus audit", () => {
  it("audits pause by secretary", async () => {
    const db = createMemoryDb(seed());
    const result = await updateQueueSessionStatus({
      admin: { database: () => db },
      callerUid: "secMag",
      scheduleId: "sched1",
      queueStatus: "paused",
    });
    assert.equal(result.unchanged, false);
    assert.equal(db.read("schedules/sched1/queueStatus"), "paused");
    const audits = listAuditLogs(db);
    assert.equal(audits.length, 1);
    assert.equal(audits[0].action, "QUEUE_PAUSED");
    assert.equal(audits[0].actorRole, "secretary");
    assert.equal(audits[0].actorUid, "secMag");
    assert.equal(audits[0].targetId, "sched1");
    assert.equal(audits[0].metadata.previousStatus, "active");
  });

  it("audits resume by secretary", async () => {
    const db = createMemoryDb(seed({ schedule: { queueStatus: "paused" } }));
    await updateQueueSessionStatus({
      admin: { database: () => db },
      callerUid: "secMag",
      scheduleId: "sched1",
      queueStatus: "active",
    });
    const audits = listAuditLogs(db);
    assert.equal(audits[0].action, "QUEUE_RESUMED");
    assert.equal(audits[0].metadata.isFirstStart, false);
  });

  it("audits close by secretary", async () => {
    const db = createMemoryDb(seed());
    await updateQueueSessionStatus({
      admin: { database: () => db },
      callerUid: "secMag",
      scheduleId: "sched1",
      queueStatus: "closed",
    });
    assert.equal(listAuditLogs(db)[0].action, "QUEUE_CLOSED");
  });

  it("audits first start as QUEUE_STARTED", async () => {
    const db = createMemoryDb(
      seed({
        schedule: {
          queueStatus: "not_started",
          queueStartedAt: null,
          clinicDate: "2026-10-17",
        },
      })
    );
    await updateQueueSessionStatus({
      admin: { database: () => db },
      callerUid: "secMag",
      scheduleId: "sched1",
      queueStatus: "active",
      now: new Date("2026-10-17T01:00:00+08:00"),
    });
    const audits = listAuditLogs(db);
    assert.equal(audits[0].action, "QUEUE_STARTED");
    assert.equal(audits[0].metadata.isFirstStart, true);
    assert.ok(db.read("schedules/sched1/queueStartedAt"));
  });

  it("does not audit when status is unchanged", async () => {
    const db = createMemoryDb(seed());
    const result = await updateQueueSessionStatus({
      admin: { database: () => db },
      callerUid: "secMag",
      scheduleId: "sched1",
      queueStatus: "active",
    });
    assert.equal(result.unchanged, true);
    assert.equal(listAuditLogs(db).length, 0);
  });

  it("blocks secretary from another branch", async () => {
    const db = createMemoryDb(seed());
    await assert.rejects(
      updateQueueSessionStatus({
        admin: { database: () => db },
        callerUid: "secAng",
        scheduleId: "sched1",
        queueStatus: "paused",
      }),
      { code: "permission-denied" }
    );
    assert.equal(listAuditLogs(db).length, 0);
  });
});

describe("endClinicSession audit", () => {
  it("audits SCHEDULE_COMPLETED and completes leftover reservations", async () => {
    const db = createMemoryDb(
      seed({
        reservations: {
          r1: { scheduleId: "sched1", status: "checked_in" },
          r2: { scheduleId: "sched1", status: "consultation_completed" },
        },
      })
    );
    const result = await endClinicSession({
      admin: { database: () => db },
      callerUid: "secMag",
      scheduleId: "sched1",
    });
    assert.equal(result.unchanged, false);
    assert.equal(db.read("schedules/sched1/status"), "completed");
    assert.equal(db.read("schedules/sched1/queueStatus"), "completed");
    assert.equal(db.read("reservations/r1/status"), "completed");
    assert.equal(db.read("reservations/r2/status"), "consultation_completed");
    const audits = listAuditLogs(db);
    assert.equal(audits.length, 1);
    assert.equal(audits[0].action, "SCHEDULE_COMPLETED");
    assert.equal(audits[0].actorRole, "secretary");
    assert.equal(audits[0].metadata.completedReservations, 1);
  });

  it("does not write audit when already completed", async () => {
    const db = createMemoryDb(seed({ schedule: { status: "completed", queueStatus: "completed" } }));
    const result = await endClinicSession({
      admin: { database: () => db },
      callerUid: "secMag",
      scheduleId: "sched1",
    });
    assert.equal(result.unchanged, true);
    assert.equal(listAuditLogs(db).length, 0);
  });
});

describe("updateScheduleSlotCapacity audit", () => {
  it("audits SLOT_CAPACITY_UPDATED with before/after for secretary", async () => {
    const db = createMemoryDb(seed());
    const result = await updateScheduleSlotCapacity({
      admin: { database: () => db },
      callerUid: "secMag",
      scheduleId: "sched1",
      slotCapacity: 35,
    });
    assert.equal(result.unchanged, false);
    assert.equal(db.read("schedules/sched1/slotCapacity"), 35);
    const log = listAuditLogs(db)[0];
    assert.equal(log.action, "SLOT_CAPACITY_UPDATED");
    assert.equal(log.actorRole, "secretary");
    assert.equal(log.metadata.before.slotCapacity, 20);
    assert.equal(log.metadata.after.slotCapacity, 35);
  });

  it("audits slot changes by doctor", async () => {
    const db = createMemoryDb(seed());
    await updateScheduleSlotCapacity({
      admin: { database: () => db },
      callerUid: "doc1",
      scheduleId: "sched1",
      slotCapacity: 18,
    });
    assert.equal(listAuditLogs(db)[0].actorRole, "doctor");
    assert.equal(listAuditLogs(db)[0].metadata.after.slotCapacity, 18);
  });

  it("rejects reducing below occupied slots and writes no audit", async () => {
    const db = createMemoryDb(
      seed({
        reservations: {
          r1: { scheduleId: "sched1", status: "reserved" },
          r2: { scheduleId: "sched1", status: "checked_in" },
          r3: { scheduleId: "sched1", status: "cancelled" },
        },
      })
    );
    await assert.rejects(
      updateScheduleSlotCapacity({
        admin: { database: () => db },
        callerUid: "secMag",
        scheduleId: "sched1",
        slotCapacity: 1,
      }),
      { code: "failed-precondition" }
    );
    assert.equal(db.read("schedules/sched1/slotCapacity"), 20);
    assert.equal(listAuditLogs(db).length, 0);
  });

  it("does not audit when capacity is unchanged", async () => {
    const db = createMemoryDb(seed());
    const result = await updateScheduleSlotCapacity({
      admin: { database: () => db },
      callerUid: "secMag",
      scheduleId: "sched1",
      slotCapacity: 20,
    });
    assert.equal(result.unchanged, true);
    assert.equal(listAuditLogs(db).length, 0);
  });
});

describe("session and slot filter labels", () => {
  it("exposes labels for session and slot actions", () => {
    const values = AUDIT_ACTION_FILTER_OPTIONS.map((opt) => opt.value);
    for (const action of [
      "QUEUE_PAUSED",
      "QUEUE_RESUMED",
      "QUEUE_CLOSED",
      "SCHEDULE_COMPLETED",
      "SLOT_CAPACITY_UPDATED",
    ]) {
      assert.ok(values.includes(action), action);
      assert.equal(matchesAuditActionFilter({ action }, action), true);
    }
  });
});
