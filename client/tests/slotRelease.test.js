import assert from "node:assert/strict";
import path from "node:path";
import { describe, it } from "node:test";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { slotsTaken, parentCellKind } from "../src/utils/scheduleCalendar.js";

const functionsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../functions");
const requireFromFunctions = createRequire(path.join(functionsDir, "package.json"));
const { claimReservationSlot } = requireFromFunctions("./claimReservationRuntime.js");
const { releaseReservationSlot, releaseSlotIfTerminal } = requireFromFunctions("./slotRelease.js");
const { applyClaim, applyRelease } = requireFromFunctions("./bookingHolders.js");
const { manilaDateString, addManilaDays } = requireFromFunctions("./manilaDate.js");

const CLINIC_DATE = addManilaDays(manilaDateString(), 1);
const SCHEDULE_ID = "sched-1";

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

function parentUser(id) {
  return { role: "parent", status: "active", email: `${id}@example.com` };
}

function seed({ capacity = 2, reservations = {}, booking, locks, caps } = {}) {
  const users = {};
  ["p1", "p2", "p3", "p4"].forEach((id) => {
    users[id] = parentUser(id);
  });
  return {
    users,
    schedules: {
      [SCHEDULE_ID]: {
        status: "published",
        clinicDate: CLINIC_DATE,
        branch: "Angeles",
        branchId: "angeles",
        openingTime: "09:00",
        closingTime: "17:00",
        queueStatus: "not_started",
        slotCapacity: capacity,
        ...(booking ? { booking } : {}),
      },
    },
    reservations,
    ...(locks ? { bookingLocks: locks } : {}),
    ...(caps ? { parentBookingCaps: caps } : {}),
  };
}

function adminFor(db) {
  return { database: () => db };
}

async function claim(db, uid) {
  return claimReservationSlot({ admin: adminFor(db), callerUid: uid, payload: { scheduleId: SCHEDULE_ID } });
}

async function setStatus(db, reservationId, status) {
  await db.ref(`reservations/${reservationId}/status`).set(status);
  return { id: reservationId, ...db.read(`reservations/${reservationId}`) };
}

describe("slot release after cancel and forfeit", () => {
  it("cancel frees the slot and a second release is a no-op", async () => {
    const db = createMemoryDb(seed({ capacity: 2 }));
    const first = await claim(db, "p1");
    await claim(db, "p2");
    assert.equal(db.read(`schedules/${SCHEDULE_ID}/booking/activeSlotCount`), 2);

    const cancelled = await setStatus(db, first.reservationId, "cancelled");
    await releaseReservationSlot(db, first.reservationId, cancelled);
    await releaseReservationSlot(db, first.reservationId, cancelled);

    const booking = db.read(`schedules/${SCHEDULE_ID}/booking`);
    assert.equal(booking.activeSlotCount, 1);
    assert.equal(booking.holders[first.reservationId], undefined);
  });

  it("a full date becomes bookable again after a forfeit", async () => {
    const db = createMemoryDb(seed({ capacity: 2 }));
    const first = await claim(db, "p1");
    await claim(db, "p2");
    await assert.rejects(() => claim(db, "p3"), /already full/);

    const forfeited = await setStatus(db, first.reservationId, "forfeited");
    await releaseSlotIfTerminal(adminFor(db), { status: "reserved" }, forfeited);

    const third = await claim(db, "p3");
    assert.ok(third.reservationId);
    assert.equal(db.read(`schedules/${SCHEDULE_ID}/booking/activeSlotCount`), 2);
  });

  it("self-heals on the next claim when the release event was missed", async () => {
    const db = createMemoryDb(seed({ capacity: 2 }));
    const first = await claim(db, "p1");
    await claim(db, "p2");
    await setStatus(db, first.reservationId, "cancelled");

    const third = await claim(db, "p3");
    assert.ok(third.reservationId);
    const booking = db.read(`schedules/${SCHEDULE_ID}/booking`);
    assert.equal(booking.activeSlotCount, 2);
    assert.equal(booking.holders[first.reservationId], undefined);
  });

  it("gives one freed slot to exactly one of two concurrent parents", async () => {
    const db = createMemoryDb(seed({ capacity: 1 }));
    const first = await claim(db, "p1");
    const cancelled = await setStatus(db, first.reservationId, "cancelled");
    await releaseReservationSlot(db, first.reservationId, cancelled);

    const results = await Promise.allSettled([claim(db, "p2"), claim(db, "p3")]);
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    assert.equal(results.filter((r) => r.status === "rejected").length, 1);
    assert.equal(db.read(`schedules/${SCHEDULE_ID}/booking/activeSlotCount`), 1);
  });

  it("lets the parent who cancelled book again even if the stale lock and cap stayed behind", async () => {
    const db = createMemoryDb(seed({ capacity: 2 }));
    const first = await claim(db, "p1");
    await setStatus(db, first.reservationId, "cancelled");
    // Simulate a missed release: lock and cap still point at the cancelled booking, and are old.
    await db.ref(`bookingLocks/p1/${CLINIC_DATE}`).set({ scheduleId: SCHEDULE_ID, at: 1 });
    await db.ref("parentBookingCaps/p1").set({
      dates: { [CLINIC_DATE]: SCHEDULE_ID, "2099-01-01": "other" },
      updatedAt: 1,
    });

    const again = await claim(db, "p1");
    assert.ok(again.reservationId);
    assert.notEqual(again.reservationId, first.reservationId);
    assert.equal(db.read(`reservations/${first.reservationId}/status`), "cancelled");
    assert.equal(db.read("parentBookingCaps/p1/dates/2099-01-01"), undefined);
  });

  it("still blocks a same-parent double claim for the same date", async () => {
    const db = createMemoryDb(seed({ capacity: 5 }));
    const results = await Promise.allSettled([claim(db, "p1"), claim(db, "p1")]);
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  });

  it("migrates a legacy counter that leaked a slot", async () => {
    const db = createMemoryDb(
      seed({
        capacity: 2,
        booking: { activeSlotCount: 2, nextQueueNumber: 3 },
        reservations: {
          old1: { scheduleId: SCHEDULE_ID, parentId: "p1", status: "cancelled", queueNumber: 1, slotReleased: true },
          old2: { scheduleId: SCHEDULE_ID, parentId: "p2", status: "reserved", queueNumber: 2 },
        },
      })
    );
    const result = await claim(db, "p3");
    assert.equal(result.queueNumber, 3);
    const booking = db.read(`schedules/${SCHEDULE_ID}/booking`);
    assert.equal(booking.holdersTracked, true);
    assert.deepEqual(Object.keys(booking.holders).sort(), ["old2", result.reservationId].sort());
    assert.equal(booking.activeSlotCount, 2);
  });
});

describe("booking holder updaters", () => {
  it("never exceeds capacity", () => {
    const base = { holdersTracked: true, holders: { a: 1, b: 1 }, activeSlotCount: 2, nextQueueNumber: 3 };
    const next = applyClaim(base, {
      reservationId: "c",
      capacity: 2,
      activeIds: new Set(["a", "b"]),
      terminalIds: new Set(),
      knownIds: new Set(["a", "b"]),
      now: 10,
    });
    assert.equal(next, undefined);
  });

  it("release of an unknown id leaves the booking unchanged", () => {
    const base = { holdersTracked: true, holders: { a: 1 }, activeSlotCount: 1, nextQueueNumber: 2 };
    assert.deepEqual(applyRelease(base, "zzz"), base);
  });
});

describe("availability display", () => {
  const schedule = {
    id: SCHEDULE_ID,
    status: "published",
    slotCapacity: 2,
    booking: { activeSlotCount: 2, nextQueueNumber: 3 },
  };

  it("uses the live active count over a stale counter", () => {
    const reservations = [
      { scheduleId: SCHEDULE_ID, status: "reserved" },
      { scheduleId: SCHEDULE_ID, status: "cancelled" },
    ];
    assert.equal(slotsTaken(schedule, reservations), 1);
    assert.equal(slotsTaken(schedule, null, 1), 1);
    assert.equal(slotsTaken(schedule), 2);
  });

  it("turns a fully booked date back to available once a slot is freed", () => {
    const cell = (taken) =>
      parentCellKind({
        dateStr: "2026-10-01",
        today: "2026-09-28",
        horizonEnd: "2026-11-27",
        schedule,
        closure: null,
        taken,
        owned: false,
      });
    assert.equal(cell(slotsTaken(schedule, null, 2)), "full");
    assert.equal(cell(slotsTaken(schedule, null, 1)), "available");
  });
});
