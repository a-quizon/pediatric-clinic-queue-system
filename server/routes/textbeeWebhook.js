/**
 * TextBee delivery status webhooks (local Express mirror of Functions apiApp).
 */

const express = require("express");
const { processTextBeeWebhookRequest } = require("../../client/functions/textbeeWebhookRuntime");
const { getDb } = require("../services/firebaseAdmin");

const router = express.Router();

router.post("/webhooks/textbee", async (req, res) => {
  try {
    const outcome = await processTextBeeWebhookRequest(req, { db: getDb() });
    return res.status(outcome.status).json(outcome.body);
  } catch (err) {
    console.error("[sms] textbee webhook failed:", err.message);
    return res.status(500).json({ success: false, error: "webhook_handler_error" });
  }
});

module.exports = router;
