/**
 * Minimal system-health recording for Admin → System Health.
 * Server (Admin SDK) writes only; clients never write.
 */

const FAILURE_CAP = 50;

function resolveDb(db) {
  if (db) return db;
  try {
    const { getRtdb } = require("./rtdbRouter");
    return getRtdb();
  } catch {
    return null;
  }
}

/**
 * Infer SMS gateway status from a send result (testable pure helper).
 * @returns {"ok"|"failing"|"unknown"|"not_configured"}
 */
function inferSmsGatewayStatus(result) {
  if (!result || typeof result !== "object") return "unknown";
  if (result.skipped && result.reason === "not_configured") return "not_configured";
  if (result.success) return "ok";
  if (result.reason === "empty_message" || result.reason === "invalid_recipient") {
    return "unknown";
  }
  const blob = `${result.reason || ""} ${result.error || ""} ${JSON.stringify(result.data || {})}`.toLowerCase();
  if (
    blob.includes("offline") ||
    blob.includes("no signal") ||
    blob.includes("no_signal") ||
    blob.includes("no load") ||
    blob.includes("no_load") ||
    blob.includes("no battery") ||
    blob.includes("no_battery") ||
    blob.includes("network_error") ||
    blob.includes("provider_error") ||
    blob.includes("econnrefused") ||
    blob.includes("etimedout")
  ) {
    return "failing";
  }
  if (result.success === false) return "failing";
  return "unknown";
}

function describeTextBeeCase(blob) {
  const text = String(blob || "").toLowerCase();
  if (text.includes("offline")) return "Device reported offline";
  if (text.includes("no signal") || text.includes("no_signal")) return "Device reported no signal";
  if (text.includes("no load") || text.includes("no_load")) return "Device reported no load / SIM issue";
  if (text.includes("no battery") || text.includes("no_battery")) return "Device reported no battery";
  return null;
}

async function recordSmsGatewayResult(result, options = {}) {
  const database = resolveDb(options.db);
  if (!database) return;
  const now = Date.now();
  const inferredStatus = inferSmsGatewayStatus(result);
  const update = {
    inferredStatus,
    updatedAt: now,
  };

  if (result?.success) {
    update.lastSuccessAt = now;
    update.lastSuccessHttpStatus = result.status || 200;
  } else if (!result?.skipped) {
    update.lastFailureAt = now;
    update.lastFailureReason = result?.reason || result?.error || "unknown";
    update.lastHttpStatus = result?.status || null;
    const detail = describeTextBeeCase(
      `${result?.reason || ""} ${result?.error || ""} ${JSON.stringify(result?.data || {})}`
    );
    if (detail) update.lastFailureDetail = detail;
  } else if (result?.reason === "not_configured") {
    update.lastFailureReason = "not_configured";
  }

  try {
    await database.ref("systemHealth/smsGateway").update(update);
  } catch (err) {
    console.error("[systemHealth] smsGateway write failed:", err.message);
  }
}

async function recordNotificationFailure(entry, options = {}) {
  const database = resolveDb(options.db);
  if (!database) return;
  const now = Date.now();
  const payload = {
    at: now,
    channel: entry.channel || "push",
    targetRole: entry.targetRole || "parent",
    error: String(entry.error || entry.reason || "unknown").slice(0, 500),
    notificationType: entry.notificationType || entry.type || null,
    targetId: entry.targetId || null,
  };

  try {
    const listRef = database.ref("systemHealth/notificationFailures");
    const newRef = listRef.push();
    await newRef.set(payload);

    // Cap list size (best-effort): keep the newest FAILURE_CAP entries.
    const snap = await listRef.limitToLast(FAILURE_CAP + 20).once("value");
    if (snap.exists()) {
      const rows = Object.entries(snap.val()).sort((a, b) => (a[1].at || 0) - (b[1].at || 0));
      if (rows.length > FAILURE_CAP) {
        const removals = {};
        rows.slice(0, rows.length - FAILURE_CAP).forEach(([key]) => {
          removals[key] = null;
        });
        await listRef.update(removals);
      }
    }
  } catch (err) {
    console.error("[systemHealth] notificationFailure write failed:", err.message);
  }
}

async function recordJobRun(jobId, { success, error, meta } = {}, options = {}) {
  const database = resolveDb(options.db);
  if (!database || !jobId) return;
  const now = Date.now();
  const update = {
    lastRunAt: now,
    status: success ? "ok" : "error",
    updatedAt: now,
  };
  if (success) {
    update.lastSuccessAt = now;
    update.lastError = null;
  } else {
    update.lastError = String(error || "unknown").slice(0, 500);
  }
  if (meta && typeof meta === "object") {
    update.lastMeta = meta;
  }
  try {
    await database.ref(`systemHealth/jobs/${jobId}`).update(update);
  } catch (err) {
    console.error(`[systemHealth] job ${jobId} write failed:`, err.message);
  }
}

/**
 * Summarize failures for the admin UI (pure).
 */
function summarizeNotificationFailures(failuresMap, now = Date.now()) {
  const rows = Object.entries(failuresMap || {}).map(([id, row]) => ({ id, ...row }));
  rows.sort((a, b) => (b.at || 0) - (a.at || 0));
  const day = 24 * 60 * 60 * 1000;
  const last24h = rows.filter((r) => now - (r.at || 0) <= day).length;
  const last7d = rows.filter((r) => now - (r.at || 0) <= 7 * day).length;
  return {
    recent: rows.slice(0, 20),
    count24h: last24h,
    count7d: last7d,
  };
}

function connectionLabelFromInfoConnected(connected, { everConnected = false } = {}) {
  if (connected === true) return "Online";
  if (connected === false && everConnected) return "Reconnecting";
  if (connected === false) return "Offline";
  return "Unknown";
}

module.exports = {
  FAILURE_CAP,
  inferSmsGatewayStatus,
  describeTextBeeCase,
  recordSmsGatewayResult,
  recordNotificationFailure,
  recordJobRun,
  summarizeNotificationFailures,
  connectionLabelFromInfoConnected,
};
