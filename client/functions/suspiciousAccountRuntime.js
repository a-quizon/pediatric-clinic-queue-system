const { manilaDateString } = require("./manilaDate");
const { SUSPICIOUS_FLAG_STATUS } = require("./suspiciousAccountConfig");
const {
  evaluateSuspiciousRules,
  buildSuspiciousRecommendation,
  canFlagAccount,
} = require("./suspiciousAccountRules");

const { getRtdb } = require("./rtdbRouter");

/**
 * `options.db` / `options.sendPush` let the Express mirror reuse this runtime with its own
 * firebase-admin instance and push sender. Cloud Functions use the defaults.
 */
function resolveDb(options = {}) {
  return options.db || getRtdb();
}

function resolveSendPush(options = {}) {
  if (typeof options.sendPush === "function") return options.sendPush;
  return require("./pushRuntime").sendPushToAdmin;
}

function auditLogsUrl(auditLogId) {
  return auditLogId
    ? `/admin/audit-logs?highlight=${encodeURIComponent(auditLogId)}`
    : "/admin/audit-logs";
}

async function loadParentReservations(database, parentId) {
  const snap = await database
    .ref("reservations")
    .orderByChild("parentId")
    .equalTo(parentId)
    .once("value");
  if (!snap.exists()) return [];
  const list = [];
  snap.forEach((child) => {
    list.push({ id: child.key, ...child.val() });
  });
  return list;
}

async function loadSchedulesById(database, reservations) {
  const ids = [...new Set(reservations.map((r) => r.scheduleId).filter(Boolean))];
  const schedulesById = {};
  await Promise.all(
    ids.map(async (scheduleId) => {
      const snap = await database.ref(`schedules/${scheduleId}`).once("value");
      if (snap.exists()) schedulesById[scheduleId] = snap.val();
    })
  );
  return schedulesById;
}

async function listActiveAdminIds(database) {
  const snap = await database.ref("users").once("value");
  if (!snap.exists()) return [];
  const ids = [];
  snap.forEach((child) => {
    const user = child.val() || {};
    if (user.role === "admin" && user.status === "active" && user.isDeleted !== true) {
      ids.push(child.key);
    }
  });
  return ids;
}

async function writeSystemAuditLog(database, entry) {
  const ref = database.ref("auditLogs").push();
  await ref.set({
    ...entry,
    timestamp: entry.timestamp || Date.now(),
  });
  return ref.key;
}

async function notifyAdmins({ parentName, parentId, auditLogId, recommendation }, options = {}) {
  const database = resolveDb(options);
  const sendPush = resolveSendPush(options);
  const adminIds = await listActiveAdminIds(database);
  const title = "Suspicious account detected";
  const body = `Suspicious account detected: ${parentName}`;
  const url = auditLogsUrl(auditLogId);
  const now = Date.now();
  const dedupeKey = `suspicious_${parentId}_${auditLogId || now}`;

  const results = [];
  for (const adminId of adminIds) {
    const alertRef = database.ref(`adminAlerts/${adminId}`).push();
    await alertRef.set({
      type: "SUSPICIOUS_ACCOUNT",
      title,
      body,
      message: body,
      url,
      parentId,
      auditLogId: auditLogId || null,
      recommendation: recommendation || null,
      createdAt: now,
      read: false,
    });

    let pushResult = null;
    try {
      pushResult = await sendPush(adminId, {
        title,
        body,
        message: body,
        type: "SUSPICIOUS_ACCOUNT",
        url,
        dedupeKey,
        id: dedupeKey,
      }, dedupeKey);
    } catch (err) {
      console.error(`notifyAdmins: push failed for ${adminId}:`, err.message);
    }
    results.push({ adminId, pushResult, alertId: alertRef.key });
  }
  return results;
}

/**
 * Evaluate one parent and flag + notify when rules fire and flag is not already open.
 * The flag is claimed in a transaction so concurrent evaluators (Cloud Functions and the
 * Express mirror) produce one audit entry and one round of admin alerts.
 */
async function evaluateAndFlagParent(parentId, options = {}) {
  if (!parentId) return { flagged: false, reason: "missing_parent" };
  const database = resolveDb(options);

  const userSnap = await database.ref(`users/${parentId}`).once("value");
  if (!userSnap.exists()) return { flagged: false, reason: "user_not_found" };
  const parent = userSnap.val() || {};
  if (parent.role !== "parent" || parent.isDeleted === true) {
    return { flagged: false, reason: "not_parent" };
  }

  const reservations = await loadParentReservations(database, parentId);
  const schedulesById = await loadSchedulesById(database, reservations);
  const evaluation = evaluateSuspiciousRules(reservations, {
    todayManila: options.todayManila || manilaDateString(),
    schedulesById,
  });

  if (!canFlagAccount(evaluation, parent.suspiciousFlag)) {
    return {
      flagged: false,
      reason: evaluation.triggered ? "already_open_or_no_new_evidence" : "rules_not_met",
      evaluation,
    };
  }

  const now = Date.now();
  const parentName = parent.name || parent.email || "Parent";
  const recommendation = buildSuspiciousRecommendation(parentName, evaluation);

  const flagPayload = {
    isSuspicious: true,
    status: SUSPICIOUS_FLAG_STATUS.OPEN,
    rulesTriggered: evaluation.rulesTriggered,
    evidence: evaluation.evidence,
    recommendation,
    flaggedAt: now,
    updatedAt: now,
    reviewedAt: null,
    reviewedBy: null,
  };

  const claim = await database.ref(`users/${parentId}/suspiciousFlag`).transaction((current) => {
    if (!canFlagAccount(evaluation, current)) return undefined;
    return flagPayload;
  });
  if (!claim.committed) {
    return { flagged: false, reason: "already_open_or_no_new_evidence", evaluation };
  }
  await database.ref(`users/${parentId}/updatedAt`).set(now);

  const auditLogId = await writeSystemAuditLog(database, {
    action: "ACCOUNT_FLAGGED_SUSPICIOUS",
    category: "user_management",
    actorUid: "system",
    actorName: "System",
    actorRole: "system",
    description: `Suspicious account detected: ${parentName}`,
    targetType: "user",
    targetId: parentId,
    badge: "Suspicious",
    recommendation,
    reviewStatus: SUSPICIOUS_FLAG_STATUS.OPEN,
    metadata: {
      parentName,
      parentId,
      rulesTriggered: evaluation.rulesTriggered,
      evidence: evaluation.evidence,
      summary: evaluation.summary,
    },
    timestamp: now,
  });

  let notifyResults = [];
  try {
    notifyResults = await notifyAdmins({
      parentName,
      parentId,
      auditLogId,
      recommendation,
    }, options);
  } catch (err) {
    console.error("evaluateAndFlagParent: notifyAdmins failed", err.message);
  }

  return {
    flagged: true,
    parentId,
    auditLogId,
    evaluation,
    recommendation,
    notifyResults,
  };
}

/**
 * Nightly / on-demand sweep: evaluate every parent who has at least one reservation.
 */
async function evaluateAllSuspiciousParents(options = {}) {
  const database = resolveDb(options);
  const snap = await database.ref("reservations").once("value");
  if (!snap.exists()) return { evaluated: 0, flagged: 0, results: [] };

  const parentIds = new Set();
  snap.forEach((child) => {
    const val = child.val() || {};
    if (val.parentId && val.source !== "walk_in") parentIds.add(val.parentId);
  });

  const results = [];
  let flagged = 0;
  for (const parentId of parentIds) {
    try {
      const result = await evaluateAndFlagParent(parentId, options);
      results.push(result);
      if (result.flagged) flagged += 1;
    } catch (err) {
      console.error(`evaluateAllSuspiciousParents failed for ${parentId}:`, err.message);
      results.push({ flagged: false, parentId, reason: "error", error: err.message });
    }
  }

  return { evaluated: parentIds.size, flagged, results };
}

/**
 * Hook for reservation writes: when a reservation becomes a terminal no-show signal, re-evaluate parent.
 */
async function maybeEvaluateAfterReservationChange(before, after, options = {}) {
  if (!after?.parentId || after.source === "walk_in") return null;
  const beforeStatus = before?.status;
  const afterStatus = after.status;
  const becameTerminalNoShow =
    afterStatus !== beforeStatus &&
    (afterStatus === "forfeited" ||
      afterStatus === "expired" ||
      afterStatus === "validation_expired");

  if (!becameTerminalNoShow) return null;
  return evaluateAndFlagParent(after.parentId, options);
}

module.exports = {
  evaluateAndFlagParent,
  evaluateAllSuspiciousParents,
  maybeEvaluateAfterReservationChange,
  notifyAdmins,
  listActiveAdminIds,
};
