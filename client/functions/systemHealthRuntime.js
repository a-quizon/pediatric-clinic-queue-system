/**
 * System-health recording for Admin → System Health.
 * Server (Admin SDK) writes only; clients never write.
 */

const {
  DEGRADED_FAILURE_RATE_1H,
  DOWN_CONSECUTIVE_FAILURES,
  DOWN_NO_SUCCESS_WHILE_ATTEMPTING_MS,
  STUCK_QUEUED_MS,
  SMS_MESSAGE_CAP,
  SMS_WEBHOOK_KEY_CAP,
  SMS_STATUS_RANK,
  TERMINAL_SUCCESS,
  TERMINAL_STATUSES,
} = require("./smsHealthConfig");
const { explainSmsManagerResultCode } = require("./smsManagerResultCodes");

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

function maskPhoneE164(phone) {
  const s = String(phone || "").trim();
  if (!s) return "***";
  if (s.length <= 6) return "***";
  const start = s.startsWith("+") ? Math.min(4, s.length - 4) : Math.min(3, s.length - 4);
  return `${s.slice(0, start)}***${s.slice(-4)}`;
}

/**
 * Infer SMS gateway status from a send result (testable pure helper).
 * @returns {"ok"|"failing"|"unknown"|"not_configured"}
 */
function inferSmsGatewayStatus(result) {
  if (!result || typeof result !== "object") return "unknown";
  if (result.skipped && result.reason === "not_configured") return "not_configured";
  if (result.queued) return "unknown";
  if (result.success && !result.queued) return "ok";
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

function canTransitionSmsStatus(from, to) {
  if (!to) return false;
  if (!from || from === to) return true;
  if (from === "failed" || from === "delivered") return false;
  if (to === "failed") return true;
  const fromRank = SMS_STATUS_RANK[from];
  const toRank = SMS_STATUS_RANK[to];
  if (fromRank == null || toRank == null) return false;
  return toRank >= fromRank;
}

function mapTextBeeStatusToOurs(status) {
  const s = String(status || "").toLowerCase();
  if (s === "pending" || s === "dispatched") return "queued";
  if (s === "sent") return "sent";
  if (s === "delivered") return "delivered";
  if (s === "failed") return "failed";
  if (s === "unknown" || s === "delivery_failed") return "queued";
  return null;
}

/**
 * Pure: Healthy / Degraded / Down from delivery records.
 */
function computeSmsServiceStatus(messages, now = Date.now()) {
  const rows = Array.isArray(messages) ? messages : [];
  const stuck = rows.filter(
    (m) => m.status === "queued" && now - Number(m.createdAt || 0) > STUCK_QUEUED_MS
  );

  const hourAgo = now - 60 * 60 * 1000;
  const lastHourTerminal = rows.filter(
    (m) =>
      TERMINAL_STATUSES.has(m.status) && now - Number(m.updatedAt || m.createdAt || 0) <= 60 * 60 * 1000
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
    hourAgo,
  };
}

async function loadSmsMessages(database, limit = SMS_MESSAGE_CAP) {
  const snap = await database.ref("systemHealth/smsMessages").limitToLast(limit).once("value");
  if (!snap.exists()) return [];
  return Object.entries(snap.val()).map(([id, row]) => ({ id, ...row }));
}

async function capSmsMessages(database) {
  const listRef = database.ref("systemHealth/smsMessages");
  const snap = await listRef.limitToLast(SMS_MESSAGE_CAP + 40).once("value");
  if (!snap.exists()) return;
  const rows = Object.entries(snap.val()).sort(
    (a, b) => Number(a[1].createdAt || 0) - Number(b[1].createdAt || 0)
  );
  if (rows.length <= SMS_MESSAGE_CAP) return;
  const removals = {};
  const drop = rows.slice(0, rows.length - SMS_MESSAGE_CAP);
  for (const [key, row] of drop) {
    removals[key] = null;
    if (row.textbeeBatchId) {
      await database.ref(`systemHealth/smsByBatchId/${row.textbeeBatchId}`).remove().catch(() => {});
    }
    if (row.textbeeSmsId) {
      await database.ref(`systemHealth/smsBySmsId/${row.textbeeSmsId}`).remove().catch(() => {});
    }
  }
  await listRef.update(removals);
}

async function notifySmsServiceStatusChange(database, previousStatus, nextStatus, summary) {
  if (previousStatus === nextStatus) return;
  if (nextStatus !== "degraded" && nextStatus !== "down") return;

  const now = Date.now();
  const title = nextStatus === "down" ? "SMS service is Down" : "SMS service is Degraded";
  const body =
    nextStatus === "down"
      ? "TextBee SMS delivery is down. Check the gateway phone and System Health."
      : "TextBee SMS delivery is degraded. Review recent failures on System Health.";

  try {
    const auditRef = database.ref("auditLogs").push();
    await auditRef.set({
      action: "SMS_SERVICE_STATUS_CHANGED",
      category: "SYSTEM_MANAGEMENT",
      actorUid: "system",
      actorName: "System",
      actorRole: "system",
      description: `${title}: ${body}`,
      timestamp: now,
      metadata: {
        previousStatus,
        serviceStatus: nextStatus,
        failures24h: summary.failures24h,
        failureRate1h: summary.failureRate1h,
        stuckCount: summary.stuckCount,
      },
    });

    const debounceRef = database.ref("systemHealth/smsGateway/lastStatusAlert");
    const lastAlertSnap = await debounceRef.once("value");
    const lastAlert = lastAlertSnap.val() || {};
    if (
      lastAlert.serviceStatus === nextStatus &&
      now - Number(lastAlert.at || 0) < 30 * 60 * 1000
    ) {
      return;
    }

    const { listActiveAdminIds } = require("./suspiciousAccountRuntime");
    const adminIds = await listActiveAdminIds(database);
    for (const adminId of adminIds) {
      const alertRef = database.ref(`adminAlerts/${adminId}`).push();
      await alertRef.set({
        type: "SMS_SERVICE_STATUS",
        title,
        body,
        message: body,
        url: "/admin/system-health",
        serviceStatus: nextStatus,
        createdAt: now,
        read: false,
      });
    }
    await debounceRef.set({ serviceStatus: nextStatus, at: now });
  } catch (err) {
    console.error("[systemHealth] SMS status alert failed:", err.message);
  }
}

async function recomputeSmsGatewayAggregate(options = {}) {
  const database = resolveDb(options.db);
  if (!database) return null;
  const now = options.now || Date.now();
  const messages = await loadSmsMessages(database);
  const summary = computeSmsServiceStatus(messages, now);

  const gatewaySnap = await database.ref("systemHealth/smsGateway").once("value");
  const previous = gatewaySnap.val() || {};
  const previousStatus = previous.serviceStatus || null;

  const update = {
    serviceStatus: summary.serviceStatus,
    failureRate1h: Math.round(summary.failureRate1h * 1000) / 1000,
    failureRate24h: Math.round(summary.failureRate24h * 1000) / 1000,
    failures24h: summary.failures24h,
    stuckCount: summary.stuckCount,
    updatedAt: now,
  };
  if (summary.lastSuccessAt) {
    update.lastDeliveredOrSentAt = summary.lastSuccessAt;
    update.lastSuccessAt = summary.lastSuccessAt;
  }
  if (summary.lastFailureAt) {
    update.lastFailureAt = summary.lastFailureAt;
  }
  if (summary.lastFailure) {
    update.lastFailure = summary.lastFailure;
    update.lastFailureReason = summary.lastFailure.errorName || summary.lastFailure.errorCode || "failed";
    update.lastFailureDetail = summary.lastFailure.errorMessage || null;
  }
  if (summary.serviceStatus === "healthy") {
    update.inferredStatus = "ok";
  } else if (summary.serviceStatus === "down") {
    update.inferredStatus = "failing";
  } else if (summary.serviceStatus === "degraded") {
    update.inferredStatus = "failing";
  }

  await database.ref("systemHealth/smsGateway").update(update);
  await notifySmsServiceStatusChange(database, previousStatus, summary.serviceStatus, summary);
  return summary;
}

/**
 * Record HTTP-level gateway outcome. HTTP accept should pass queued:true
 * so we do not treat TextBee queue acceptance as delivery success.
 */
async function recordSmsGatewayResult(result, options = {}) {
  const database = resolveDb(options.db);
  if (!database) return;
  const now = Date.now();
  const inferredStatus = inferSmsGatewayStatus(result);
  const update = {
    inferredStatus,
    updatedAt: now,
  };

  if (result?.queued) {
    update.lastQueuedAt = now;
    update.lastQueuedHttpStatus = result.status || 200;
  } else if (result?.success && !result?.queued) {
    update.lastSuccessAt = now;
    update.lastSuccessHttpStatus = result.status || 200;
    update.lastDeliveredOrSentAt = now;
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
    update.serviceStatus = "down";
    update.inferredStatus = "not_configured";
  }

  try {
    await database.ref("systemHealth/smsGateway").update(update);
  } catch (err) {
    console.error("[systemHealth] smsGateway write failed:", err.message);
  }
}

async function createSmsDeliveryRecord(fields, options = {}) {
  const database = resolveDb(options.db);
  if (!database) return null;
  const now = Date.now();
  const listRef = database.ref("systemHealth/smsMessages");
  const newRef = listRef.push();
  const id = newRef.key;
  const record = {
    id,
    reservationId: fields.reservationId || null,
    branch: fields.branch || null,
    messageType: fields.messageType || "SMS",
    maskedRecipient: fields.maskedRecipient || maskPhoneE164(fields.recipient),
    textbeeSmsId: fields.textbeeSmsId || null,
    textbeeBatchId: fields.textbeeBatchId || null,
    status: fields.status || "queued",
    errorCode: fields.errorCode || null,
    errorName: fields.errorName || null,
    errorMessage: fields.errorMessage || null,
    createdAt: now,
    updatedAt: now,
  };

  try {
    await newRef.set(record);
    const indexUpdates = {};
    if (record.textbeeBatchId) {
      indexUpdates[`systemHealth/smsByBatchId/${record.textbeeBatchId}`] = id;
    }
    if (record.textbeeSmsId) {
      indexUpdates[`systemHealth/smsBySmsId/${record.textbeeSmsId}`] = id;
    }
    if (Object.keys(indexUpdates).length) {
      await database.ref().update(indexUpdates);
    }
    await capSmsMessages(database);
    await recomputeSmsGatewayAggregate({ db: database, now });
    return record;
  } catch (err) {
    console.error("[systemHealth] createSmsDeliveryRecord failed:", err.message);
    return null;
  }
}

async function findSmsRecordId(database, { smsId, smsBatchId } = {}) {
  if (smsId) {
    const snap = await database.ref(`systemHealth/smsBySmsId/${smsId}`).once("value");
    if (snap.exists()) return snap.val();
  }
  if (smsBatchId) {
    const snap = await database.ref(`systemHealth/smsByBatchId/${smsBatchId}`).once("value");
    if (snap.exists()) return snap.val();
  }
  return null;
}

/**
 * Apply a delivery status update to an existing (or newly created) SMS record.
 * Idempotent when options.idempotencyKey was already processed.
 */
async function applySmsDeliveryUpdate(update, options = {}) {
  const database = resolveDb(options.db);
  if (!database) return { applied: false, reason: "no_db" };
  const now = options.now || Date.now();
  const idempotencyKey = update.idempotencyKey || options.idempotencyKey || null;

  if (idempotencyKey) {
    const keyRef = database.ref(`systemHealth/smsWebhookKeys/${idempotencyKey}`);
    const existing = await keyRef.once("value");
    if (existing.exists()) {
      return { applied: false, reason: "duplicate", idempotencyKey };
    }
  }

  const nextStatus = update.status || mapTextBeeStatusToOurs(update.textbeeStatus);
  if (!nextStatus) {
    return { applied: false, reason: "unknown_status" };
  }

  let recordId = await findSmsRecordId(database, {
    smsId: update.smsId || update.textbeeSmsId,
    smsBatchId: update.smsBatchId || update.textbeeBatchId,
  });

  let current = null;
  if (recordId) {
    const snap = await database.ref(`systemHealth/smsMessages/${recordId}`).once("value");
    current = snap.exists() ? { id: recordId, ...snap.val() } : null;
  }

  if (current && !canTransitionSmsStatus(current.status, nextStatus)) {
    if (idempotencyKey) {
      await database.ref(`systemHealth/smsWebhookKeys/${idempotencyKey}`).set({
        at: now,
        smsId: update.smsId || null,
        skipped: "no_transition",
      });
    }
    return { applied: false, reason: "no_transition", recordId, status: current.status };
  }

  const explained =
    nextStatus === "failed"
      ? explainSmsManagerResultCode(update.errorCode)
      : null;

  if (!current) {
    const created = await createSmsDeliveryRecord(
      {
        reservationId: update.reservationId || null,
        branch: update.branch || null,
        messageType: update.messageType || "SMS",
        recipient: update.recipient,
        maskedRecipient: update.maskedRecipient || maskPhoneE164(update.recipient),
        textbeeSmsId: update.smsId || update.textbeeSmsId || null,
        textbeeBatchId: update.smsBatchId || update.textbeeBatchId || null,
        status: nextStatus,
        errorCode: explained?.code || update.errorCode || null,
        errorName: explained?.name || null,
        errorMessage:
          update.errorMessage ||
          (explained ? `${explained.explanation} ${explained.suggestedFix}` : null),
      },
      { db: database }
    );
    recordId = created?.id || null;
  } else {
    const patch = {
      status: nextStatus,
      updatedAt: now,
    };
    if (update.smsId || update.textbeeSmsId) {
      patch.textbeeSmsId = update.smsId || update.textbeeSmsId;
    }
    if (update.smsBatchId || update.textbeeBatchId) {
      patch.textbeeBatchId = update.smsBatchId || update.textbeeBatchId;
    }
    if (nextStatus === "failed" && explained) {
      patch.errorCode = explained.code;
      patch.errorName = explained.name;
      patch.errorMessage =
        update.errorMessage || `${explained.explanation} ${explained.suggestedFix}`;
    }
    await database.ref(`systemHealth/smsMessages/${recordId}`).update(patch);
    if (patch.textbeeSmsId) {
      await database.ref(`systemHealth/smsBySmsId/${patch.textbeeSmsId}`).set(recordId);
    }
  }

  if (idempotencyKey) {
    await database.ref(`systemHealth/smsWebhookKeys/${idempotencyKey}`).set({
      at: now,
      smsId: update.smsId || null,
      recordId,
    });
    try {
      const keysRef = database.ref("systemHealth/smsWebhookKeys");
      const keysSnap = await keysRef.limitToLast(SMS_WEBHOOK_KEY_CAP + 50).once("value");
      if (keysSnap.exists()) {
        const entries = Object.entries(keysSnap.val()).sort(
          (a, b) => Number(a[1].at || 0) - Number(b[1].at || 0)
        );
        if (entries.length > SMS_WEBHOOK_KEY_CAP) {
          const removals = {};
          entries.slice(0, entries.length - SMS_WEBHOOK_KEY_CAP).forEach(([key]) => {
            removals[key] = null;
          });
          await keysRef.update(removals);
        }
      }
    } catch (_) {
      /* best-effort cap */
    }
  }

  if (nextStatus === "failed") {
    const explainedFail = explainSmsManagerResultCode(update.errorCode);
    await recordNotificationFailure(
      {
        channel: "sms",
        error: `delivery_failed:${explainedFail.code}:${explainedFail.name}`,
        notificationType: update.messageType || current?.messageType || "SMS",
        targetId: update.reservationId || current?.reservationId || null,
      },
      { db: database }
    );
  }

  await recomputeSmsGatewayAggregate({ db: database, now });
  return { applied: true, recordId, status: nextStatus };
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

function summarizeSmsMessages(messagesMap, now = Date.now()) {
  const rows = Object.entries(messagesMap || {}).map(([id, row]) => ({ id, ...row }));
  return computeSmsServiceStatus(rows, now);
}

module.exports = {
  FAILURE_CAP,
  maskPhoneE164,
  inferSmsGatewayStatus,
  describeTextBeeCase,
  canTransitionSmsStatus,
  mapTextBeeStatusToOurs,
  computeSmsServiceStatus,
  recordSmsGatewayResult,
  createSmsDeliveryRecord,
  applySmsDeliveryUpdate,
  recomputeSmsGatewayAggregate,
  recordNotificationFailure,
  recordJobRun,
  summarizeNotificationFailures,
  summarizeSmsMessages,
  connectionLabelFromInfoConnected,
  loadSmsMessages,
};
