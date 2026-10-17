/**
 * Pure helpers for Admin → System Health UI.
 */

import { explainSmsManagerResultCode } from "./smsManagerResultCodes.js";
import {
  DEGRADED_FAILURE_RATE_1H,
  DOWN_CONSECUTIVE_FAILURES,
  DOWN_NO_SUCCESS_WHILE_ATTEMPTING_MS,
  STUCK_QUEUED_MS,
  TERMINAL_STATUSES,
  TERMINAL_SUCCESS,
} from "./smsHealthConfig.js";

export {
  DEGRADED_FAILURE_RATE_1H,
  DOWN_CONSECUTIVE_FAILURES,
  DOWN_NO_SUCCESS_WHILE_ATTEMPTING_MS,
  STUCK_QUEUED_MS,
};

export function summarizeNotificationFailures(failuresMap, now = Date.now()) {
  const rows = Object.entries(failuresMap || {}).map(([id, row]) => ({ id, ...row }));
  rows.sort((a, b) => (b.at || 0) - (a.at || 0));
  const day = 24 * 60 * 60 * 1000;
  return {
    recent: rows.slice(0, 20),
    count24h: rows.filter((r) => now - (r.at || 0) <= day).length,
    count7d: rows.filter((r) => now - (r.at || 0) <= 7 * day).length,
  };
}

export function connectionLabelFromInfoConnected(connected, { everConnected = false } = {}) {
  if (connected === true) return "Online";
  if (connected === false && everConnected) return "Reconnecting";
  if (connected === false) return "Offline";
  return "Unknown";
}

export function formatHealthTimestamp(ts) {
  if (!ts) return "No data yet";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(ts));
}

export const KNOWN_JOBS = [
  {
    id: "expirePenaltyTimers",
    name: "Expire penalty timers",
    schedule: "Every 1 minute (Asia/Manila)",
  },
  {
    id: "pollTextBeeSmsStatus",
    name: "Poll TextBee SMS status",
    schedule: "Every 5 minutes (Asia/Manila)",
  },
  {
    id: "evaluateSuspiciousAccounts",
    name: "Evaluate suspicious accounts",
    schedule: "Daily 20:00 (Asia/Manila)",
  },
];

export const SMS_DEVICE_HELP =
  "TextBee accepts sends immediately (queued), then the Android gateway phone reports sent, delivered, or failed. Delivery failures such as code 32 (no default SMS app) are a gateway phone configuration issue, not a problem with the patient's number.";

/**
 * Pure Healthy / Degraded / Down (mirrors functions/systemHealthRuntime.computeSmsServiceStatus).
 */
export function computeSmsServiceStatus(messages, now = Date.now()) {
  const rows = Array.isArray(messages) ? messages : [];
  const stuck = rows.filter(
    (m) => m.status === "queued" && now - Number(m.createdAt || 0) > STUCK_QUEUED_MS
  );

  const lastHourTerminal = rows.filter(
    (m) =>
      TERMINAL_STATUSES.has(m.status) &&
      now - Number(m.updatedAt || m.createdAt || 0) <= 60 * 60 * 1000
  );
  const lastHourFailed = lastHourTerminal.filter((m) => m.status === "failed");
  const failureRate1h =
    lastHourTerminal.length > 0 ? lastHourFailed.length / lastHourTerminal.length : 0;

  const terminal = rows
    .filter((m) => TERMINAL_STATUSES.has(m.status))
    .sort((a, b) => Number(b.updatedAt || b.createdAt || 0) - Number(a.updatedAt || a.createdAt || 0));

  const lastN = terminal.slice(0, DOWN_CONSECUTIVE_FAILURES);
  const allLastNFailed =
    lastN.length >= DOWN_CONSECUTIVE_FAILURES && lastN.every((m) => m.status === "failed");

  const windowStart = now - DOWN_NO_SUCCESS_WHILE_ATTEMPTING_MS;
  const attemptedInWindow = rows.filter((m) => Number(m.createdAt || 0) >= windowStart);
  const hadSuccessInWindow = rows.some(
    (m) =>
      TERMINAL_SUCCESS.has(m.status) && Number(m.updatedAt || m.createdAt || 0) >= windowStart
  );
  const settledInWindow = attemptedInWindow.filter(
    (m) =>
      m.status === "failed" ||
      (m.status === "queued" && now - Number(m.createdAt || 0) > STUCK_QUEUED_MS)
  );
  // Down only when every attempt in the window has settled and at least one failed
  // (stuck queued alone is Degraded, not Down).
  const downNoSuccess =
    attemptedInWindow.length > 0 &&
    !hadSuccessInWindow &&
    settledInWindow.length === attemptedInWindow.length &&
    settledInWindow.some((m) => m.status === "failed");

  let serviceStatus = "healthy";
  if (allLastNFailed || downNoSuccess) {
    serviceStatus = "down";
  } else if (failureRate1h > DEGRADED_FAILURE_RATE_1H || stuck.length > 0) {
    serviceStatus = "degraded";
  }

  const dayAgo = now - 24 * 60 * 60 * 1000;
  const failures24h = rows.filter(
    (m) => m.status === "failed" && Number(m.updatedAt || m.createdAt || 0) >= dayAgo
  ).length;
  const attempts24h = rows.filter((m) => Number(m.createdAt || 0) >= dayAgo).length;
  const failureRate24h = attempts24h > 0 ? failures24h / attempts24h : 0;

  const successes = rows
    .filter((m) => TERMINAL_SUCCESS.has(m.status))
    .sort((a, b) => Number(b.updatedAt || b.createdAt || 0) - Number(a.updatedAt || a.createdAt || 0));
  const failures = rows
    .filter((m) => m.status === "failed")
    .sort((a, b) => Number(b.updatedAt || b.createdAt || 0) - Number(a.updatedAt || a.createdAt || 0));

  return {
    serviceStatus,
    failureRate1h,
    failureRate24h,
    failures24h,
    stuckCount: stuck.length,
    lastSuccessAt: successes[0] ? Number(successes[0].updatedAt || successes[0].createdAt) : null,
    lastFailureAt: failures[0] ? Number(failures[0].updatedAt || failures[0].createdAt) : null,
    lastFailure: failures[0]
      ? {
          errorCode: failures[0].errorCode || null,
          errorName: failures[0].errorName || null,
          errorMessage: failures[0].errorMessage || null,
          maskedRecipient: failures[0].maskedRecipient || null,
          messageType: failures[0].messageType || null,
          reservationId: failures[0].reservationId || null,
          at: Number(failures[0].updatedAt || failures[0].createdAt),
        }
      : null,
    recentFailures: failures.slice(0, 20),
  };
}

export function summarizeSmsMessages(messagesMap, now = Date.now()) {
  const rows = Object.entries(messagesMap || {}).map(([id, row]) => ({ id, ...row }));
  return computeSmsServiceStatus(rows, now);
}

export function smsServiceStatusLabel(status) {
  if (status === "healthy") return "Healthy";
  if (status === "degraded") return "Degraded";
  if (status === "down") return "Down";
  return "Unknown";
}

/** @deprecated Prefer smsServiceStatusLabel — kept for older snapshots. */
export function smsStatusLabel(gateway) {
  if (gateway?.serviceStatus) return smsServiceStatusLabel(gateway.serviceStatus);
  if (!gateway || !gateway.inferredStatus) return "Unknown";
  if (gateway.inferredStatus === "ok") return "Healthy";
  if (gateway.inferredStatus === "failing") return "Degraded";
  if (gateway.inferredStatus === "not_configured") return "Down";
  return "Unknown";
}

export function formatSmsFailureExplanation(row) {
  if (!row) return "No data yet";
  const explained = explainSmsManagerResultCode(row.errorCode);
  const parts = [];
  if (row.errorCode || explained.code !== "unknown") {
    parts.push(`Code ${explained.code} (${explained.name})`);
  }
  parts.push(row.errorMessage || explained.explanation);
  if (explained.isGatewayConfig) {
    parts.push("Gateway device configuration issue — not the patient's number.");
  }
  if (explained.suggestedFix) {
    parts.push(`Fix: ${explained.suggestedFix}`);
  }
  return parts.join(" ");
}

export { explainSmsManagerResultCode };
