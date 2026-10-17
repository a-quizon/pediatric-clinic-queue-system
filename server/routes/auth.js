const express = require("express");
const { initFirebaseAdmin, getDb, verifyIdToken } = require("../services/firebaseAdmin");
const { resolveAccountByIdentifier } = require("../services/phoneLookup");
const { claimPasswordResetSlot } = require("../services/passwordResetLimitService");
const { claimEmailVerificationSlot } = require("../services/emailVerificationLimitService");
const { createRateLimiter, clientIp } = require("../middleware/rateLimit");

const router = express.Router();

const resolveIdentifierLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 30,
  keyFn: (req) => `resolve:${clientIp(req)}`,
  message: "Too many login lookups. Please wait and try again.",
});

const passwordResetClaimLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 20,
  keyFn: (req) => `reset:${clientIp(req)}`,
  message: "Too many password reset attempts. Please wait and try again.",
});

const emailVerificationClaimLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 30,
  keyFn: (req) => `emailVerify:${clientIp(req)}`,
  message: "Too many verification email requests. Please wait and try again.",
});

function mapAuthHelperError(err) {
  const code = err.code || "internal";
  const statusByCode = {
    invalid_input: 400,
    invalid_email: 400,
    user_not_found: 404,
    auth_denied: 403,
    rate_limited: 429,
  };
  return {
    status: statusByCode[code] || 500,
    code,
    message: err.message || "Request failed.",
    retryAfterSeconds: err.retryAfterSeconds,
  };
}

function sendMappedError(res, err) {
  const mapped = mapAuthHelperError(err);
  if (mapped.status === 429 && mapped.retryAfterSeconds != null) {
    res.set("Retry-After", String(mapped.retryAfterSeconds));
  }
  return res.status(mapped.status).json({
    success: false,
    error: mapped.code,
    message: mapped.message,
    ...(mapped.retryAfterSeconds != null
      ? { retryAfterSeconds: mapped.retryAfterSeconds }
      : {}),
  });
}

/**
 * POST /api/auth/resolve-identifier
 * Body: { identifier: string }
 * Resolves email or phone → Firebase Auth email for password login.
 * Phone matching accepts +63 / 09 / 9… legacy formats and phone|phoneNumber fields.
 */
router.post("/auth/resolve-identifier", resolveIdentifierLimiter, async (req, res) => {
  try {
    initFirebaseAdmin();
    const resolved = await resolveAccountByIdentifier(getDb(), req.body?.identifier);
    return res.json({
      success: true,
      type: resolved.type,
      email: resolved.email,
    });
  } catch (err) {
    console.error("[auth] resolve-identifier:", err.message);
    return sendMappedError(res, err);
  }
});

/**
 * POST /api/auth/password-reset/claim
 * Body: { email }
 * Consumes one daily reset slot (Asia/Manila) before sendPasswordResetEmail.
 * Also enforces a short resend cooldown (Retry-After / retryAfterSeconds on 429).
 */
router.post("/auth/password-reset/claim", passwordResetClaimLimiter, async (req, res) => {
  try {
    initFirebaseAdmin();
    const result = await claimPasswordResetSlot(req.body?.email);
    return res.json(result);
  } catch (err) {
    if (err.code !== "rate_limited" && err.code !== "invalid_email" && err.code !== "auth_denied") {
      console.error("[auth] password-reset/claim:", err.message);
    }
    return sendMappedError(res, err);
  }
});

/**
 * POST /api/auth/email-verification/claim
 * Requires Bearer token. Claims a short cooldown slot before sendEmailVerification.
 */
router.post("/auth/email-verification/claim", emailVerificationClaimLimiter, async (req, res) => {
  try {
    initFirebaseAdmin();
    const decoded = await verifyIdToken(req.headers.authorization);
    if (!decoded?.uid) {
      return res.status(401).json({
        success: false,
        error: "auth_denied",
        message: "You must be signed in.",
      });
    }
    const result = await claimEmailVerificationSlot(decoded.uid);
    return res.json(result);
  } catch (err) {
    if (err.code !== "rate_limited" && err.code !== "auth_denied") {
      console.error("[auth] email-verification/claim:", err.message);
    }
    return sendMappedError(res, err);
  }
});

module.exports = router;
