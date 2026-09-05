const express = require("express");
const { initFirebaseAdmin, verifyIdToken } = require("../services/firebaseAdmin");
const {
  sendLoginOtp,
  sendRegistrationOtp,
  sendUpdatePhoneOtp,
  verifyLoginOtp,
  verifyRegistrationOtp,
  verifyUpdatePhoneOtp,
  assertPhoneVerified,
  consumePhoneVerification,
} = require("../services/otpService");

const router = express.Router();

function mapOtpError(err) {
  const code = err.code || "internal";
  const statusByCode = {
    invalid_phone: 400,
    invalid_input: 400,
    user_not_found: 404,
    phone_in_use: 409,
    phone_not_verified: 403,
    rate_limited: 429,
    sms_failed: 502,
    otp_missing: 400,
    otp_expired: 400,
    otp_locked: 429,
    otp_mismatch: 401,
    otp_purpose_mismatch: 400,
    auth_failed: 401,
    auth_denied: 403,
  };
  return {
    status: statusByCode[code] || 500,
    code,
    message: err.message || "SMS authentication failed.",
    retryAfterSeconds: err.retryAfterSeconds,
  };
}

function sendError(res, err) {
  console.error("[smsAuth]", err.message);
  const mapped = mapOtpError(err);
  return res.status(mapped.status).json({
    success: false,
    error: mapped.code,
    message: mapped.message,
    ...(mapped.retryAfterSeconds != null
      ? { retryAfterSeconds: mapped.retryAfterSeconds }
      : {}),
  });
}

async function requireAuth(req, res) {
  const decoded = await verifyIdToken(req.headers.authorization);
  if (!decoded?.uid) {
    res.status(401).json({
      success: false,
      error: "auth_denied",
      message: "You must be signed in.",
    });
    return null;
  }
  return decoded;
}

/**
 * POST /api/auth/sms/send-otp
 * Body: { phone, purpose?: "login" | "register" | "update" }
 * purpose=update requires Bearer token
 */
router.post("/auth/sms/send-otp", async (req, res) => {
  try {
    initFirebaseAdmin();
    const purpose = ["register", "update"].includes(req.body?.purpose)
      ? req.body.purpose
      : "login";

    if (purpose === "update") {
      const decoded = await requireAuth(req, res);
      if (!decoded) return;
      const result = await sendUpdatePhoneOtp(req.body?.phone, decoded.uid);
      return res.json(result);
    }

    const result =
      purpose === "register"
        ? await sendRegistrationOtp(req.body?.phone)
        : await sendLoginOtp(req.body?.phone);
    return res.json(result);
  } catch (err) {
    return sendError(res, err);
  }
});

/**
 * POST /api/auth/sms/verify-otp
 * Body: { phone, code, purpose?: "login" | "register" | "update" }
 */
router.post("/auth/sms/verify-otp", async (req, res) => {
  try {
    initFirebaseAdmin();
    const purpose = ["register", "update"].includes(req.body?.purpose)
      ? req.body.purpose
      : "login";

    if (purpose === "update") {
      const decoded = await requireAuth(req, res);
      if (!decoded) return;
      const result = await verifyUpdatePhoneOtp(req.body?.phone, req.body?.code, decoded.uid);
      return res.json(result);
    }

    const result =
      purpose === "register"
        ? await verifyRegistrationOtp(req.body?.phone, req.body?.code)
        : await verifyLoginOtp(req.body?.phone, req.body?.code);
    return res.json(result);
  } catch (err) {
    return sendError(res, err);
  }
});

/**
 * POST /api/auth/sms/assert-phone-verified
 * Body: { phone, verificationId, purpose? }
 * purpose=update requires Bearer token
 */
router.post("/auth/sms/assert-phone-verified", async (req, res) => {
  try {
    initFirebaseAdmin();
    const purpose = req.body?.purpose || null;
    const options = {};
    if (purpose) options.purpose = purpose;
    if (purpose === "update") {
      const decoded = await requireAuth(req, res);
      if (!decoded) return;
      options.uid = decoded.uid;
    }
    const result = await assertPhoneVerified(
      req.body?.phone,
      req.body?.verificationId,
      options
    );
    return res.json(result);
  } catch (err) {
    return sendError(res, err);
  }
});

/**
 * POST /api/auth/sms/consume-phone-verification
 * Body: { phone, verificationId, purpose? }
 */
router.post("/auth/sms/consume-phone-verification", async (req, res) => {
  try {
    initFirebaseAdmin();
    const purpose = req.body?.purpose || null;
    const options = {};
    if (purpose) options.purpose = purpose;
    if (purpose === "update") {
      const decoded = await requireAuth(req, res);
      if (!decoded) return;
      options.uid = decoded.uid;
    }
    const result = await consumePhoneVerification(
      req.body?.phone,
      req.body?.verificationId,
      options
    );
    return res.json(result);
  } catch (err) {
    return sendError(res, err);
  }
});

module.exports = router;
