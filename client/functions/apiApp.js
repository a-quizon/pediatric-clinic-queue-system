/**
 * HTTPS Express app for Hosting /api/** rewrites.
 * Mirrors server SMS auth + identifier resolve endpoints.
 */
const express = require("express");
const cors = require("cors");
const admin = require("firebase-admin");
const {
  sendLoginOtp,
  sendRegistrationOtp,
  sendUpdatePhoneOtp,
  verifyLoginOtp,
  verifyRegistrationOtp,
  verifyUpdatePhoneOtp,
  assertPhoneVerified,
  consumePhoneVerification,
} = require("./otpService");
const { resolveAccountByIdentifier } = require("./phoneLookup");

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
  console.error("[functions/api]", err.message);
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

async function verifyIdToken(authHeader) {
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) return null;
  try {
    return await admin.auth().verifyIdToken(token);
  } catch (err) {
    console.error("[functions/api] ID token verification failed:", err.message);
    return null;
  }
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

function createApiApp() {
  const app = express();
  app.use(cors({ origin: true }));
  app.use(express.json({ limit: "256kb" }));

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", service: "functions-api" });
  });

  app.post("/api/auth/resolve-identifier", async (req, res) => {
    try {
      const resolved = await resolveAccountByIdentifier(
        admin.database(),
        req.body?.identifier
      );
      return res.json({
        success: true,
        type: resolved.type,
        email: resolved.email,
      });
    } catch (err) {
      console.error("[functions/api] resolve-identifier:", err.message);
      const statusByCode = {
        invalid_input: 400,
        user_not_found: 404,
      };
      return res.status(statusByCode[err.code] || 500).json({
        success: false,
        error: err.code || "internal",
        message: err.message || "Unable to resolve login identifier.",
      });
    }
  });

  app.post("/api/auth/sms/send-otp", async (req, res) => {
    try {
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

  app.post("/api/auth/sms/verify-otp", async (req, res) => {
    try {
      const purpose = ["register", "update"].includes(req.body?.purpose)
        ? req.body.purpose
        : "login";

      if (purpose === "update") {
        const decoded = await requireAuth(req, res);
        if (!decoded) return;
        const result = await verifyUpdatePhoneOtp(
          req.body?.phone,
          req.body?.code,
          decoded.uid
        );
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

  app.post("/api/auth/sms/assert-phone-verified", async (req, res) => {
    try {
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

  app.post("/api/auth/sms/consume-phone-verification", async (req, res) => {
    try {
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

  return app;
}

module.exports = { createApiApp };
