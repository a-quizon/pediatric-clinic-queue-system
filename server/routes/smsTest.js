const express = require("express");
const { sendSms, normalizePhoneE164, isSmsConfigured } = require("../services/smsService");

const router = express.Router();

/**
 * Dev/capstone SMS tester — sends a raw message via textbee.
 * Disabled in production unless SMS_TEST_SECRET is set and matched.
 *
 * POST /api/sms/test
 * Body: { phone: string, message?: string }
 */
router.post("/sms/test", async (req, res) => {
  const isProd = process.env.NODE_ENV === "production";
  const secret = (process.env.SMS_TEST_SECRET || "").trim();
  if (isProd) {
    const provided = req.headers["x-sms-test-secret"] || req.body?.secret;
    if (!secret || provided !== secret) {
      return res.status(403).json({
        success: false,
        message: "SMS tester is disabled in production without a valid SMS_TEST_SECRET.",
      });
    }
  }

  if (!isSmsConfigured()) {
    return res.status(503).json({
      success: false,
      message: "TEXTBEE_API_KEY is not configured in server/.env",
    });
  }

  const phone = normalizePhoneE164(req.body?.phone);
  if (!phone) {
    return res.status(400).json({
      success: false,
      message: "Provide a valid phone number (e.g. 9171234567 or +639171234567).",
    });
  }

  const message =
    (typeof req.body?.message === "string" && req.body.message.trim()) ||
    `Pediatric Clinic Queue — SMS test at ${new Date().toLocaleString("en-PH")}. If you received this, textbee is working.`;

  try {
    const result = await sendSms(phone, message);
    if (!result.success) {
      return res.status(502).json({
        success: false,
        message: "textbee rejected the send request.",
        reason: result.reason,
        details: result.data || result.error || null,
      });
    }
    return res.json({
      success: true,
      phone,
      message,
      provider: result.data || null,
    });
  } catch (err) {
    console.error("[smsTest]", err.message);
    return res.status(500).json({
      success: false,
      message: err.message || "SMS test failed.",
    });
  }
});

router.get("/sms/status", (_req, res) => {
  res.json({
    configured: isSmsConfigured(),
    hasDeviceId: Boolean((process.env.TEXTBEE_DEVICE_ID || "").trim()),
  });
});

module.exports = router;
