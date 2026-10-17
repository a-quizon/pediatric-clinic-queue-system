/**
 * Textbee.dev SMS gateway utility.
 * API key and optional device id come from environment variables only.
 */

const TEXTBEE_API_BASE = "https://api.textbee.dev/api/v1/gateway";

function getApiKey() {
  return (process.env.TEXTBEE_API_KEY || "").trim();
}

function getDeviceId() {
  return (process.env.TEXTBEE_DEVICE_ID || "").trim();
}

function isSmsConfigured() {
  return Boolean(getApiKey());
}

/**
 * Normalize to E.164 for PH numbers when possible.
 * Accepts +639…, 09…, 9…, or already-international values.
 */
function normalizePhoneE164(phone) {
  if (!phone || typeof phone !== "string") return "";
  const trimmed = phone.trim();
  if (trimmed.startsWith("+") && trimmed.length >= 10) {
    return `+${trimmed.slice(1).replace(/\D/g, "")}`;
  }
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 10 && digits.startsWith("9")) {
    return `+63${digits}`;
  }
  if (digits.length === 11 && digits.startsWith("09")) {
    return `+63${digits.slice(1)}`;
  }
  if (digits.length === 12 && digits.startsWith("639")) {
    return `+${digits}`;
  }
  if (digits.length >= 10) {
    return `+${digits}`;
  }
  return "";
}

function extractSmsBatchId(data) {
  return (
    data?.data?.smsBatchId ||
    data?.smsBatchId ||
    data?.data?.batchId ||
    data?.batchId ||
    null
  );
}

/**
 * Send one SMS via textbee.dev.
 * @param {string|string[]} to - Recipient phone(s)
 * @param {string} message - Plain-text body
 * @param {{ messageType?: string, reservationId?: string, branch?: string }} [meta]
 * @returns {Promise<{ success: boolean, skipped?: boolean, queued?: boolean, reason?: string, data?: object, smsBatchId?: string }>}
 */
async function sendSms(to, message, meta = {}) {
  const apiKey = getApiKey();
  if (!apiKey) {
    console.warn("[sms] TEXTBEE_API_KEY not set — SMS skipped");
    const result = { success: false, skipped: true, reason: "not_configured" };
    try {
      const { getDb } = require("./firebaseAdmin");
      const { recordSmsGatewayResult } = require("../../client/functions/systemHealthRuntime");
      await recordSmsGatewayResult(result, { db: getDb() });
    } catch (_) {
      /* best-effort */
    }
    return result;
  }

  if (!message || typeof message !== "string" || !message.trim()) {
    return { success: false, reason: "empty_message" };
  }

  const recipients = (Array.isArray(to) ? to : [to])
    .map(normalizePhoneE164)
    .filter(Boolean);

  if (!recipients.length) {
    return { success: false, reason: "invalid_recipient" };
  }

  const body = {
    recipients,
    message: message.trim(),
  };
  const deviceId = getDeviceId();
  if (deviceId) {
    body.deviceId = deviceId;
  }

  try {
    const response = await fetch(`${TEXTBEE_API_BASE}/send-sms`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify(body),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error("[sms] textbee send failed:", response.status, data);
      const result = {
        success: false,
        reason: "provider_error",
        status: response.status,
        data,
      };
      try {
        const { getDb } = require("./firebaseAdmin");
        const {
          recordSmsGatewayResult,
          recordNotificationFailure,
          createSmsDeliveryRecord,
          maskPhoneE164,
        } = require("../../client/functions/systemHealthRuntime");
        const db = getDb();
        await recordSmsGatewayResult(result, { db });
        await recordNotificationFailure(
          {
            channel: "sms",
            error: `provider_error:${response.status}`,
            notificationType: meta.messageType || "SMS",
            targetId: meta.reservationId || null,
          },
          { db }
        );
        await createSmsDeliveryRecord(
          {
            reservationId: meta.reservationId || null,
            branch: meta.branch || null,
            messageType: meta.messageType || "SMS",
            recipient: recipients[0],
            maskedRecipient: maskPhoneE164(recipients[0]),
            status: "failed",
            errorCode: String(response.status),
            errorName: "PROVIDER_HTTP_ERROR",
            errorMessage: `TextBee rejected the send request (HTTP ${response.status}).`,
          },
          { db }
        );
      } catch (_) {
        /* health write is best-effort */
      }
      return result;
    }

    const smsBatchId = extractSmsBatchId(data);
    const ok = {
      success: true,
      queued: true,
      data,
      status: response.status,
      smsBatchId,
    };
    try {
      const { getDb } = require("./firebaseAdmin");
      const {
        recordSmsGatewayResult,
        createSmsDeliveryRecord,
        maskPhoneE164,
      } = require("../../client/functions/systemHealthRuntime");
      const db = getDb();
      await recordSmsGatewayResult(ok, { db });
      await createSmsDeliveryRecord(
        {
          reservationId: meta.reservationId || null,
          branch: meta.branch || null,
          messageType: meta.messageType || "SMS",
          recipient: recipients[0],
          maskedRecipient: maskPhoneE164(recipients[0]),
          textbeeBatchId: smsBatchId,
          status: "queued",
        },
        { db }
      );
    } catch (_) {
      /* health write is best-effort */
    }
    return ok;
  } catch (err) {
    console.error("[sms] textbee request error:", err.message);
    const result = { success: false, reason: "network_error", error: err.message };
    try {
      const { getDb } = require("./firebaseAdmin");
      const {
        recordSmsGatewayResult,
        recordNotificationFailure,
        createSmsDeliveryRecord,
        maskPhoneE164,
      } = require("../../client/functions/systemHealthRuntime");
      const db = getDb();
      await recordSmsGatewayResult(result, { db });
      await recordNotificationFailure(
        {
          channel: "sms",
          error: err.message,
          notificationType: meta.messageType || "SMS",
          targetId: meta.reservationId || null,
        },
        { db }
      );
      await createSmsDeliveryRecord(
        {
          reservationId: meta.reservationId || null,
          branch: meta.branch || null,
          messageType: meta.messageType || "SMS",
          recipient: recipients[0],
          maskedRecipient: maskPhoneE164(recipients[0]),
          status: "failed",
          errorName: "NETWORK_ERROR",
          errorMessage: err.message,
        },
        { db }
      );
    } catch (_) {
      /* health write is best-effort */
    }
    return result;
  }
}

module.exports = {
  sendSms,
  normalizePhoneE164,
  isSmsConfigured,
  getApiKey,
  getDeviceId,
  extractSmsBatchId,
};
