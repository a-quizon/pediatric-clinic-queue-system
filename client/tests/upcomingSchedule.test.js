import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { pickUpcomingPublishedSchedule } from "../src/utils/upcomingSchedule.js";

// Tuesday, Oct. 6, 2026 (Asia/Manila). Times are minutes since Manila midnight.
const YESTERDAY = "2026-10-05";
const TODAY = "2026-10-06";
const WEDNESDAY = "2026-10-07";
const THURSDAY = "2026-10-08";

const at = (hour, minute = 0) => hour * 60 + minute;
const closedDay = { isOpen: false, openingTime: "", closingTime: "" };

const MAGALANG = {
  id: "magalang",
  name: "Magalang",
  schedule: {
    tuesday: { isOpen: true, openingTime: "09:00", closingTime: "12:00" },
    wednesday: closedDay,
    thursday: { isOpen: true, openingTime: "09:00", closingTime: "12:00" },
  },
};
const ANGELES = {
  id: "angeles",
  name: "Angeles",
  schedule: {
    tuesday: { isOpen: true, openingTime: "15:00", closingTime: "17:00" },
    wednesday: { isOpen: true, openingTime: "09:00", closingTime: "12:00" },
  },
};
const SPLIT = {
  id: "split",
  name: "Split",
  schedule: {
    tuesday: {
      isOpen: true,
      openingTime: "09:00",
      closingTime: "17:00",
      sessions: [
        { openingTime: "14:00", closingTime: "17:00" },
        { openingTime: "09:00", closingTime: "11:00" },
      ],
    },
    wednesday: { isOpen: true, openingTime: "09:00", closingTime: "12:00" },
  },
};

const SEC_MAGALANG = { role: "secretary", assignedBranchId: "magalang", assignedBranch: "Magalang" };
const SEC_ANGELES = { role: "secretary", assignedBranchId: "angeles", assignedBranch: "Angeles" };
const SEC_SPLIT = { role: "secretary", assignedBranchId: "split", assignedBranch: "Split" };

function schedule(id, branch, clinicDate, overrides = {}) {
  const day = branch.schedule[["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"][
    new Date(`${clinicDate}T12:00:00+08:00`).getUTCDay()
  ]];
  return {
    id,
    branch: branch.name,
    branchId: branch.id,
    clinicDate,
    openingTime: day?.openingTime || "09:00",
    closingTime: day?.closingTime || "12:00",
    status: "published",
    queueStatus: "not_started",
    ...overrides,
  };
}

const pick = (schedules, user, branch, nowMinutes) =>
  pickUpcomingPublishedSchedule({ schedules, user, branch, today: TODAY, nowMinutes });

describe("pickUpcomingPublishedSchedule", () => {
  const magalang = [
    schedule("mag-thu", MAGALANG, THURSDAY),
    schedule("mag-today", MAGALANG, TODAY),
  ];

  it("shows today's session while it is upcoming or ongoing", () => {
    assert.equal(pick(magalang, SEC_MAGALANG, MAGALANG, at(7)).schedule.id, "mag-today");
    assert.equal(pick(magalang, SEC_MAGALANG, MAGALANG, at(11, 59)).schedule.id, "mag-today");
  });

  it("shows the next published date once today's session has ended, skipping unpublished days", () => {
    const result = pick(magalang, SEC_MAGALANG, MAGALANG, at(12, 1));
    assert.equal(result.schedule.id, "mag-thu");
    assert.deepEqual(result.block, { openingTime: "09:00", closingTime: "12:00" });
  });

  it("treats the exact closing minute as ended", () => {
    assert.equal(pick(magalang, SEC_MAGALANG, MAGALANG, at(12)).schedule.id, "mag-thu");
  });

  it("shows the afternoon block when only the morning has ended", () => {
    const list = [schedule("split-today", SPLIT, TODAY), schedule("split-wed", SPLIT, WEDNESDAY)];
    const morning = pick(list, SEC_SPLIT, SPLIT, at(10));
    assert.equal(morning.schedule.id, "split-today");
    assert.deepEqual(morning.block, { openingTime: "09:00", closingTime: "11:00" });

    const between = pick(list, SEC_SPLIT, SPLIT, at(11));
    assert.equal(between.schedule.id, "split-today");
    assert.deepEqual(between.block, { openingTime: "14:00", closingTime: "17:00" });

    assert.equal(pick(list, SEC_SPLIT, SPLIT, at(17)).schedule.id, "split-wed");
  });

  it("returns null when nothing upcoming is published", () => {
    assert.equal(pick([], SEC_MAGALANG, MAGALANG, at(8)), null);
    assert.equal(pick([schedule("mag-today", MAGALANG, TODAY)], SEC_MAGALANG, MAGALANG, at(12, 30)), null);
  });

  it("keeps branches isolated and uses each branch's own hours", () => {
    const list = [
      schedule("mag-today", MAGALANG, TODAY),
      schedule("mag-thu", MAGALANG, THURSDAY),
      schedule("ang-today", ANGELES, TODAY),
      schedule("ang-wed", ANGELES, WEDNESDAY),
    ];
    assert.equal(pick(list, SEC_MAGALANG, MAGALANG, at(12, 1)).schedule.id, "mag-thu");
    assert.equal(pick(list, SEC_ANGELES, ANGELES, at(12, 1)).schedule.id, "ang-today");
    assert.equal(pick(list, SEC_ANGELES, ANGELES, at(17)).schedule.id, "ang-wed");

    const onlyOther = list.filter((item) => item.branchId === "angeles");
    assert.equal(pick(onlyOther, SEC_MAGALANG, MAGALANG, at(8)), null);
  });

  it("never shows a past published date, even with a queue left running", () => {
    const list = [
      schedule("mag-yesterday", MAGALANG, YESTERDAY),
      schedule("mag-yesterday-live", MAGALANG, YESTERDAY, { queueStatus: "active" }),
    ];
    assert.equal(pick(list, SEC_MAGALANG, MAGALANG, at(8)), null);
    const withFuture = [...list, schedule("mag-thu", MAGALANG, THURSDAY)];
    assert.equal(pick(withFuture, SEC_MAGALANG, MAGALANG, at(8)).schedule.id, "mag-thu");
  });

  it("excludes closed days, finished queues, and unpublished schedules", () => {
    const next = schedule("mag-thu", MAGALANG, THURSDAY);
    for (const overrides of [
      { dayClosed: true },
      { queueStatus: "closed" },
      { queueStatus: "ended" },
      { queueStatus: "completed" },
      { status: "draft" },
      { status: "completed" },
    ]) {
      const list = [schedule("mag-today", MAGALANG, TODAY, overrides), next];
      assert.equal(pick(list, SEC_MAGALANG, MAGALANG, at(8)).schedule.id, "mag-thu", JSON.stringify(overrides));
    }
  });

  it("skips a published day with no clinic hours", () => {
    const list = [
      schedule("mag-today", MAGALANG, TODAY, { openingTime: "", closingTime: "" }),
      schedule("mag-thu", MAGALANG, THURSDAY),
    ];
    const noHoursBranch = { ...MAGALANG, schedule: { ...MAGALANG.schedule, tuesday: closedDay } };
    assert.equal(pick(list, SEC_MAGALANG, noHoursBranch, at(8)).schedule.id, "mag-thu");
  });

  it("keeps showing today's running queue after closing time", () => {
    const list = [
      schedule("mag-today", MAGALANG, TODAY, { queueStatus: "active" }),
      schedule("mag-thu", MAGALANG, THURSDAY),
    ];
    assert.equal(pick(list, SEC_MAGALANG, MAGALANG, at(12, 30)).schedule.id, "mag-today");
    list[0].queueStatus = "paused";
    assert.equal(pick(list, SEC_MAGALANG, MAGALANG, at(12, 30)).schedule.id, "mag-today");
  });

  it("falls back to the schedule's published hours before branch config loads", () => {
    assert.equal(pick(magalang, SEC_MAGALANG, null, at(11, 59)).schedule.id, "mag-today");
    assert.equal(pick(magalang, SEC_MAGALANG, null, at(12)).schedule.id, "mag-thu");
  });
});
