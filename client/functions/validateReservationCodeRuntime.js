/**
 * Server-side reservation-code lookup with rate limiting for manual entry.
 * Shared by Cloud Functions (apiApp) and the Express mirror.
 *
 * Rule (documented in SystemBusinessRules):
 * - Scope: failed manual lookups (code not found)
 * - Key: secretary uid + assignedBranch
 * - Allowance: 5 failures per rolling 15 minutes
 * - Lockout: 15 minutes from the attempt that crossed the limit
 */

const { databaseFor } = require("./rtdbRouter");
const { listActiveAdminIds } = require("./suspiciousAccountRuntime");

const MAX_FAILED_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;
const LOCKOUT_MS = 15 * 60 * 1000;
const RATE_LIMIT_PATH = (uid) => `rateLimits/manualCode/${uid}`;

function coded(code, message, extra = {}) {
  const error = new Error(message);
  error.code = code;
  Object.assign(error, extra);
  return error;
}

function maskReservationCode(code) {
  const s = String(code || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  if (s.length < 2) return "******";
  const middle = Math.max(4, s.length - 2);
  return `${s[0]}${"*".repeat(middle)}${s[s.length - 1]}`;
}

/**
 * Pure rate-limit evaluation (testable without RTDB).
 * @param {object|null} state existing rateLimits/manualCode/{uid} value
 * @param {number} now Date.now()
 * @returns {{ allowed: boolean, locked: boolean, failCount: number, windowStartedAt: number|null, lockedUntil: number|null, remainingAttempts: number }}
 */
function evaluateManualCodeRateLimit(state, now = Date.now()) {
  const lockedUntil = Number(state?.lockedUntil) || 0;
  if (lockedUntil > now) {
    return {
      allowed: false,
      locked: true,
      failCount: Number(state?.failCount) || 0,
      windowStartedAt: Number(state?.windowStartedAt) || null,
      lockedUntil,
      remainingAttempts: 0,
    };
  }

  const windowStartedAt = Number(state?.windowStartedAt) || 0;
  const failCount = Number(state?.failCount) || 0;
  const windowActive = windowStartedAt > 0 && now - windowStartedAt < WINDOW_MS;

  if (!windowActive) {
    return {
      allowed: true,
      locked: false,
      failCount: 0,
      windowStartedAt: null,
      lockedUntil: null,
      remainingAttempts: MAX_FAILED_ATTEMPTS,
    };
  }

  const remaining = Math.max(0, MAX_FAILED_ATTEMPTS - failCount);
  return {
    allowed: remaining > 0,
    locked: false,
    failCount,
    windowStartedAt,
    lockedUntil: null,
    remainingAttempts: remaining,
  };
}

/**
 * After a failed attempt, compute the next persisted state.
 */
function nextFailedAttemptState(state, now, branchId) {
  const current = evaluateManualCodeRateLimit(state, now);
  if (current.locked) {
    return {
      failCount: current.failCount,
      windowStartedAt: current.windowStartedAt || now,
      lockedUntil: current.lockedUntil,
      branchId: branchId || state?.branchId || null,
      updatedAt: now,
      justLocked: false,
    };
  }

  const windowStartedAt = current.windowStartedAt || now;
  const failCount = (current.windowStartedAt ? current.failCount : 0) + 1;
  const justLocked = failCount >= MAX_FAILED_ATTEMPTS;
  return {
    failCount,
    windowStartedAt,
    lockedUntil: justLocked ? now + LOCKOUT_MS : null,
    branchId: branchId || state?.branchId || null,
    updatedAt: now,
    justLocked,
  };
}

async function writeQueueAudit(db, entry) {
  const auditRef = db.ref("auditLogs").push();
  await auditRef.set({
    timestamp: Date.now(),
    ...entry,
  });
  return auditRef.key;
}

async function notifyAdminsManualCodeLockout(db, { secretaryName, secretaryUid, branchId, auditLogId, maskedCode }) {
  const adminIds = await listActiveAdminIds(db);
  const title = "Manual code lockout";
  const body = `${secretaryName || "A secretary"} was locked out after repeated wrong reservation codes.`;
  const now = Date.now();
  const url = auditLogId ? `/admin/audit-logs?highlight=${auditLogId}` : "/admin/audit-logs";

  for (const adminId of adminIds) {
    const alertRef = db.ref(`adminAlerts/${adminId}`).push();
    await alertRef.set({
      type: "MANUAL_CODE_LOCKOUT",
      title,
      body,
      message: body,
      url,
      secretaryUid: secretaryUid || null,
      branchId: branchId || null,
      auditLogId: auditLogId || null,
      maskedCode: maskedCode || null,
      createdAt: now,
      read: false,
    });
  }
}

/**
 * @param {{ admin: object, callerUid: string, code: string, source?: "manual"|"qr" }} args
 * @returns {Promise<{ reservation: object|null, locked?: boolean, lockedUntil?: number|null, remainingAttempts?: number }>}
 */
async function validateReservationCode({ admin, callerUid, code, source = "manual" }) {
  if (!callerUid) {
    throw coded("unauthenticated", "You must be signed in.");
  }

  const normalized = String(code || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .trim();
  if (normalized.length !== 6) {
    throw coded("invalid-argument", "Enter the 6-character reservation code.");
  }

  const db = databaseFor(admin);
  const userSnap = await db.ref(`users/${callerUid}`).once("value");
  if (!userSnap.exists()) {
    throw coded("permission-denied", "Your account profile was not found.");
  }
  const user = userSnap.val();
  if (user.role !== "secretary" && user.role !== "doctor") {
    throw coded("permission-denied", "Only clinic staff can validate reservation codes.");
  }
  if (user.status && user.status !== "active") {
    throw coded("permission-denied", "Your account is not active.");
  }

  const branchId = user.assignedBranchId || user.assignedBranch || null;
  const now = Date.now();
  const isManual = source !== "qr";
  const rateRef = db.ref(RATE_LIMIT_PATH(callerUid));

  if (isManual) {
    const rateSnap = await rateRef.once("value");
    const rateState = rateSnap.exists() ? rateSnap.val() : null;
    const evaluation = evaluateManualCodeRateLimit(rateState, now);
    if (!evaluation.allowed) {
      const retryAfterMs = Math.max(0, (evaluation.lockedUntil || now) - now);
      throw coded(
        "resource-exhausted",
        "Too many incorrect codes. Try again after the lockout ends.",
        {
          lockedUntil: evaluation.lockedUntil,
          retryAfterSeconds: Math.ceil(retryAfterMs / 1000),
        }
      );
    }
  }

  const codeSnap = await db
    .ref("reservations")
    .orderByChild("reservationCode")
    .equalTo(normalized)
    .once("value");

  if (!codeSnap.exists()) {
    if (isManual) {
      const rateSnap = await rateRef.once("value");
      const rateState = rateSnap.exists() ? rateSnap.val() : null;
      const next = nextFailedAttemptState(rateState, now, branchId);
      const { justLocked, ...persist } = next;
      await rateRef.set(persist);

      const masked = maskReservationCode(normalized);
      const actorName = user.name || "Secretary";
      const failAuditId = await writeQueueAudit(db, {
        action: "MANUAL_CODE_FAILED",
        category: "queue_operations",
        actorUid: callerUid,
        actorName,
        actorRole: user.role || "secretary",
        description: `Failed manual reservation-code attempt (${masked}).`,
        targetType: "reservation_code",
        targetId: null,
        branchId,
        metadata: {
          maskedCode: masked,
          failCount: persist.failCount,
          remainingAttempts: Math.max(0, MAX_FAILED_ATTEMPTS - persist.failCount),
        },
      });

      if (justLocked) {
        const lockAuditId = await writeQueueAudit(db, {
          action: "MANUAL_CODE_LOCKED",
          category: "queue_operations",
          actorUid: callerUid,
          actorName,
          actorRole: user.role || "secretary",
          description: `Manual reservation-code entry locked for 15 minutes after repeated failures (${masked}).`,
          targetType: "reservation_code",
          targetId: null,
          branchId,
          metadata: {
            maskedCode: masked,
            failCount: persist.failCount,
            lockedUntil: persist.lockedUntil,
            relatedFailAuditId: failAuditId,
          },
        });
        try {
          await notifyAdminsManualCodeLockout(db, {
            secretaryName: actorName,
            secretaryUid: callerUid,
            branchId,
            auditLogId: lockAuditId,
            maskedCode: masked,
          });
        } catch (err) {
          console.error("[validateReservationCode] lockout alert failed:", err.message);
        }
        throw coded(
          "resource-exhausted",
          "Too many incorrect codes. Try again after the lockout ends.",
          {
            lockedUntil: persist.lockedUntil,
            retryAfterSeconds: Math.ceil(LOCKOUT_MS / 1000),
          }
        );
      }

      return {
        reservation: null,
        remainingAttempts: Math.max(0, MAX_FAILED_ATTEMPTS - persist.failCount),
      };
    }

    return { reservation: null };
  }

  const data = codeSnap.val();
  const [id, value] = Object.entries(data)[0];
  if (!id || !value?.scheduleId) {
    return { reservation: null };
  }

  // Successful lookup does not clear the fail window (avoids gaming); lockout only on failures.
  return {
    reservation: { id, ...value },
  };
}

module.exports = {
  MAX_FAILED_ATTEMPTS,
  WINDOW_MS,
  LOCKOUT_MS,
  maskReservationCode,
  evaluateManualCodeRateLimit,
  nextFailedAttemptState,
  validateReservationCode,
};
