import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  formatClinicDateLabel,
  secretaryMatchesBranch,
  listActiveSecretaryIdsForBranch,
  secretaryEventsFromReservationChange,
} = require("../functions/secretarySlotNotificationRules.js");

describe("formatClinicDateLabel", () => {
  it("formats YYYY-MM-DD for Manila display", () => {
    const label = formatClinicDateLabel("2026-10-28");
    assert.match(label, /October/);
    assert.match(label, /28/);
    assert.match(label, /2026/);
  });

  it("falls back when date missing", () => {
    assert.equal(formatClinicDateLabel(null), "an upcoming clinic day");
  });
});

describe("secretaryMatchesBranch / listActiveSecretaryIdsForBranch", () => {
  const users = {
    secA: {
      role: "secretary",
      status: "active",
      assignedBranchId: "branch-angeles",
      assignedBranch: "Angeles",
    },
    secB: {
      role: "secretary",
      status: "active",
      assignedBranchId: "branch-mabalacat",
      assignedBranch: "Mabalacat",
    },
    secInactive: {
      role: "secretary",
      status: "inactive",
      assignedBranchId: "branch-angeles",
      assignedBranch: "Angeles",
    },
    parent1: {
      role: "parent",
      status: "active",
      assignedBranchId: "branch-angeles",
    },
  };

  it("matches by assignedBranchId", () => {
    assert.equal(
      secretaryMatchesBranch(users.secA, { branchId: "branch-angeles", branch: "Angeles" }),
      true
    );
    assert.equal(
      secretaryMatchesBranch(users.secB, { branchId: "branch-angeles", branch: "Angeles" }),
      false
    );
  });

  it("matches by normalized branch name when ids missing", () => {
    assert.equal(
      secretaryMatchesBranch(
        { role: "secretary", status: "active", assignedBranch: "Angeles Branch" },
        { branchId: null, branch: "Angeles" }
      ),
      true
    );
  });

  it("lists only active secretaries for the reservation branch", () => {
    assert.deepEqual(
      listActiveSecretaryIdsForBranch(users, {
        branchId: "branch-angeles",
        branch: "Angeles",
      }),
      ["secA"]
    );
  });
});

describe("secretaryEventsFromReservationChange", () => {
  const base = {
    id: "res1",
    parentId: "parent1",
    clinicDate: "2026-11-05",
    branchId: "branch-angeles",
    branch: "Angeles",
    scheduleId: "sched1",
    status: "reserved",
  };

  it("emits SECRETARY_SLOT_RESERVED on create with parentId", () => {
    const events = secretaryEventsFromReservationChange(null, base);
    assert.equal(events.length, 1);
    assert.equal(events[0].eventId, "SECRETARY_SLOT_RESERVED");
    assert.equal(events[0].dedupeKey, "sec_reserved_res1");
    assert.match(events[0].customMessage, /A parent reserved a slot on/);
    assert.match(events[0].customMessage, /November/);
  });

  it("skips create without parentId (walk-in)", () => {
    assert.deepEqual(
      secretaryEventsFromReservationChange(null, { ...base, parentId: null }),
      []
    );
  });

  it("emits SECRETARY_SLOT_CANCELLED on parent cancel", () => {
    const events = secretaryEventsFromReservationChange(base, {
      ...base,
      status: "cancelled",
      cancelledAt: 123,
    });
    assert.equal(events.length, 1);
    assert.equal(events[0].eventId, "SECRETARY_SLOT_CANCELLED");
    assert.equal(events[0].dedupeKey, "sec_cancelled_res1");
    assert.match(events[0].customMessage, /A parent cancelled their slot on/);
  });

  it("ignores cancelled_by_clinic and unrelated status changes", () => {
    assert.deepEqual(
      secretaryEventsFromReservationChange(base, {
        ...base,
        status: "cancelled_by_clinic",
      }),
      []
    );
    assert.deepEqual(
      secretaryEventsFromReservationChange(base, {
        ...base,
        status: "checked_in",
      }),
      []
    );
  });

  it("does not re-emit reserve on later updates", () => {
    assert.deepEqual(
      secretaryEventsFromReservationChange(
        { ...base, patientInfoCompleted: false },
        { ...base, patientInfoCompleted: true }
      ),
      []
    );
  });
});
