import assert from "node:assert/strict";
import path from "node:path";
import { describe, it } from "node:test";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const functionsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../functions");
const requireFromFunctions = createRequire(path.join(functionsDir, "package.json"));
const { publishClinicDays } = requireFromFunctions("./schedulePublishRuntime.js");

// Tuesday, Oct. 6, 2026. Times are Asia/Manila (UTC+8) regardless of the machine's timezone.
const manila = (time) => new Date(`2026-10-06T${time}:00+08:00`);
const TODAY = "2026-10-06";
const YESTERDAY = "2026-10-05";
const FUTURE = "2026-10-13";

function createMemoryDb(initial = {}) {
  const root = structuredClone(initial);
  let pushCount = 0;
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
    node[keys[keys.length - 1]] = structuredClone(value);
  };
  const ref = (nodePath = "") => ({
    key: parts(nodePath).slice(-1)[0] || null,
    once: async () => {
      const value = get(nodePath);
      return { exists: () => value != null, val: () => structuredClone(value) };
    },
    push() {
      pushCount += 1;
      return ref(`${nodePath}/sched-new-${pushCount}`);
    },
    update: async (updates) => {
      for (const [key, value] of Object.entries(updates || {})) set(`${nodePath}/${key}`, value);
    },
  });
  return { ref, read: (nodePath) => structuredClone(get(nodePath)) };
}

const closedDay = { isOpen: false, openingTime: "", closingTime: "" };

function seed() {
  return {
    users: {
      doc1: { role: "doctor", status: "active", email: "doc@example.com" },
      secMag: { role: "secretary", status: "active", assignedBranchId: "magalang", assignedBranch: "Magalang" },
      secAng: { role: "secretary", status: "active", assignedBranchId: "angeles", assignedBranch: "Angeles" },
      parent1: { role: "parent", status: "active" },
    },
    branchConfigurations: {
      magalang: {
        name: "Magalang",
        schedule: {
          sunday: closedDay,
          tuesday: { isOpen: true, openingTime: "09:00", closingTime: "12:00" },
        },
      },
      angeles: {
        name: "Angeles",
        schedule: {
          sunday: closedDay,
          tuesday: { isOpen: true, openingTime: "15:00", closingTime: "17:00" },
        },
      },
    },
  };
}

async function post({ db, uid, branchId = "magalang", dateStr, time, slotCapacity = 20 }) {
  return publishClinicDays({
    admin: { database: () => db },
    callerUid: uid,
    payload: { mode: "single", branchId, days: [{ dateStr, slotCapacity }] },
    now: manila(time),
  });
}

const STAFF = [
  ["doctor", "doc1"],
  ["secretary", "secMag"],
];

for (const [role, uid] of STAFF) {
  describe(`publishClinicDays as ${role}`, () => {
    it("rejects yesterday", async () => {
      const db = createMemoryDb(seed());
      await assert.rejects(post({ db, uid, dateStr: YESTERDAY, time: "08:00" }), {
        code: "failed-precondition",
        message: "You cannot open a reservation for a past date.",
      });
      assert.equal(db.read("schedules"), undefined);
    });

    it("allows today before closing time and writes a published schedule", async () => {
      const db = createMemoryDb(seed());
      const result = await post({ db, uid, dateStr: TODAY, time: "11:30" });
      assert.equal(result.posted.length, 1);
      const saved = db.read(`schedules/${result.posted[0].scheduleId}`);
      assert.equal(saved.status, "published");
      assert.equal(saved.queueStatus, "not_started");
      assert.equal(saved.clinicDate, TODAY);
      assert.equal(saved.branchId, "magalang");
      assert.equal(saved.openingTime, "09:00");
      assert.equal(saved.closingTime, "12:00");
      assert.equal(saved.slotCapacity, 20);
      assert.equal(saved.createdByRole, role);
      assert.equal(saved.doctorId, "doc1");
    });

    it("rejects today at 12:01 PM after Magalang closes", async () => {
      const db = createMemoryDb(seed());
      await assert.rejects(post({ db, uid, dateStr: TODAY, time: "12:01" }), {
        code: "failed-precondition",
        message:
          "You cannot open a reservation because today's clinic hours at Magalang have already ended (9:00 AM to 12:00 PM).",
      });
    });

    it("allows a future date", async () => {
      const db = createMemoryDb(seed());
      const result = await post({ db, uid, dateStr: FUTURE, time: "12:01" });
      assert.equal(db.read(`schedules/${result.posted[0].scheduleId}`).clinicDate, FUTURE);
    });
  });
}

describe("publishClinicDays per-location hours and access", () => {
  it("allows Angeles at 12:01 PM on the same Tuesday Magalang has closed", async () => {
    const db = createMemoryDb(seed());
    const result = await post({ db, uid: "secAng", branchId: "angeles", dateStr: TODAY, time: "12:01" });
    const saved = db.read(`schedules/${result.posted[0].scheduleId}`);
    assert.equal(saved.openingTime, "15:00");
    assert.equal(saved.closingTime, "17:00");
    await assert.rejects(post({ db, uid: "doc1", dateStr: TODAY, time: "12:01" }), { code: "failed-precondition" });
  });

  it("blocks a secretary from posting for another branch", async () => {
    const db = createMemoryDb(seed());
    await assert.rejects(post({ db, uid: "secAng", branchId: "magalang", dateStr: FUTURE, time: "08:00" }), {
      code: "permission-denied",
    });
  });

  it("blocks parents", async () => {
    const db = createMemoryDb(seed());
    await assert.rejects(post({ db, uid: "parent1", dateStr: FUTURE, time: "08:00" }), { code: "permission-denied" });
  });

  it("rejects a second post for the same day", async () => {
    const db = createMemoryDb(seed());
    await post({ db, uid: "doc1", dateStr: FUTURE, time: "08:00" });
    await assert.rejects(post({ db, uid: "secMag", dateStr: FUTURE, time: "08:00" }), { code: "failed-precondition" });
  });

  it("bulk mode skips past and after-hours days and posts the rest", async () => {
    const db = createMemoryDb(seed());
    const result = await publishClinicDays({
      admin: { database: () => db },
      callerUid: "secMag",
      payload: {
        mode: "bulk",
        branchId: "magalang",
        days: [YESTERDAY, TODAY, FUTURE].map((dateStr) => ({ dateStr, slotCapacity: 15 })),
      },
      now: manila("12:30"),
    });
    assert.deepEqual(result.posted.map((item) => item.dateStr), [FUTURE]);
    assert.deepEqual(
      result.skipped.map((item) => [item.dateStr, item.code]),
      [[YESTERDAY, "past_date"], [TODAY, "after_hours"]]
    );
  });
});
