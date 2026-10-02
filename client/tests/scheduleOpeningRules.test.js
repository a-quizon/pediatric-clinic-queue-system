import assert from "node:assert/strict";
import path from "node:path";
import { describe, it } from "node:test";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import * as clientRules from "../src/utils/scheduleOpeningRules.js";

const functionsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../functions");
const requireFromFunctions = createRequire(path.join(functionsDir, "package.json"));
const serverRules = requireFromFunctions("./scheduleOpeningRules.js");

// Tuesday, Oct. 6, 2026 (Asia/Manila).
const TODAY = "2026-10-06";
const YESTERDAY = "2026-10-05";
const NEXT_WEEK = "2026-10-13";
const SUNDAY = "2026-10-11";

const at = (hour, minute = 0) => hour * 60 + minute;

const closedDay = { isOpen: false, openingTime: "", closingTime: "" };
const MAGALANG = {
  id: "magalang",
  name: "Magalang",
  schedule: {
    sunday: closedDay,
    monday: { isOpen: true, openingTime: "14:00", closingTime: "17:00" },
    tuesday: { isOpen: true, openingTime: "09:00", closingTime: "12:00" },
    wednesday: { isOpen: true, openingTime: "14:00", closingTime: "17:00" },
    thursday: { isOpen: true, openingTime: "09:00", closingTime: "12:00" },
    friday: { isOpen: true, openingTime: "14:00", closingTime: "17:00" },
    saturday: { isOpen: true, openingTime: "09:00", closingTime: "12:00" },
  },
};
const ANGELES = {
  id: "angeles",
  name: "Angeles",
  schedule: {
    sunday: closedDay,
    saturday: closedDay,
    monday: { isOpen: true, openingTime: "09:00", closingTime: "12:00" },
    tuesday: { isOpen: true, openingTime: "15:00", closingTime: "17:00" },
    wednesday: { isOpen: true, openingTime: "09:00", closingTime: "12:00" },
    thursday: { isOpen: true, openingTime: "15:00", closingTime: "17:00" },
    friday: { isOpen: true, openingTime: "09:00", closingTime: "12:00" },
  },
};
const SPLIT = {
  id: "split",
  name: "Split Branch",
  schedule: {
    tuesday: {
      isOpen: true,
      openingTime: "09:00",
      closingTime: "11:00",
      sessions: [
        { openingTime: "14:00", closingTime: "17:00" },
        { openingTime: "09:00", closingTime: "11:00" },
      ],
    },
  },
};

const IMPLEMENTATIONS = [
  ["functions (authoritative)", serverRules],
  ["client mirror", clientRules],
];

for (const [label, rules] of IMPLEMENTATIONS) {
  const check = (dateStr, branch, nowMinutes, extra = {}) =>
    rules.checkScheduleOpening({ dateStr, branch, today: TODAY, nowMinutes, ...extra });

  describe(`checkScheduleOpening — ${label}`, () => {
    it("rejects yesterday", () => {
      const result = check(YESTERDAY, MAGALANG, at(8));
      assert.equal(result.ok, false);
      assert.equal(result.code, "past_date");
      assert.equal(result.message, "You cannot open a reservation for a past date.");
    });

    it("allows today before closing time", () => {
      const result = check(TODAY, MAGALANG, at(11, 30));
      assert.equal(result.ok, true);
      assert.deepEqual(result.hours, { openingTime: "09:00", closingTime: "12:00" });
    });

    it("allows today before the clinic opens", () => {
      assert.equal(check(TODAY, MAGALANG, at(7)).ok, true);
    });

    it("rejects today at 12:01 PM after Magalang closes at 12:00 PM", () => {
      const result = check(TODAY, MAGALANG, at(12, 1));
      assert.equal(result.ok, false);
      assert.equal(result.code, "after_hours");
      assert.equal(
        result.message,
        "You cannot open a reservation because today's clinic hours at Magalang have already ended (9:00 AM to 12:00 PM)."
      );
    });

    it("rejects today exactly at closing time (matches parent booking)", () => {
      assert.equal(check(TODAY, MAGALANG, at(12)).code, "after_hours");
      assert.equal(check(TODAY, MAGALANG, at(11, 59)).ok, true);
    });

    it("allows a future date even after today's closing time", () => {
      assert.equal(check(NEXT_WEEK, MAGALANG, at(23, 59)).ok, true);
    });

    it("reads hours per location: Angeles is still open at 12:01 PM on the same Tuesday", () => {
      assert.equal(check(TODAY, ANGELES, at(12, 1)).ok, true);
      const late = check(TODAY, ANGELES, at(17, 0));
      assert.equal(late.code, "after_hours");
      assert.match(late.message, /Angeles have already ended \(3:00 PM to 5:00 PM\)/);
    });

    it("rejects a weekday the branch is closed", () => {
      const result = check(SUNDAY, MAGALANG, at(8));
      assert.equal(result.code, "weekday_closed");
      assert.equal(result.message, "The Magalang clinic is closed on Sundays.");
    });

    it("uses the last closing time when a day has multiple sessions", () => {
      assert.deepEqual(rules.clinicHoursForDate(SPLIT, TODAY), { openingTime: "09:00", closingTime: "17:00" });
      assert.equal(check(TODAY, SPLIT, at(12)).ok, true);
      assert.equal(check(TODAY, SPLIT, at(17)).code, "after_hours");
    });

    it("rejects closures, existing schedules, and dates past the booking window", () => {
      const closures = [{ branchId: "magalang", branch: "Magalang", startDate: NEXT_WEEK, endDate: NEXT_WEEK }];
      assert.equal(check(NEXT_WEEK, MAGALANG, at(8), { closures }).code, "closure");
      const schedules = [{ branchId: "magalang", branch: "Magalang", clinicDate: NEXT_WEEK }];
      assert.equal(check(NEXT_WEEK, MAGALANG, at(8), { schedules }).code, "exists");
      assert.equal(check(NEXT_WEEK, ANGELES, at(8), { schedules }).ok, true);
      assert.equal(check("2026-12-31", MAGALANG, at(8)).code, "beyond_window");
    });
  });
}

describe("client mirror parity", () => {
  it("matches the authoritative helper across dates, branches, and times", () => {
    const dates = [YESTERDAY, TODAY, NEXT_WEEK, SUNDAY, "2026-12-31"];
    const times = [at(7), at(11, 59), at(12), at(12, 1), at(16, 59), at(17)];
    for (const branch of [MAGALANG, ANGELES, SPLIT]) {
      for (const dateStr of dates) {
        for (const nowMinutes of times) {
          const input = { dateStr, branch, today: TODAY, nowMinutes };
          const server = serverRules.checkScheduleOpening(input);
          const client = clientRules.checkScheduleOpening(input);
          assert.equal(client.code, server.code, `${branch.name} ${dateStr} ${nowMinutes}`);
          assert.equal(client.message, server.message, `${branch.name} ${dateStr} ${nowMinutes}`);
        }
      }
    }
  });
});
