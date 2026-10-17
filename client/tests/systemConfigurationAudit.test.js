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
const { updateQueueRules, updateSmsRules } = requireFromFunctions("./systemConfigurationRuntime.js");

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
  const ref = (nodePath = "") => ({
    key: parts(nodePath).slice(-1)[0] || null,
    once: async () => {
      const value = get(nodePath);
      return { exists: () => value != null, val: () => structuredClone(value) };
    },
    set: async (value) => set(nodePath, value),
    push() {
      pushCount += 1;
      return ref(`${nodePath}/cfg-new-${pushCount}`);
    },
    update: async (updates) => {
      for (const [key, value] of Object.entries(updates || {})) set(`${nodePath}/${key}`, value);
    },
  });
  return { ref, read: (nodePath) => structuredClone(get(nodePath)) };
}

function listAuditLogs(db) {
  return Object.values(db.read("auditLogs") || {});
}

const DEFAULT_SMS = {
  nearingTurnAheadCount: 3,
  templateSlotReserved: "Reserved {queueNumber} at {branch} on {date}",
  templateQueueStarted: "Queue started at {branch} for {date}",
  templateNearingTurn: "Only {count} ahead (Queue #{queueNumber})",
  templateSlotReservedActiveQueue: "Active queue reserved {queueNumber} position {queuePosition}",
  templatePenalized: "Late {queueNumber} at {branch} within {minutes} minutes",
  templateForfeited: "Forfeited {queueNumber} at {branch} on {date}",
  templateClinicCancelled: "Closed at {branch} on {date} ({reason})",
};

function seed() {
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
      parent1: { role: "parent", status: "active", name: "Parent" },
    },
    branchConfigurations: {
      magalang: { name: "Magalang" },
      angeles: { name: "Angeles" },
    },
    systemConfiguration: {
      magalang: {
        penaltyMoveBack: 2,
        penaltyTimerMinutes: 15,
        penaltyGraceMinutes: 2,
        defaultSlotCapacity: 30,
        sms: { ...DEFAULT_SMS },
      },
    },
  };
}

describe("updateQueueRules audit", () => {
  it("writes QUEUE_RULES_UPDATED with before/after after a successful secretary save", async () => {
    const db = createMemoryDb(seed());
    const result = await updateQueueRules({
      admin: { database: () => db },
      callerUid: "secMag",
      branchId: "magalang",
      queueRules: {
        penaltyMoveBack: 4,
        penaltyTimerMinutes: 20,
        penaltyGraceMinutes: 1,
        defaultSlotCapacity: 40,
      },
    });

    assert.equal(result.unchanged, false);
    assert.equal(db.read("systemConfiguration/magalang/penaltyMoveBack"), 4);
    assert.equal(db.read("systemConfiguration/magalang/defaultSlotCapacity"), 40);

    const audits = listAuditLogs(db);
    assert.equal(audits.length, 1);
    const log = audits[0];
    assert.equal(log.action, "QUEUE_RULES_UPDATED");
    assert.equal(log.category, "system_management");
    assert.equal(log.actorUid, "secMag");
    assert.equal(log.actorName, "Sec Mag");
    assert.equal(log.actorRole, "secretary");
    assert.equal(log.branchId, "magalang");
    assert.equal(log.targetType, "systemConfiguration");
    assert.equal(log.targetId, "magalang");
    assert.equal(log.metadata.before.penaltyMoveBack, 2);
    assert.equal(log.metadata.after.penaltyMoveBack, 4);
    assert.equal(log.metadata.after.defaultSlotCapacity, 40);
    assert.ok(log.description.includes("queue rules"));
  });

  it("does not write an audit when values are unchanged", async () => {
    const db = createMemoryDb(seed());
    const result = await updateQueueRules({
      admin: { database: () => db },
      callerUid: "secMag",
      branchId: "magalang",
      queueRules: {
        penaltyMoveBack: 2,
        penaltyTimerMinutes: 15,
        penaltyGraceMinutes: 2,
        defaultSlotCapacity: 30,
      },
    });
    assert.equal(result.unchanged, true);
    assert.equal(listAuditLogs(db).length, 0);
  });

  it("does not write an audit when validation fails", async () => {
    const db = createMemoryDb(seed());
    await assert.rejects(
      updateQueueRules({
        admin: { database: () => db },
        callerUid: "secMag",
        branchId: "magalang",
        queueRules: {
          penaltyMoveBack: 99,
          penaltyTimerMinutes: 15,
          penaltyGraceMinutes: 2,
          defaultSlotCapacity: 30,
        },
      }),
      { code: "invalid-argument" }
    );
    assert.equal(listAuditLogs(db).length, 0);
    assert.equal(db.read("systemConfiguration/magalang/penaltyMoveBack"), 2);
  });

  it("blocks a secretary from another branch", async () => {
    const db = createMemoryDb(seed());
    await assert.rejects(
      updateQueueRules({
        admin: { database: () => db },
        callerUid: "secAng",
        branchId: "magalang",
        queueRules: {
          penaltyMoveBack: 3,
          penaltyTimerMinutes: 15,
          penaltyGraceMinutes: 2,
          defaultSlotCapacity: 30,
        },
      }),
      { code: "permission-denied" }
    );
    assert.equal(listAuditLogs(db).length, 0);
  });
});

describe("updateSmsRules audit", () => {
  it("writes SMS_RULES_UPDATED with before/after after a successful secretary save", async () => {
    const db = createMemoryDb(seed());
    const nextSms = {
      ...DEFAULT_SMS,
      nearingTurnAheadCount: 5,
      templateNearingTurn: "Heads up: {count} ahead (Queue #{queueNumber})",
    };
    const result = await updateSmsRules({
      admin: { database: () => db },
      callerUid: "secMag",
      branchId: "magalang",
      sms: nextSms,
    });

    assert.equal(result.unchanged, false);
    assert.equal(db.read("systemConfiguration/magalang/sms/nearingTurnAheadCount"), 5);

    const audits = listAuditLogs(db);
    assert.equal(audits.length, 1);
    const log = audits[0];
    assert.equal(log.action, "SMS_RULES_UPDATED");
    assert.equal(log.category, "system_management");
    assert.equal(log.actorUid, "secMag");
    assert.equal(log.actorRole, "secretary");
    assert.equal(log.branchId, "magalang");
    assert.equal(log.metadata.before.nearingTurnAheadCount, 3);
    assert.equal(log.metadata.after.nearingTurnAheadCount, 5);
    assert.equal(log.metadata.after.templateNearingTurn, nextSms.templateNearingTurn);
    assert.ok(log.metadata.changes.includes("near-turn ahead 3 → 5"));
    assert.ok(log.metadata.changes.includes("near-turn SMS template"));
  });

  it("does not write an audit when SMS values are unchanged", async () => {
    const db = createMemoryDb(seed());
    const result = await updateSmsRules({
      admin: { database: () => db },
      callerUid: "secMag",
      branchId: "magalang",
      sms: { ...DEFAULT_SMS },
    });
    assert.equal(result.unchanged, true);
    assert.equal(listAuditLogs(db).length, 0);
  });

  it("does not write an audit when parent tries to update SMS rules", async () => {
    const db = createMemoryDb(seed());
    await assert.rejects(
      updateSmsRules({
        admin: { database: () => db },
        callerUid: "parent1",
        branchId: "magalang",
        sms: { ...DEFAULT_SMS, nearingTurnAheadCount: 4 },
      }),
      { code: "permission-denied" }
    );
    assert.equal(listAuditLogs(db).length, 0);
  });
});

describe("audit action filters for new types", () => {
  it("includes readable labels for the new secretary actions", () => {
    const values = AUDIT_ACTION_FILTER_OPTIONS.map((opt) => opt.value);
    assert.ok(values.includes("QUEUE_RULES_UPDATED"));
    assert.ok(values.includes("SMS_RULES_UPDATED"));
    assert.ok(values.includes("SCHEDULE_PUBLISHED"));
    assert.ok(values.includes("SCHEDULE_RANGE_PUBLISHED"));
  });

  it("matches the new action filters", () => {
    assert.equal(
      matchesAuditActionFilter({ action: "QUEUE_RULES_UPDATED" }, "QUEUE_RULES_UPDATED"),
      true
    );
    assert.equal(
      matchesAuditActionFilter({ action: "SMS_RULES_UPDATED" }, "SCHEDULE_PUBLISHED"),
      false
    );
  });
});
