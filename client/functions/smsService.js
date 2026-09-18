/**
 * Textbee.dev SMS gateway (Cloud Functions mirror of server/services/smsService.js).
 */

const TEXTBEE_API_BASE = "https://api.textbee.dev/api/v1/gateway";

function getApiKey() {
  return (process.env.TEXTBEE_API_KEY || "").trim();
}

function getDeviceId() {
  return (process.env.TEXTBEE_DEVICE_ID || "").trim();
}

function normalizePhoneE164(phone) {
  if (!phone || typeof phone !== "string") return "";
  const trimmed = phone.trim();
  if (trimmed.startsWith("+") && trimmed.length >= 10) {
    return `+${trimmed.slice(1).replace(/\D/g, "")}`;
  }
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 10 && digits.startsWith("9")) return `+63${digits}`;
  if (digits.length === 11 && digits.startsWith("09")) return `+63${digits.slice(1)}`;
  if (digits.length === 12 && digits.startsWith("639")) return `+${digits}`;
  if (digits.length >= 10) return `+${digits}`;
  return "";
}

async function sendSms(to, message) {
  const apiKey = getApiKey();
  if (!apiKey) {
    console.warn("[functions/sms] TEXTBEE_API_KEY not set — SMS skipped");
    return { success: false, skipped: true, reason: "not_configured" };
  }
  if (!message || typeof message !== "string" || !message.trim()) {
    return { success: false, reason: "empty_message" };
  }

  const recipients = (Array.isArray(to) ? to : [to]).map(normalizePhoneE164).filter(Boolean);
  if (!recipients.length) return { success: false, reason: "invalid_recipient" };

  const body = { recipients, message: message.trim() };
  const deviceId = getDeviceId();
  if (deviceId) body.deviceId = deviceId;

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
      console.error("[functions/sms] textbee send failed:", response.status, data);
      return { success: false, reason: "provider_error", status: response.status, data };
    }
    return { success: true, data };
  } catch (err) {
    console.error("[functions/sms] textbee request error:", err.message);
    return { success: false, reason: "network_error", error: err.message };
  }
}

module.exports = { sendSms, normalizePhoneE164 };
