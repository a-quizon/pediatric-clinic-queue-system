import assert from "node:assert/strict";
import path from "node:path";
import { describe, it } from "node:test";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import {
  applyCheckInStatusTransition,
  assertCanCheckIn,
} from "../src/utils/reservationTransitions.js";

const functionsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../functions");
const requireFromFunctions = createRequire(path.join(functionsDir, "package.json"));
const { claimReservationSlot } = requireFromFunctions("./claimReservationRuntime.js");
const { manilaDateString, addManilaDays } = requireFromFunctions("./manilaDate.js");

const CLINIC_DATE = addManilaDays(manilaDateString(), 1);
const SCHEDULE_ID = "sched-checkin-1";

function createMemoryDb(initial = {}) {
  const root = structuredClone(initial);
  let pushCount = 0;
  /** Serialize transactions per path so parallel CAS behaves like RTDB. */
  const txTails = new Map();

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
    key: parts(nodePath).slice(-1)[0] || null,
    child: (childPath) => ref(`${nodePath}/${childPath}`),
    once: async () => snapshot(get(nodePath)),
    set: async (value) => set(nodePath, value),
    remove: async () => set(nodePath, null),
    update: async (updates) => {
      for (const [key, value] of Object.entries(updates || {})) set(`${nodePath}/${key}`, value);
    },
    push() {
      pushCount += 1;
      return ref(`${nodePath}/res-new-${pushCount}`);
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
    transaction: async (updater) => {
      const prev = txTails.get(nodePath) || Promise.resolve();
      let release;
      const gate = new Promise((resolve) => {
        release = resolve;
      });
      txTails.set(
        nodePath,
        prev.then(() => gate)
      );
      await prev;
      try {
        await Promise.resolve();
        const current = get(nodePath);
        const next = updater(current == null ? null : structuredClone(current));
        if (next === undefined) return { committed: false, snapshot: snapshot(current) };
        set(nodePath, next);
        return { committed: true, snapshot: snapshot(get(nodePath)) };
      } finally {
        release();
      }
    },
  });

  return { ref, read: (nodePath) => structuredClone(get(nodePath)) };
}

function adminFor(db) {
  return { database: () => db };
}

function seed({ capacity = 10 } = {}) {
  return {
    users: {
      p1: { role: "parent", status: "active", email: "p1@example.com" },
      p2: { role: "parent", status: "active", email: "p2@example.com" },
      sec1: { role: "secretary", status: "active", assignedBranchId: "angeles" },
    },
    schedules: {
      [SCHEDULE_ID]: {
        status: "published",
        clinicDate: CLINIC_DATE,
        branch: "Angeles",
        branchId: "angeles",
        openingTime: "09:00",
        closingTime: "17:00",
        queueStatus: "active",
        slotCapacity: capacity,
      },
    },
    reservations: {},
  };
}

async function claimParent(db, uid) {
  return claimReservationSlot({
    admin: adminFor(db),
    callerUid: uid,
    payload: { scheduleId: SCHEDULE_ID, mode: "parent" },
  });
}

async function claimWalkIn(db, secretaryUid = "sec1") {
  return claimReservationSlot({
    admin: adminFor(db),
    callerUid: secretaryUid,
    payload: {
      mode: "walk_in",
      scheduleId: SCHEDULE_ID,
      children: [{ childName: "Walk In Child", birthdate: "2020-01-15", sex: "Female" }],
      concern: "",
    },
  });
}

/**
 * Mirrors checkInReservation: status-path CAS then field patch.
 * Shared by QR and manual entry in production (both call checkInReservation).
 */
async function checkInById(db, reservationId, secretaryUid = "sec1") {
  const row = db.read(`reservations/${reservationId}`);
  if (!row) throw new Error("Reservation not found.");
  const gate = assertCanCheckIn(row);
  if (!gate.ok) throw new Error(gate.message);

  const statusRef = db.ref(`reservations/${reservationId}/status`);
  let abortMessage = null;
  const statusResult = await statusRef.transaction((currentStatus) => {
    if (currentStatus == null) {
      abortMessage = "Reservation not found.";
      return;
    }
    const transition = applyCheckInStatusTransition(currentStatus);
    if (!transition.ok) {
      abortMessage = transition.message;
      return;
    }
    return transition.nextStatus;
  });
  if (!statusResult.committed) {
    throw new Error(abortMessage || "Temporary error updating this reservation. Please try again.");
  }

  const now = Date.now();
  await db.ref(`reservations/${reservationId}`).update({
    checkedIn: true,
    checkedInAt: now,
    checkedInBy: secretaryUid,
    penaltyTimerExpiresAt: null,
    penaltyTimerStartedAt: null,
    becameCurrentTurnAt: null,
    penaltyTimerClearedAt: now,
  });
  return db.read(`reservations/${reservationId}`);
}

/** Simulate queue recalc child writes that race with whole-node check-in transactions. */
async function simulateQueueRecalcTouch(db, reservationId, queueOrder) {
  await db.ref(`reservations/${reservationId}`).update({
    queueOrder,
    queuePosition: queueOrder,
    aheadOfYou: Math.max(0, queueOrder - 1),
    queueState: "WAITING",
  });
}

describe("check-in after walk-in", () => {
  it("checks in a parent reservation after one walk-in was added first", async () => {
    const db = createMemoryDb(seed());
    const parent = await claimParent(db, "p1");
    const beforeWalkIn = structuredClone(db.read(`reservations/${parent.reservationId}`));

    const walkIn = await claimWalkIn(db);
    await simulateQueueRecalcTouch(db, parent.reservationId, 1);
    await simulateQueueRecalcTouch(db, walkIn.reservationId, 2);

    const afterWalkIn = db.read(`reservations/${parent.reservationId}`);
    assert.equal(afterWalkIn.status, beforeWalkIn.status);
    assert.equal(afterWalkIn.reservationCode, beforeWalkIn.reservationCode);
    assert.equal(afterWalkIn.queueNumber, beforeWalkIn.queueNumber);
    assert.equal(afterWalkIn.checkedIn, false);

    // Manual-code and QR both use this shared check-in-by-id path.
    const checkedIn = await checkInById(db, parent.reservationId);
    assert.equal(checkedIn.status, "checked_in");
    assert.equal(checkedIn.checkedIn, true);
    assert.equal(checkedIn.checkedInBy, "sec1");
    assert.equal(checkedIn.queueNumber, beforeWalkIn.queueNumber);

    const walkInRow = db.read(`reservations/${walkIn.reservationId}`);
    assert.equal(walkInRow.status, "checked_in");
    assert.equal(walkInRow.source, "walk_in");
  });

  it("checks in a parent reservation after several walk-ins were added", async () => {
    const db = createMemoryDb(seed({ capacity: 10 }));
    const parent = await claimParent(db, "p1");
    const walkIns = [];
    for (let i = 0; i < 3; i += 1) {
      walkIns.push(await claimWalkIn(db));
    }
    await simulateQueueRecalcTouch(db, parent.reservationId, 1);

    const checkedIn = await checkInById(db, parent.reservationId);
    assert.equal(checkedIn.status, "checked_in");
    assert.equal(checkedIn.checkedIn, true);

    for (const walkIn of walkIns) {
      const row = db.read(`reservations/${walkIn.reservationId}`);
      assert.equal(row.status, "checked_in");
      assert.notEqual(row.queueNumber, checkedIn.queueNumber);
    }
  });

  it("walk-in creation does not modify existing reservation records", async () => {
    const db = createMemoryDb(seed());
    const parent = await claimParent(db, "p1");
    const snapshot = structuredClone(db.read(`reservations/${parent.reservationId}`));

    await claimWalkIn(db);

    const after = db.read(`reservations/${parent.reservationId}`);
    assert.deepEqual(
      {
        status: after.status,
        reservationCode: after.reservationCode,
        queueNumber: after.queueNumber,
        originalQueueNumber: after.originalQueueNumber,
        parentId: after.parentId,
        checkedIn: after.checkedIn,
        scheduleId: after.scheduleId,
      },
      {
        status: snapshot.status,
        reservationCode: snapshot.reservationCode,
        queueNumber: snapshot.queueNumber,
        originalQueueNumber: snapshot.originalQueueNumber,
        parentId: snapshot.parentId,
        checkedIn: snapshot.checkedIn,
        scheduleId: snapshot.scheduleId,
      }
    );
  });

  it("truly checked-in reservation returns already checked in and creates no duplicate fields", async () => {
    const db = createMemoryDb(seed());
    const parent = await claimParent(db, "p1");
    await checkInById(db, parent.reservationId);
    const first = db.read(`reservations/${parent.reservationId}`);

    await assert.rejects(
      () => checkInById(db, parent.reservationId),
      (err) => /already checked in/i.test(err.message)
    );

    const second = db.read(`reservations/${parent.reservationId}`);
    assert.equal(second.status, "checked_in");
    assert.equal(second.checkedInAt, first.checkedInAt);
    assert.equal(second.checkedInBy, first.checkedInBy);
  });

  it("double-submit only one status transition wins", async () => {
    const db = createMemoryDb(seed());
    const parent = await claimParent(db, "p1");

    const results = await Promise.allSettled([
      checkInById(db, parent.reservationId, "sec1"),
      checkInById(db, parent.reservationId, "sec1"),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    assert.equal(fulfilled.length, 1);
    assert.equal(rejected.length, 1);
    assert.match(rejected[0].reason.message, /already checked in/i);

    const row = db.read(`reservations/${parent.reservationId}`);
    assert.equal(row.status, "checked_in");
    assert.equal(row.checkedIn, true);
  });

  it("each failure case returns its own message, not the generic catch-all", () => {
    const generic = "This reservation cannot be checked in (it may already be checked in).";
    const cases = [
      { status: "checked_in", pattern: /already checked in/i },
      { status: "forfeited", pattern: /forfeited/i },
      { status: "cancelled", pattern: /cancelled/i },
      { status: "expired", pattern: /expired/i },
      { status: "with_doctor", pattern: /with the doctor/i },
      { status: "consultation_completed", pattern: /completed/i },
    ];
    for (const { status, pattern } of cases) {
      const result = assertCanCheckIn({ status });
      assert.equal(result.ok, false);
      assert.match(result.message, pattern);
      assert.notEqual(result.message, generic);
    }
  });

  it("queue numbers of walk-ins and reservations never collide", async () => {
    const db = createMemoryDb(seed({ capacity: 8 }));
    const parentA = await claimParent(db, "p1");
    const walkIn1 = await claimWalkIn(db);
    const parentB = await claimParent(db, "p2");
    const walkIn2 = await claimWalkIn(db);

    const numbers = [
      db.read(`reservations/${parentA.reservationId}`).queueNumber,
      db.read(`reservations/${walkIn1.reservationId}`).queueNumber,
      db.read(`reservations/${parentB.reservationId}`).queueNumber,
      db.read(`reservations/${walkIn2.reservationId}`).queueNumber,
    ];
    assert.equal(new Set(numbers).size, numbers.length);
    assert.deepEqual(numbers, [1, 2, 3, 4]);
  });
});
