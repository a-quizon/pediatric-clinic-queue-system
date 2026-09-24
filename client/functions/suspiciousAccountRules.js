const { addManilaDays, manilaDateString } = require("./manilaDate");
const {
  SUSPICIOUS_ACCOUNT_CONFIG,
  SUSPICIOUS_RULE_IDS,
  ATTENDED_STATUSES,
  EXCUSED_STATUSES,
} = require("./suspiciousAccountConfig");

function resolveReservationClinicDate(reservation, schedulesById = {}) {
  if (!reservation) return null;
  return (
    reservation.clinicDate ||
    schedulesById[reservation.scheduleId]?.clinicDate ||
    null
  );
}

function wasQrValidated(reservation) {
  if (!reservation) return false;
  if (reservation.checkedIn === true) return true;
  return ATTENDED_STATUSES.includes(reservation.status);
}

function classifyReservation(reservation, todayManila, schedulesById = {}) {
  const clinicDate = resolveReservationClinicDate(reservation, schedulesById);
  if (!clinicDate) {
    return { kind: "unknown", clinicDate: null, reservation };
  }
  if (clinicDate >= todayManila) {
    return { kind: "upcoming", clinicDate, reservation };
  }
  if (EXCUSED_STATUSES.includes(reservation.status)) {
    return {
      kind: reservation.status === "cancelled_by_clinic" ? "cancelled_by_clinic" : "cancelled",
      clinicDate,
      reservation,
    };
  }
  if (wasQrValidated(reservation)) {
    return { kind: "attended", clinicDate, reservation };
  }
  return { kind: "no_show", clinicDate, reservation };
}

function toEvidence(classified) {
  return {
    reservationId: classified.reservation.id || classified.reservation.reservationId || null,
    clinicDate: classified.clinicDate,
    status: classified.reservation.status || null,
    checkedIn: classified.reservation.checkedIn === true,
    kind: classified.kind,
  };
}

function evaluateSuspiciousRules(reservations = [], options = {}) {
  const config = { ...SUSPICIOUS_ACCOUNT_CONFIG, ...(options.config || {}) };
  const todayManila = options.todayManila || manilaDateString();
  const schedulesById = options.schedulesById || {};

  const classified = (reservations || [])
    .filter((r) => r && r.parentId && r.source !== "walk_in")
    .map((r) => classifyReservation(r, todayManila, schedulesById))
    .filter((c) => c.kind !== "unknown" && c.kind !== "upcoming");

  const pastScored = classified.filter(
    (c) => c.kind === "no_show" || c.kind === "attended"
  );
  pastScored.sort((a, b) => {
    if (a.clinicDate !== b.clinicDate) return a.clinicDate.localeCompare(b.clinicDate);
    return (Number(a.reservation.createdAt) || 0) - (Number(b.reservation.createdAt) || 0);
  });

  const rulesTriggered = [];
  const evidenceByRule = {};

  const streakN = config.CONSECUTIVE_NO_SHOW_THRESHOLD;
  if (pastScored.length >= streakN) {
    const recent = pastScored.slice(-streakN);
    if (recent.every((c) => c.kind === "no_show")) {
      rulesTriggered.push(SUSPICIOUS_RULE_IDS.CONSECUTIVE_NO_SHOWS);
      evidenceByRule[SUSPICIOUS_RULE_IDS.CONSECUTIVE_NO_SHOWS] = recent.map(toEvidence);
    }
  }

  const windowStartB = addManilaDays(todayManila, -config.NO_SHOW_RATE_WINDOW_DAYS);
  const inWindowB = pastScored.filter((c) => c.clinicDate >= windowStartB && c.clinicDate < todayManila);
  if (inWindowB.length >= config.NO_SHOW_RATE_MIN_RESERVATIONS) {
    const noShows = inWindowB.filter((c) => c.kind === "no_show");
    const rate = (noShows.length / inWindowB.length) * 100;
    if (rate >= config.NO_SHOW_RATE_PERCENT) {
      rulesTriggered.push(SUSPICIOUS_RULE_IDS.NO_SHOW_RATE);
      evidenceByRule[SUSPICIOUS_RULE_IDS.NO_SHOW_RATE] = inWindowB.map(toEvidence);
    }
  }

  const windowStartC = addManilaDays(todayManila, -config.BULK_ZERO_ATTENDANCE_WINDOW_DAYS);
  const inWindowC = pastScored.filter((c) => c.clinicDate >= windowStartC && c.clinicDate < todayManila);
  const datesInC = [...new Set(inWindowC.map((c) => c.clinicDate))];
  if (datesInC.length >= config.BULK_ZERO_ATTENDANCE_MIN_DATES) {
    const allNoShows = inWindowC.every((c) => c.kind === "no_show");
    if (allNoShows) {
      rulesTriggered.push(SUSPICIOUS_RULE_IDS.BULK_ZERO_ATTENDANCE);
      evidenceByRule[SUSPICIOUS_RULE_IDS.BULK_ZERO_ATTENDANCE] = inWindowC.map(toEvidence);
    }
  }

  const evidenceMap = new Map();
  rulesTriggered.forEach((ruleId) => {
    (evidenceByRule[ruleId] || []).forEach((row) => {
      const key = row.reservationId || `${row.clinicDate}:${row.status}`;
      if (!evidenceMap.has(key)) evidenceMap.set(key, row);
    });
  });
  const evidence = [...evidenceMap.values()].sort((a, b) =>
    String(a.clinicDate).localeCompare(String(b.clinicDate))
  );

  const noShowDates = evidence
    .filter((e) => e.kind === "no_show")
    .map((e) => e.clinicDate);

  return {
    triggered: rulesTriggered.length > 0,
    rulesTriggered,
    evidence,
    evidenceByRule,
    summary: {
      pastScoredCount: pastScored.length,
      noShowCount: pastScored.filter((c) => c.kind === "no_show").length,
      attendedCount: pastScored.filter((c) => c.kind === "attended").length,
      noShowDates,
      distinctNoShowDates: [...new Set(noShowDates)],
    },
  };
}

function buildSuspiciousRecommendation(parentName, evaluation) {
  const dates = evaluation?.summary?.distinctNoShowDates || [];
  const n = dates.length || evaluation?.summary?.noShowCount || 0;
  const dateList = dates.length ? dates.join(", ") : "multiple dates";
  const name = parentName || "This parent";
  return `${name} is suspicious. They reserved ${n} slot(s) (${dateList}) but none were validated via QR code. Consider deactivating this account.`;
}

function shouldReflagAfterDismiss(evaluation, suspiciousFlag) {
  if (!evaluation?.triggered) return false;
  if (!suspiciousFlag || suspiciousFlag.status === "open") return false;
  const reviewedAt = Number(suspiciousFlag.reviewedAt) || 0;
  if (!reviewedAt) return true;
  const reviewedDay = manilaDateString(new Date(reviewedAt));
  return (evaluation.evidence || []).some((row) => {
    if (row.kind !== "no_show") return false;
    return row.clinicDate > reviewedDay;
  });
}

function canFlagAccount(evaluation, suspiciousFlag) {
  if (!evaluation?.triggered) return false;
  if (!suspiciousFlag) return true;
  if (suspiciousFlag.status === "open") return false;
  if (
    suspiciousFlag.status === "dismissed" ||
    suspiciousFlag.status === "deactivated" ||
    suspiciousFlag.reviewedAt
  ) {
    return shouldReflagAfterDismiss(evaluation, suspiciousFlag);
  }
  if (suspiciousFlag.isSuspicious) return false;
  return true;
}

module.exports = {
  evaluateSuspiciousRules,
  buildSuspiciousRecommendation,
  canFlagAccount,
  classifyReservation,
  resolveReservationClinicDate,
};
