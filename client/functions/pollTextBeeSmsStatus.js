/**
 * Poll TextBee for SMS still stuck in queued (fallback when webhooks are delayed).
 * Docs: GET /api/v1/gateway/messages?smsBatchId=...
 */

const TEXTBEE_API_BASE = "https://api.textbee.dev/api/v1/gateway";
const { STUCK_QUEUED_MS } = require("./smsHealthConfig");
const {
  loadSmsMessages,
  applySmsDeliveryUpdate,
  mapTextBeeStatusToOurs,
  recordJobRun,
} = require("./systemHealthRuntime");

function getDb(options = {}) {
  if (options.db) return options.db;
  try {
    const { getRtdb } = require("./rtdbRouter");
    return getRtdb();
  } catch {
    return null;
  }
}

function getApiKey() {
  return (process.env.TEXTBEE_API_KEY || "").trim();
}

function getDeviceId() {
  return (process.env.TEXTBEE_DEVICE_ID || "").trim();
}

async function fetchBatchMessages(smsBatchId, apiKey) {
  const url = new URL(`${TEXTBEE_API_BASE}/messages`);
  url.searchParams.set("smsBatchId", smsBatchId);
  url.searchParams.set("limit", "20");
  const response = await fetch(url.toString(), {
    headers: { "x-api-key": apiKey },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const err = new Error(`textbee messages ${response.status}`);
    err.status = response.status;
    err.data = data;
    throw err;
  }
  return Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
}

async function fetchSingleMessage(smsId, apiKey, deviceId) {
  if (!deviceId || !smsId) return null;
  const response = await fetch(`${TEXTBEE_API_BASE}/devices/${deviceId}/sms/${smsId}`, {
    headers: { "x-api-key": apiKey },
  });
  if (!response.ok) return null;
  const data = await response.json().catch(() => ({}));
  return data?.data || data || null;
}

/**
 * Poll stuck queued SMS records and apply TextBee status updates.
 */
async function pollTextBeeSmsStatus(options = {}) {
  const database = getDb(options);
  const now = options.now || Date.now();
  const apiKey = getApiKey();
  if (!database) {
    return { checked: 0, updated: 0, skipped: true, reason: "no_db" };
  }
  if (!apiKey) {
    await recordJobRun("pollTextBeeSmsStatus", {
      success: false,
      error: "not_configured",
    }, { db: database });
    return { checked: 0, updated: 0, skipped: true, reason: "not_configured" };
  }

  const messages = await loadSmsMessages(database);
  const stuck = messages.filter(
    (m) =>
      m.status === "queued" &&
      m.textbeeBatchId &&
      now - Number(m.createdAt || 0) > STUCK_QUEUED_MS
  );

  let updated = 0;
  const errors = [];
  const deviceId = getDeviceId();

  for (const row of stuck.slice(0, 40)) {
    try {
      const remoteMessages = await fetchBatchMessages(row.textbeeBatchId, apiKey);
      const match =
        remoteMessages.find((m) => m._id === row.textbeeSmsId) ||
        remoteMessages[0] ||
        (row.textbeeSmsId
          ? await fetchSingleMessage(row.textbeeSmsId, apiKey, deviceId)
          : null);
      if (!match) continue;

      const nextStatus = mapTextBeeStatusToOurs(match.status);
      if (!nextStatus || nextStatus === "queued") continue;

      const result = await applySmsDeliveryUpdate(
        {
          status: nextStatus,
          smsId: match._id || row.textbeeSmsId || null,
          smsBatchId: row.textbeeBatchId,
          recipient: match.recipient || match.to || null,
          errorCode: match.errorCode || null,
          errorMessage: match.errorMessage || null,
          messageType: row.messageType || null,
          reservationId: row.reservationId || null,
          idempotencyKey: `poll_${row.id}_${nextStatus}_${match.errorCode || "ok"}`,
        },
        { db: database, now }
      );
      if (result.applied) updated += 1;
    } catch (err) {
      errors.push(err.message);
      console.error("[pollTextBeeSmsStatus]", row.id, err.message);
    }
  }

  await recordJobRun(
    "pollTextBeeSmsStatus",
    {
      success: errors.length === 0,
      error: errors[0] || null,
      meta: { checked: stuck.length, updated, errors: errors.length },
    },
    { db: database }
  );

  return { checked: stuck.length, updated, errors: errors.length };
}

module.exports = {
  pollTextBeeSmsStatus,
  fetchBatchMessages,
};
