const { RESEND_COOLDOWN_MS, RESEND_COOLDOWN_SECONDS } = require("./resendCooldown");
const { getRtdb } = require("./rtdbRouter");

function getDb() {
  return getRtdb();
}

const COOLDOWN_MESSAGE = (waitSec) =>
  `Please wait ${waitSec}s before requesting another verification email.`;

function cooldownError(waitSec) {
  const err = new Error(COOLDOWN_MESSAGE(waitSec));
  err.code = "rate_limited";
  err.limitKind = "cooldown";
  err.retryAfterSeconds = waitSec;
  return err;
}

/**
 * Claim a short cooldown slot before sendEmailVerification.
 * Tracked per Firebase Auth uid under emailVerificationLimits/{uid}.
 */
async function claimEmailVerificationSlot(uid, deps = {}) {
  const userId = String(uid || "").trim();
  if (!userId) {
    const err = new Error("You must be signed in.");
    err.code = "auth_denied";
    throw err;
  }

  const db = deps.db || getDb();
  const now = typeof deps.now === "function" ? deps.now() : Date.now();
  const limitRef = db.ref(`emailVerificationLimits/${userId}`);

  let abortWaitSec = 0;

  const result = await limitRef.transaction((current) => {
    const prev = current && typeof current === "object" ? current : {};
    const lastSentAt = Number(prev.lastSentAt) || 0;
    if (lastSentAt > 0) {
      const age = now - lastSentAt;
      if (age < RESEND_COOLDOWN_MS) {
        abortWaitSec = Math.ceil((RESEND_COOLDOWN_MS - age) / 1000);
        return;
      }
    }
    return {
      uid: userId,
      lastSentAt: now,
      updatedAt: now,
    };
  });

  if (!result.committed) {
    if (abortWaitSec > 0) {
      throw cooldownError(abortWaitSec);
    }
    const snap = await limitRef.once("value");
    const stored = snap.val() || {};
    const lastSentAt = Number(stored.lastSentAt) || 0;
    if (lastSentAt > 0) {
      const age = now - lastSentAt;
      if (age < RESEND_COOLDOWN_MS) {
        throw cooldownError(Math.ceil((RESEND_COOLDOWN_MS - age) / 1000));
      }
    }
    throw cooldownError(RESEND_COOLDOWN_SECONDS);
  }

  return {
    success: true,
    cooldownSeconds: RESEND_COOLDOWN_SECONDS,
  };
}

module.exports = {
  claimEmailVerificationSlot,
  RESEND_COOLDOWN_SECONDS,
  RESEND_COOLDOWN_MS,
};
