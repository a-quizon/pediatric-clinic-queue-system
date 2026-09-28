import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  schedulesStartable,
  groupStartableByDate,
  scheduleCanStart,
  isStartBeforeHours,
} from "../src/utils/scheduleCalendar.js";
import { scheduleMatchesAssignedBranch } from "../src/utils/stringUtils.js";

const TODAY = "2026-09-28";
const TOMORROW = "2026-09-29";

function schedule(id, overrides = {}) {
  return {
    id,
    status: "published",
    clinicDate: TODAY,
    branch: "Angeles",
    branchId: "angeles",
    openingTime: "09:00",
    closingTime: "17:00",
    queueStatus: "not_started",
    slotCapacity: 10,
    ...overrides,
  };
}

describe("early start", () => {
  it("allows today's session before opening time (no clock gate)", () => {
    assert.equal(scheduleCanStart(schedule("a"), TODAY), true);
    assert.equal(isStartBeforeHours(schedule("a"), TODAY, 7 * 60), true);
    assert.equal(isStartBeforeHours(schedule("a"), TODAY, 10 * 60), false);
  });

  it("allows a future date's session to be started now", () => {
    const upcoming = schedule("b", { clinicDate: TOMORROW });
    assert.equal(scheduleCanStart(upcoming, TODAY), true);
    assert.equal(isStartBeforeHours(upcoming, TODAY, 23 * 60), true);
  });

  it("rejects past, draft, closed, already-started, and ended sessions", () => {
    assert.equal(scheduleCanStart(schedule("p", { clinicDate: "2026-09-27" }), TODAY), false);
    assert.equal(scheduleCanStart(schedule("d", { status: "draft" }), TODAY), false);
    assert.equal(scheduleCanStart(schedule("c", { dayClosed: true }), TODAY), false);
    assert.equal(scheduleCanStart(schedule("s", { queueStatus: "active" }), TODAY), false);
    assert.equal(scheduleCanStart(schedule("e", { queueStatus: "ended" }), TODAY), false);
    assert.equal(scheduleCanStart(schedule("x", { queueStatus: "completed" }), TODAY), false);
  });
});

describe("upcoming-session display", () => {
  it("shows tomorrow's session once today's sessions are all completed", () => {
    const list = [
      schedule("today-angeles", { queueStatus: "completed" }),
      schedule("today-mabalacat", { branch: "Mabalacat", branchId: "mabalacat", queueStatus: "completed" }),
      schedule("tomorrow-angeles", { clinicDate: TOMORROW }),
    ];
    const startable = schedulesStartable(list, TODAY);
    assert.deepEqual(startable.map((item) => item.id), ["tomorrow-angeles"]);
    assert.equal(groupStartableByDate(startable).defaultDate, TOMORROW);
  });

  it("defaults to the nearest date and lets later dates be picked", () => {
    const list = [
      schedule("oct-02", { clinicDate: "2026-10-02" }),
      schedule("sep-30", { clinicDate: "2026-09-30" }),
      schedule("sep-30-early", { clinicDate: "2026-09-30", branch: "Mabalacat", branchId: "mabalacat", openingTime: "08:00" }),
    ];
    const grouped = groupStartableByDate(schedulesStartable(list, TODAY));
    assert.deepEqual(grouped.dates, ["2026-09-30", "2026-10-02"]);
    assert.equal(grouped.defaultDate, "2026-09-30");
    assert.deepEqual(grouped.byDate["2026-09-30"].map((item) => item.id), ["sep-30-early", "sep-30"]);
  });

  it("prefers today's pending session over upcoming ones", () => {
    const list = [schedule("tomorrow", { clinicDate: TOMORROW }), schedule("today")];
    assert.equal(groupStartableByDate(schedulesStartable(list, TODAY)).defaultDate, TODAY);
  });

  it("offers nothing while any queue is live", () => {
    const list = [
      schedule("live", { queueStatus: "paused" }),
      schedule("tomorrow", { clinicDate: TOMORROW }),
    ];
    assert.deepEqual(schedulesStartable(list, TODAY), []);
  });

  it("returns an empty list when nothing is published", () => {
    const grouped = groupStartableByDate(schedulesStartable([schedule("draft", { status: "draft" })], TODAY));
    assert.deepEqual(grouped.dates, []);
    assert.equal(grouped.defaultDate, null);
  });

  it("respects the secretary's assigned branch", () => {
    const secretary = { role: "secretary", assignedBranchId: "mabalacat", assignedBranch: "Mabalacat" };
    const list = [
      schedule("angeles", { clinicDate: TOMORROW }),
      schedule("mabalacat", { clinicDate: "2026-09-30", branch: "Mabalacat", branchId: "mabalacat" }),
    ];
    const mine = schedulesStartable(list, TODAY).filter((item) => scheduleMatchesAssignedBranch(item, secretary));
    assert.deepEqual(mine.map((item) => item.id), ["mabalacat"]);
  });
});
