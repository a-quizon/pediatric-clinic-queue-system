import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { claimParentDateCap, releaseParentDateCap, MULTI_DATE_CAP } = require("../functions/parentBookingCap.js");

function createFakeDb(initial = {}) {
  const store = { ...initial };
  return {
    _store: store,
    ref(path) {
      return {
        async transaction(updater) {
          const current = store[path] === undefined ? null : structuredClone(store[path]);
          const next = updater(current);
          if (next === undefined) {
            return { committed: false, snapshot: { val: () => current } };
          }
          store[path] = next;
          return { committed: true, snapshot: { val: () => next } };
        },
      };
    },
  };
}

describe("H2 parentBookingCaps", () => {
  it("allows up to MULTI_DATE_CAP distinct dates", async () => {
    const db = createFakeDb();
    const first = await claimParentDateCap(db, "p1", "2026-10-01", "s1");
    const second = await claimParentDateCap(db, "p1", "2026-10-02", "s2");
    assert.ok(first);
    assert.ok(second);
    assert.equal(Object.keys(db._store["parentBookingCaps/p1"].dates).length, MULTI_DATE_CAP);
  });

  it("rejects a third distinct date atomically", async () => {
    const db = createFakeDb({
      "parentBookingCaps/p1": {
        dates: { "2026-10-01": "s1", "2026-10-02": "s2" },
        updatedAt: 1,
      },
    });
    const third = await claimParentDateCap(db, "p1", "2026-10-03", "s3");
    assert.equal(third, null);
  });

  it("releases a date so another can be claimed", async () => {
    const db = createFakeDb({
      "parentBookingCaps/p1": {
        dates: { "2026-10-01": "s1", "2026-10-02": "s2" },
        updatedAt: 1,
      },
    });
    await releaseParentDateCap(db, "p1", "2026-10-01");
    const again = await claimParentDateCap(db, "p1", "2026-10-03", "s3");
    assert.ok(again);
    assert.equal(db._store["parentBookingCaps/p1"].dates["2026-10-03"], "s3");
    assert.equal(db._store["parentBookingCaps/p1"].dates["2026-10-01"], undefined);
  });
});
