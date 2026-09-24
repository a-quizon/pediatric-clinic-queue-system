import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  evaluateSuspiciousRules,
  classifyReservation,
  canFlagAccount,
  shouldReflagAfterDismiss,
  buildSuspiciousRecommendation,
} from "../src/utils/suspiciousAccountRules.js";
import {
  SUSPICIOUS_RULE_IDS,
  SUSPICIOUS_FLAG_STATUS,
} from "../src/utils/suspiciousAccountConfig.js";
import {
  TEST_TODAY_DEFAULT,
  TEST_IDS,
  buildParentAReservations,
  buildParentBReservations,
  buildParentCReservations,
  buildParentDReservations,
  buildParentEBelowA,
  buildParentEAtA,
  buildParentEBelowB,
  buildParentEAtB,
  buildParentEBelowC,
  buildParentEAtC,
  buildParentFReservations,
  buildParentFOpenFlag,
} from "./helpers/suspiciousFixtures.js";

const TODAY = TEST_TODAY_DEFAULT;

describe("Suspicious account detection — Parent A (Oct 5–9 no-shows)", () => {
  it("flags Parent A and includes consecutive + bulk rules with evidence dates", () => {
    const reservations = buildParentAReservations(TODAY);
    const result = evaluateSuspiciousRules(reservations, { todayManila: TODAY });

    assert.equal(result.triggered, true);
    assert.ok(result.rulesTriggered.includes(SUSPICIOUS_RULE_IDS.CONSECUTIVE_NO_SHOWS));
    assert.ok(result.rulesTriggered.includes(SUSPICIOUS_RULE_IDS.BULK_ZERO_ATTENDANCE));
    assert.deepEqual(result.summary.distinctNoShowDates, [
      "2026-10-05",
      "2026-10-06",
      "2026-10-07",
      "2026-10-08",
      "2026-10-09",
    ]);
    assert.ok(result.evidence.every((e) => e.kind === "no_show" && e.checkedIn === false));
    assert.ok(result.evidence.some((e) => e.status === "forfeited"));
    assert.ok(result.evidence.some((e) => e.reservationId?.includes(TEST_IDS.parentA)));
  });

  it("builds a recommendation naming the parent and listing dates", () => {
    const evaluation = evaluateSuspiciousRules(buildParentAReservations(TODAY), {
      todayManila: TODAY,
    });
    const text = buildSuspiciousRecommendation("Parent A NoShow", evaluation);
    assert.match(text, /Parent A NoShow is suspicious/);
    assert.match(text, /2026-10-05/);
    assert.match(text, /QR code/i);
    assert.match(text, /deactivating/i);
  });
});

describe("Suspicious account detection — negative cases B/C/D", () => {
  it("does not flag Parent B (all QR validated / completed)", () => {
    const result = evaluateSuspiciousRules(buildParentBReservations(), { todayManila: TODAY });
    assert.equal(result.triggered, false);
    assert.equal(result.rulesTriggered.length, 0);
    assert.equal(result.summary.attendedCount, 5);
    assert.equal(result.summary.noShowCount, 0);
  });

  it("does not flag Parent C (upcoming-only reservations)", () => {
    const result = evaluateSuspiciousRules(buildParentCReservations(TODAY), {
      todayManila: TODAY,
    });
    assert.equal(result.triggered, false);
    assert.equal(result.summary.pastScoredCount, 0);
  });

  it("does not flag Parent D (cancelled in advance)", () => {
    const result = evaluateSuspiciousRules(buildParentDReservations(), { todayManila: TODAY });
    assert.equal(result.triggered, false);
    assert.equal(result.summary.noShowCount, 0);
  });

  it("never counts cancelled_by_clinic as a no-show", () => {
    const reservations = [
      {
        id: "cbc1",
        parentId: "p",
        clinicDate: "2026-10-08",
        status: "cancelled_by_clinic",
        checkedIn: false,
      },
    ];
    assert.equal(classifyReservation(reservations[0], TODAY).kind, "cancelled_by_clinic");
    const result = evaluateSuspiciousRules(reservations, { todayManila: TODAY });
    assert.equal(result.triggered, false);
  });
});

describe("Suspicious account detection — borderline thresholds", () => {
  it("Rule A: below threshold (2 consecutive) does not flag", () => {
    const result = evaluateSuspiciousRules(buildParentEBelowA(), { todayManila: TODAY });
    assert.equal(result.rulesTriggered.includes(SUSPICIOUS_RULE_IDS.CONSECUTIVE_NO_SHOWS), false);
  });

  it("Rule A: at threshold (3 consecutive) flags", () => {
    const result = evaluateSuspiciousRules(buildParentEAtA(), { todayManila: TODAY });
    assert.ok(result.rulesTriggered.includes(SUSPICIOUS_RULE_IDS.CONSECUTIVE_NO_SHOWS));
  });

  it("Rule B: 50% of 4 (below 60%) does not flag rate rule", () => {
    const result = evaluateSuspiciousRules(buildParentEBelowB(), { todayManila: TODAY });
    assert.equal(result.rulesTriggered.includes(SUSPICIOUS_RULE_IDS.NO_SHOW_RATE), false);
  });

  it("Rule B: 75% of 4 (at/above 60%) flags rate rule", () => {
    const result = evaluateSuspiciousRules(buildParentEAtB(), { todayManila: TODAY });
    assert.ok(result.rulesTriggered.includes(SUSPICIOUS_RULE_IDS.NO_SHOW_RATE));
  });

  it("Rule C: 2 distinct zero-attendance dates does not flag bulk rule", () => {
    const result = evaluateSuspiciousRules(buildParentEBelowC(), { todayManila: TODAY });
    assert.equal(result.rulesTriggered.includes(SUSPICIOUS_RULE_IDS.BULK_ZERO_ATTENDANCE), false);
  });

  it("Rule C: 3 distinct zero-attendance dates flags bulk rule", () => {
    const result = evaluateSuspiciousRules(buildParentEAtC(), { todayManila: TODAY });
    assert.ok(result.rulesTriggered.includes(SUSPICIOUS_RULE_IDS.BULK_ZERO_ATTENDANCE));
  });
});

describe("Suspicious account detection — timezone / date boundaries", () => {
  it("treats a reservation dated today as upcoming (not a no-show yet)", () => {
    const res = {
      id: "today1",
      parentId: "p",
      clinicDate: TODAY,
      status: "reserved",
      checkedIn: false,
    };
    assert.equal(classifyReservation(res, TODAY).kind, "upcoming");
    const result = evaluateSuspiciousRules([res], { todayManila: TODAY });
    assert.equal(result.triggered, false);
  });

  it("treats yesterday without QR validation as a no-show", () => {
    const res = {
      id: "y1",
      parentId: "p",
      clinicDate: "2026-10-09",
      status: "reserved",
      checkedIn: false,
    };
    assert.equal(classifyReservation(res, TODAY).kind, "no_show");
  });

  it("excludes walk-ins without counting them toward parent suspicion", () => {
    const reservations = [
      {
        id: "w1",
        parentId: "p",
        clinicDate: "2026-10-08",
        status: "reserved",
        checkedIn: false,
        source: "walk_in",
      },
      {
        id: "w2",
        parentId: "p",
        clinicDate: "2026-10-07",
        status: "reserved",
        checkedIn: false,
        source: "walk_in",
      },
      {
        id: "w3",
        parentId: "p",
        clinicDate: "2026-10-06",
        status: "reserved",
        checkedIn: false,
        source: "walk_in",
      },
    ];
    const result = evaluateSuspiciousRules(reservations, { todayManila: TODAY });
    assert.equal(result.triggered, false);
  });
});

describe("Suspicious account flagging policy — duplicates and re-flag", () => {
  it("Parent F: open unresolved flag blocks re-flagging (no duplicate)", () => {
    const evaluation = evaluateSuspiciousRules(buildParentFReservations(), {
      todayManila: TODAY,
    });
    assert.equal(evaluation.triggered, true);
    assert.equal(canFlagAccount(evaluation, buildParentFOpenFlag()), false);
  });

  it("after dismiss, does not re-flag on the same historical no-shows alone", () => {
    const evaluation = evaluateSuspiciousRules(buildParentAReservations(TODAY), {
      todayManila: TODAY,
    });
    const dismissed = {
      isSuspicious: false,
      status: SUSPICIOUS_FLAG_STATUS.DISMISSED,
      reviewedAt: Date.parse("2026-10-09T21:00:00+08:00"),
    };
    assert.equal(shouldReflagAfterDismiss(evaluation, dismissed), false);
    assert.equal(canFlagAccount(evaluation, dismissed), false);
  });

  it("after dismiss, re-flags when a newer past no-show appears after reviewedAt", () => {
    const dismissed = {
      isSuspicious: false,
      status: SUSPICIOUS_FLAG_STATUS.DISMISSED,
      reviewedAt: Date.parse("2026-10-08T12:00:00+08:00"), // Manila day 2026-10-08
    };
    const withNew = [
      ...buildParentAReservations(TODAY),
      {
        id: "new_noshow",
        parentId: TEST_IDS.parentA,
        clinicDate: "2026-10-09",
        status: "reserved",
        checkedIn: false,
        createdAt: Date.parse("2026-10-09T10:00:00+08:00"),
      },
    ];
    // Parent A already has 10-09; reviewed on 10-08 means clinicDate 10-09 > reviewedDay → reflag
    const evaluation = evaluateSuspiciousRules(withNew, { todayManila: TODAY });
    assert.equal(shouldReflagAfterDismiss(evaluation, dismissed), true);
    assert.equal(canFlagAccount(evaluation, dismissed), true);
  });

  it("flagging policy never implies auto-deactivation (status stays caller-controlled)", () => {
    const evaluation = evaluateSuspiciousRules(buildParentAReservations(TODAY), {
      todayManila: TODAY,
    });
    assert.equal(evaluation.triggered, true);
    // Detection result has no deactivation field — account status is unchanged by evaluateSuspiciousRules
    assert.equal("deactivate" in evaluation, false);
    assert.equal(evaluation.accountStatus, undefined);
  });
});
