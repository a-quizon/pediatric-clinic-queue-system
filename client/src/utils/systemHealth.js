/**
 * Pure helpers for Admin → System Health UI.
 */

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
    id: "evaluateSuspiciousAccounts",
    name: "Evaluate suspicious accounts",
    schedule: "Daily 20:00 (Asia/Manila)",
  },
];

export const SMS_DEVICE_HELP =
  "TextBee may report the phone gateway as offline, no signal, no load, or no battery. When the system records those phrases from a failed send, they appear under the last failure detail. Until the first SMS send is recorded, status is Unknown.";

export function smsStatusLabel(gateway) {
  if (!gateway || !gateway.inferredStatus) return "Unknown";
  if (gateway.inferredStatus === "ok") return "OK";
  if (gateway.inferredStatus === "failing") return "Failing";
  if (gateway.inferredStatus === "not_configured") return "Not configured";
  return "Unknown";
}
