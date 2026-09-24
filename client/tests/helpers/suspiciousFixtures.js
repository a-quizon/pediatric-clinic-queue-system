/**
 * Shared fixtures for suspicious-account detection tests and seed_suspicious_test.
 * Pure data builders — no Firebase side effects.
 */
import { addManilaDays } from "../../src/utils/manilaDate.js";
import {
  SUSPICIOUS_ACCOUNT_CONFIG,
  SUSPICIOUS_FLAG_STATUS,
  SUSPICIOUS_RULE_IDS,
} from "../../src/utils/suspiciousAccountConfig.js";

export const TEST_PREFIX = "seed_suspicious_test";
export const TEST_TODAY_DEFAULT = "2026-10-10"; // Friday after Oct 5–9 week

export const TEST_IDS = {
  parentA: `${TEST_PREFIX}_parent_a`,
  parentB: `${TEST_PREFIX}_parent_b`,
  parentC: `${TEST_PREFIX}_parent_c`,
  parentD: `${TEST_PREFIX}_parent_d`,
  parentEBelowA: `${TEST_PREFIX}_parent_e_below_a`,
  parentEAtA: `${TEST_PREFIX}_parent_e_at_a`,
  parentEBelowB: `${TEST_PREFIX}_parent_e_below_b`,
  parentEAtB: `${TEST_PREFIX}_parent_e_at_b`,
  parentEBelowC: `${TEST_PREFIX}_parent_e_below_c`,
  parentEAtC: `${TEST_PREFIX}_parent_e_at_c`,
  parentF: `${TEST_PREFIX}_parent_f`,
  doctor: `${TEST_PREFIX}_doctor`,
  secretary: `${TEST_PREFIX}_secretary`,
};

function reservation({
  id,
  parentId,
  clinicDate,
  status = "reserved",
  checkedIn = false,
  source = "parent",
  createdAt = Date.parse(`${clinicDate}T08:00:00+08:00`),
}) {
  return {
    id,
    parentId,
    clinicDate,
    status,
    checkedIn,
    source,
    createdAt,
    queueNumber: 1,
    reservationCode: String(id).replace(/[^A-Z0-9]/gi, "").slice(-6).toUpperCase() || "SEED01",
    concern: "seed_suspicious_test",
    children: [{ name: "Test Child", age: 4, sex: "F" }],
    note: TEST_PREFIX,
  };
}

/** Parent A: Oct 5–9 all no-shows (should flag Rules A+C, often B). */
export function buildParentAReservations(today = TEST_TODAY_DEFAULT) {
  // Fixed calendar week ending before today when today is 2026-10-10
  const dates = ["2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08", "2026-10-09"];
  if (dates.some((d) => d >= today)) {
    throw new Error("TEST_TODAY_DEFAULT must be after 2026-10-09 for Parent A fixtures");
  }
  return dates.map((clinicDate, i) =>
    reservation({
      id: `${TEST_IDS.parentA}_res_${i + 1}`,
      parentId: TEST_IDS.parentA,
      clinicDate,
      status: i === 1 ? "forfeited" : "reserved",
      checkedIn: false,
    })
  );
}

/** Parent B: five past dates, all QR validated / completed. */
export function buildParentBReservations() {
  const dates = ["2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08", "2026-10-09"];
  return dates.map((clinicDate, i) =>
    reservation({
      id: `${TEST_IDS.parentB}_res_${i + 1}`,
      parentId: TEST_IDS.parentB,
      clinicDate,
      status: "consultation_completed",
      checkedIn: true,
    })
  );
}

/** Parent C: upcoming only (today + future). */
export function buildParentCReservations(today = TEST_TODAY_DEFAULT) {
  return [
    reservation({
      id: `${TEST_IDS.parentC}_res_1`,
      parentId: TEST_IDS.parentC,
      clinicDate: today,
      status: "reserved",
      checkedIn: false,
    }),
    reservation({
      id: `${TEST_IDS.parentC}_res_2`,
      parentId: TEST_IDS.parentC,
      clinicDate: addManilaDays(today, 1),
      status: "reserved",
      checkedIn: false,
    }),
  ];
}

/** Parent D: cancelled in advance (past dates). */
export function buildParentDReservations() {
  const dates = ["2026-10-05", "2026-10-06", "2026-10-07"];
  return dates.map((clinicDate, i) =>
    reservation({
      id: `${TEST_IDS.parentD}_res_${i + 1}`,
      parentId: TEST_IDS.parentD,
      clinicDate,
      status: "cancelled",
      checkedIn: false,
    })
  );
}

/** Borderline Rule A: 2 consecutive no-shows (below) vs 3 (at). */
export function buildParentEBelowA() {
  return ["2026-10-07", "2026-10-08"].map((clinicDate, i) =>
    reservation({
      id: `${TEST_IDS.parentEBelowA}_res_${i + 1}`,
      parentId: TEST_IDS.parentEBelowA,
      clinicDate,
      status: "reserved",
      checkedIn: false,
    })
  );
}

export function buildParentEAtA() {
  return ["2026-10-07", "2026-10-08", "2026-10-09"].map((clinicDate, i) =>
    reservation({
      id: `${TEST_IDS.parentEAtA}_res_${i + 1}`,
      parentId: TEST_IDS.parentEAtA,
      clinicDate,
      status: "reserved",
      checkedIn: false,
    })
  );
}

/**
 * Rule B: need ≥4 past in 30 days, rate ≥60%.
 * Below: 4 total, 2 no-shows (50%).
 * At: 4 total, 3 no-shows (75%).
 */
export function buildParentEBelowB() {
  const parentId = TEST_IDS.parentEBelowB;
  return [
    reservation({ id: `${parentId}_1`, parentId, clinicDate: "2026-10-01", status: "consultation_completed", checkedIn: true }),
    reservation({ id: `${parentId}_2`, parentId, clinicDate: "2026-10-02", status: "consultation_completed", checkedIn: true }),
    reservation({ id: `${parentId}_3`, parentId, clinicDate: "2026-10-03", status: "reserved", checkedIn: false }),
    reservation({ id: `${parentId}_4`, parentId, clinicDate: "2026-10-04", status: "reserved", checkedIn: false }),
  ];
}

export function buildParentEAtB() {
  const parentId = TEST_IDS.parentEAtB;
  return [
    reservation({ id: `${parentId}_1`, parentId, clinicDate: "2026-10-01", status: "consultation_completed", checkedIn: true }),
    reservation({ id: `${parentId}_2`, parentId, clinicDate: "2026-10-02", status: "reserved", checkedIn: false }),
    reservation({ id: `${parentId}_3`, parentId, clinicDate: "2026-10-03", status: "reserved", checkedIn: false }),
    reservation({ id: `${parentId}_4`, parentId, clinicDate: "2026-10-04", status: "reserved", checkedIn: false }),
  ];
}

/** Rule C: below = 2 distinct no-show dates; at = 3. */
export function buildParentEBelowC() {
  return ["2026-10-07", "2026-10-08"].map((clinicDate, i) =>
    reservation({
      id: `${TEST_IDS.parentEBelowC}_res_${i + 1}`,
      parentId: TEST_IDS.parentEBelowC,
      clinicDate,
      status: "reserved",
      checkedIn: false,
    })
  );
}

export function buildParentEAtC() {
  return ["2026-10-07", "2026-10-08", "2026-10-09"].map((clinicDate, i) =>
    reservation({
      id: `${TEST_IDS.parentEAtC}_res_${i + 1}`,
      parentId: TEST_IDS.parentEAtC,
      clinicDate,
      status: "reserved",
      checkedIn: false,
    })
  );
}

/** Parent F: already open flag + qualifying no-shows (duplicate prevention). */
export function buildParentFReservations() {
  return buildParentAReservations().map((r, i) => ({
    ...r,
    id: `${TEST_IDS.parentF}_res_${i + 1}`,
    parentId: TEST_IDS.parentF,
  }));
}

export function buildParentFOpenFlag() {
  return {
    isSuspicious: true,
    status: SUSPICIOUS_FLAG_STATUS.OPEN,
    rulesTriggered: [SUSPICIOUS_RULE_IDS.CONSECUTIVE_NO_SHOWS],
    evidence: [],
    flaggedAt: Date.parse("2026-10-09T20:00:00+08:00"),
    reviewedAt: null,
    reviewedBy: null,
  };
}

export function buildMockDoctorPushSubscription() {
  return {
    endpoint: "https://push.example.test/seed_suspicious_test_doctor",
    expirationTime: null,
    keys: {
      p256dh: "TEST_P256DH_PUBLIC_KEY_NOT_SECRET",
      auth: "TEST_AUTH_SECRET_NOT_REAL",
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/** Contract helper mirrors Cloud Function notifyDoctors payload. */
export function buildSuspiciousDoctorPushPayload({ parentName, parentId, auditLogId }) {
  const title = "Suspicious account detected";
  const body = `Suspicious account detected: ${parentName}`;
  const url = auditLogId
    ? `/doctor/audit-logs?highlight=${encodeURIComponent(auditLogId)}`
    : "/doctor/audit-logs";
  return {
    title,
    body,
    message: body,
    type: "SUSPICIOUS_ACCOUNT",
    url,
    dedupeKey: `suspicious_${parentId}_${auditLogId || "pending"}`,
  };
}

/** Mirrors sw.js absolute URL resolution for notificationclick. */
export function resolveNotificationClickUrl(dataUrl, origin = "https://app.example.test") {
  const targetUrl = dataUrl || "/parent/notifications";
  if (targetUrl.startsWith("http")) return targetUrl;
  return new URL(targetUrl, origin).href;
}

export function parseHighlightParam(search) {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  return params.get("highlight");
}

export { SUSPICIOUS_ACCOUNT_CONFIG, SUSPICIOUS_RULE_IDS, SUSPICIOUS_FLAG_STATUS };
