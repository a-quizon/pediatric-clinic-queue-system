/** Shared resend cooldown for OTP, email verification, and password-reset emails. */
const RESEND_COOLDOWN_SECONDS = 30;
const RESEND_COOLDOWN_MS = RESEND_COOLDOWN_SECONDS * 1000;

/**
 * @param {number|null|undefined} lastSentAt
 * @param {number} [nowMs]
 * @returns {{ allowed: boolean, retryAfterSeconds: number }}
 */
function evaluateResendCooldown(lastSentAt, nowMs = Date.now()) {
  if (!lastSentAt) return { allowed: true, retryAfterSeconds: 0 };
  const age = nowMs - lastSentAt;
  if (age >= RESEND_COOLDOWN_MS) return { allowed: true, retryAfterSeconds: 0 };
  return {
    allowed: false,
    retryAfterSeconds: Math.ceil((RESEND_COOLDOWN_MS - age) / 1000),
  };
}

module.exports = {
  RESEND_COOLDOWN_SECONDS,
  RESEND_COOLDOWN_MS,
  evaluateResendCooldown,
};
