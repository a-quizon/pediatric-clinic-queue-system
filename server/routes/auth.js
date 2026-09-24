const express = require("express");
const { initFirebaseAdmin, getDb } = require("../services/firebaseAdmin");
const { resolveAccountByIdentifier } = require("../services/phoneLookup");
const { claimPasswordResetSlot } = require("../services/passwordResetLimitService");
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

function mapAuthHelperError(err) {
  const code = err.code || "internal";
  const statusByCode = {
    invalid_input: 400,
    invalid_email: 400,
    user_not_found: 404,
    rate_limited: 429,
  };
  return {
    status: statusByCode[code] || 500,
    code,
    message: err.message || "Request failed.",
  };
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
    const mapped = mapAuthHelperError(err);
    return res.status(mapped.status).json({
      success: false,
      error: mapped.code,
      message: mapped.message || "Unable to resolve login identifier.",
    });
  }
});

/**
 * POST /api/auth/password-reset/claim
 * Body: { email }
 * Consumes one daily reset slot (Asia/Manila) before sendPasswordResetEmail.
 */
router.post("/auth/password-reset/claim", passwordResetClaimLimiter, async (req, res) => {
  try {
    initFirebaseAdmin();
    const result = await claimPasswordResetSlot(req.body?.email);
    return res.json(result);
  } catch (err) {
    if (err.code !== "rate_limited" && err.code !== "invalid_email") {
      console.error("[auth] password-reset/claim:", err.message);
    }
    const mapped = mapAuthHelperError(err);
    return res.status(mapped.status).json({
      success: false,
      error: mapped.code,
      message: mapped.message,
    });
  }
});

module.exports = router;
