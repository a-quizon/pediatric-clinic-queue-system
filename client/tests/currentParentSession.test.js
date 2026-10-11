import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  SESSION_STATUS,
  getCurrentSessionForParent,
  getSessionStatus,
  getUpcomingSessions,
} from "../src/utils/currentParentSession.js";

// Sunday, Oct. 11, 2026 (Asia/Manila). Times are minutes since Manila midnight.
const TODAY = "2026-10-11";
const OCT_10 = "2026-10-10";
const OCT_12 = "2026-10-12";
const OCT_13 = "2026-10-13";

const PARENT = "parent-1";
const ctx = { parentId: PARENT, today: TODAY, nowMinutes: 10 * 60 };

const schedule = (clinicDate, openingTime = "09:00", extra = {}) => ({
  clinicDate,
  openingTime,
  closingTime: "17:00",
  status: "published",
  queueStatus: "not_started",
  ...extra,
});

const reservation = (id, scheduleId, extra = {}) => ({
  id,
  parentId: PARENT,
  scheduleId,
  status: "reserved",
  ...extra,
});

const currentId = (reservations, schedules) =>
  getCurrentSessionForParent(reservations, schedules, ctx)?.reservation.id ?? null;

describe("getCurrentSessionForParent", () => {
  it("shows the earliest date when none are active", () => {
    const schedules = { s12: schedule(OCT_12), s13: schedule(OCT_13) };
    const reservations = [reservation("oct13", "s13"), reservation("oct12", "s12")];
    assert.equal(currentId(reservations, schedules), "oct12");
  });

  it("shows the earliest time on the same date", () => {
    const schedules = { pm: schedule(OCT_12, "13:00"), am: schedule(OCT_12, "08:00") };
    const reservations = [reservation("afternoon", "pm"), reservation("morning", "am")];
    assert.equal(currentId(reservations, schedules), "morning");
  });

  it("shows a later-dated session once staff start it", () => {
    const schedules = { s12: schedule(OCT_12), s13: schedule(OCT_13, "09:00", { queueStatus: "active" }) };
    const reservations = [reservation("oct12", "s12"), reservation("oct13", "s13")];
    const current = getCurrentSessionForParent(reservations, schedules, ctx);
    assert.equal(current.reservation.id, "oct13");
    assert.equal(current.status, SESSION_STATUS.ACTIVE);
  });

  it("falls back to the next upcoming session when the active one ends", () => {
    const reservations = [reservation("oct12", "s12"), reservation("oct13", "s13")];
    const live = { s12: schedule(OCT_12), s13: schedule(OCT_13, "09:00", { queueStatus: "active" }) };
    assert.equal(currentId(reservations, live), "oct13");

    const ended = { ...live, s13: { ...live.s13, queueStatus: "ended" } };
    assert.equal(currentId(reservations, ended), "oct12");

    const completed = { ...live, s13: { ...live.s13, status: "completed", queueStatus: "completed" } };
    assert.equal(currentId(reservations, completed), "oct12");
  });

  it("returns null when there are no reservations", () => {
    assert.equal(getCurrentSessionForParent([], {}, ctx), null);
  });

  it("returns null when only past, cancelled or completed reservations remain", () => {
    const schedules = { past: schedule(OCT_10), s12: schedule(OCT_12) };
    const reservations = [
      reservation("past", "past"),
      reservation("cancelled", "s12", { status: "cancelled" }),
      reservation("completed", "s12", { status: "consultation_completed" }),
    ];
    assert.equal(getCurrentSessionForParent(reservations, schedules, ctx), null);
  });

  it("ignores another parent's reservations", () => {
    const schedules = { s12: schedule(OCT_12, "09:00", { queueStatus: "active" }), s13: schedule(OCT_13) };
    const reservations = [
      reservation("someone-else", "s12", { parentId: "parent-2" }),
      reservation("mine", "s13"),
    ];
    assert.equal(currentId(reservations, schedules), "mine");
  });
});

describe("getUpcomingSessions", () => {
  it("drops today's session after closing time unless the queue is live", () => {
    const reservations = [reservation("today", "s")];
    const after = { ...ctx, nowMinutes: 17 * 60 + 30 };
    assert.equal(getUpcomingSessions(reservations, { s: schedule(TODAY) }, after).length, 0);
    assert.equal(
      getUpcomingSessions(reservations, { s: schedule(TODAY, "09:00", { queueStatus: "closed" }) }, after).length,
      1
    );
  });
});

describe("getSessionStatus", () => {
  it("is waiting for today's session before staff start it, and upcoming for a future date", () => {
    assert.equal(getSessionStatus({ status: "reserved" }, schedule(TODAY), { today: TODAY }), SESSION_STATUS.WAITING);
    assert.equal(getSessionStatus({ status: "reserved" }, schedule(OCT_12), { today: TODAY }), SESSION_STATUS.UPCOMING);
  });

  it("is active while the queue is live or paused", () => {
    for (const queueStatus of ["active", "paused", "closed"]) {
      assert.equal(
        getSessionStatus({ status: "reserved" }, schedule(OCT_12, "09:00", { queueStatus }), { today: TODAY }),
        SESSION_STATUS.ACTIVE
      );
    }
  });
});
