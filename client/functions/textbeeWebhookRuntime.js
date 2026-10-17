/**
 * TextBee webhook verification and delivery-status handling.
 * Docs: https://textbee.dev/docs/webhooks
 */

const crypto = require("crypto");
const {
  applySmsDeliveryUpdate,
  mapTextBeeStatusToOurs,
  maskPhoneE164,
} = require("./systemHealthRuntime");

function getWebhookSecret() {
  return (process.env.TEXTBEE_WEBHOOK_SECRET || "").trim();
}

/**
 * Verify X-Signature: HMAC-SHA256 of raw body bytes, lowercase hex.
 */
function verifyWebhookSignature(rawBody, signatureHeader, secret = getWebhookSecret()) {
  if (!secret || secret.length < 20) return false;
  if (!signatureHeader || rawBody == null) return false;
  const raw =
    Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(String(rawBody), "utf8");
  const expected = crypto.createHmac("sha256", secret).update(raw).digest("hex");
  const provided = String(signatureHeader).trim().toLowerCase();
  if (expected.length !== provided.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(expected, "utf8"), Buffer.from(provided, "utf8"));
  } catch {
    return false;
  }
}

function statusFromWebhookEvent(webhookEvent, payloadStatus) {
  const event = String(webhookEvent || "").toUpperCase();
  if (event === "MESSAGE_SENT") return "sent";
  if (event === "MESSAGE_DELIVERED") return "delivered";
  if (event === "MESSAGE_FAILED") return "failed";
  if (event === "UNKNOWN_STATE") {
    return mapTextBeeStatusToOurs(payloadStatus) || "queued";
  }
  return mapTextBeeStatusToOurs(payloadStatus);
}

/**
 * Process one TextBee webhook payload (already verified).
 */
async function handleTextBeeWebhookPayload(payload, options = {}) {
  if (!payload || typeof payload !== "object") {
    return { ok: false, status: 400, reason: "invalid_payload" };
  }

  const webhookEvent = payload.webhookEvent;
  if (webhookEvent === "MESSAGE_RECEIVED") {
    return { ok: true, status: 200, reason: "ignored_inbound" };
  }

  const nextStatus = statusFromWebhookEvent(webhookEvent, payload.status);
  if (!nextStatus) {
    return { ok: true, status: 200, reason: "ignored_event", webhookEvent };
  }

  const result = await applySmsDeliveryUpdate(
    {
      status: nextStatus,
      textbeeStatus: payload.status,
      smsId: payload.smsId || null,
      smsBatchId: payload.smsBatchId || null,
      recipient: payload.recipient || null,
      maskedRecipient: maskPhoneE164(payload.recipient),
      errorCode: payload.errorCode || null,
      errorMessage: payload.errorMessage || null,
      idempotencyKey: payload.idempotencyKey || null,
      messageType: options.messageType || null,
    },
    { db: options.db, now: options.now }
  );

  return {
    ok: true,
    status: 200,
    reason: result.reason || "applied",
    applied: result.applied,
    recordId: result.recordId || null,
    deliveryStatus: result.status || nextStatus,
  };
}

/**
 * Express-style handler helper: verify signature then apply.
 * @param {{ rawBody: Buffer|string, headers: object, body: object }} reqLike
 */
async function processTextBeeWebhookRequest(reqLike, options = {}) {
  const secret = getWebhookSecret();
  if (!secret) {
    console.error("[textbee-webhook] TEXTBEE_WEBHOOK_SECRET not configured");
    return { status: 503, body: { success: false, error: "webhook_not_configured" } };
  }

  const signature =
    reqLike.headers?.["x-signature"] ||
    reqLike.headers?.["X-Signature"] ||
    options.signature;
  const rawBody = reqLike.rawBody != null ? reqLike.rawBody : JSON.stringify(reqLike.body || {});

  if (!verifyWebhookSignature(rawBody, signature, secret)) {
    return { status: 401, body: { success: false, error: "invalid_signature" } };
  }

  const outcome = await handleTextBeeWebhookPayload(reqLike.body || {}, options);
  return {
    status: outcome.status || 200,
    body: {
      success: outcome.ok !== false,
      reason: outcome.reason,
      applied: outcome.applied,
      recordId: outcome.recordId,
      deliveryStatus: outcome.deliveryStatus,
    },
  };
}

module.exports = {
  getWebhookSecret,
  verifyWebhookSignature,
  statusFromWebhookEvent,
  handleTextBeeWebhookPayload,
  processTextBeeWebhookRequest,
};
