/**
 * Android SmsManager send result codes → plain explanations.
 * Numeric values from developer.android.com (android.telephony.SmsManager).
 * TextBee MESSAGE_FAILED.errorCode is this number as a string.
 */

const SMS_MANAGER_RESULT_CODES = {
  1: {
    name: "RESULT_ERROR_GENERIC_FAILURE",
    explanation:
      "The gateway phone reported a generic SMS failure (credit, weak signal, or carrier block are common causes).",
    suggestedFix: "Check SIM balance and signal on the TextBee phone, then retry.",
    isGatewayConfig: false,
  },
  2: {
    name: "RESULT_ERROR_RADIO_OFF",
    explanation: "The mobile radio is off (for example airplane mode) on the gateway phone.",
    suggestedFix: "Turn off airplane mode and enable mobile service on the TextBee phone.",
    isGatewayConfig: true,
  },
  3: {
    name: "RESULT_ERROR_NULL_PDU",
    explanation: "The message could not be encoded into a valid SMS PDU (format or carrier issue).",
    suggestedFix: "Check for an empty body or unusual characters. Try a shorter message.",
    isGatewayConfig: false,
  },
  4: {
    name: "RESULT_ERROR_NO_SERVICE",
    explanation: "The gateway phone has no cellular service.",
    suggestedFix: "Move the TextBee phone to a place with coverage and retry.",
    isGatewayConfig: true,
  },
  5: {
    name: "RESULT_ERROR_LIMIT_EXCEEDED",
    explanation: "The device or carrier send limit was reached (too many SMS in a short time).",
    suggestedFix: "Wait a few minutes. Increase Send Delay in TextBee and spread large batches.",
    isGatewayConfig: true,
  },
  7: {
    name: "RESULT_ERROR_SHORT_CODE_NOT_ALLOWED",
    explanation: "Short code sending is not allowed for this message on the carrier.",
    suggestedFix: "Send to a full phone number, not a short code.",
    isGatewayConfig: false,
  },
  8: {
    name: "RESULT_ERROR_SHORT_CODE_NEVER_ALLOWED",
    explanation: "Short codes are not supported on this carrier for this app.",
    suggestedFix: "Send to a full phone number, not a short code.",
    isGatewayConfig: false,
  },
  17: {
    name: "RESULT_NETWORK_ERROR",
    explanation: "A network error occurred while sending from the gateway phone.",
    suggestedFix: "Check signal on the TextBee phone and retry.",
    isGatewayConfig: true,
  },
  32: {
    name: "RESULT_NO_DEFAULT_SMS_APP",
    explanation:
      "The TextBee gateway phone has no default SMS app set. This is a device configuration problem on the clinic gateway phone — not a problem with the message content or the patient's number.",
    suggestedFix: "On the Android phone running TextBee, open Settings → Apps → Default apps and set a default SMS app, then retry.",
    isGatewayConfig: true,
  },
};

/**
 * @param {string|number|null|undefined} code
 * @returns {{ code: string, name: string, explanation: string, suggestedFix: string, isGatewayConfig: boolean, known: boolean }}
 */
function explainSmsManagerResultCode(code) {
  const raw = code == null || code === "" ? "" : String(code).trim();
  const numeric = Number(raw);
  const entry =
    raw && Number.isFinite(numeric) && Object.prototype.hasOwnProperty.call(SMS_MANAGER_RESULT_CODES, numeric)
      ? SMS_MANAGER_RESULT_CODES[numeric]
      : null;

  if (entry) {
    return {
      code: String(numeric),
      name: entry.name,
      explanation: entry.explanation,
      suggestedFix: entry.suggestedFix,
      isGatewayConfig: entry.isGatewayConfig,
      known: true,
    };
  }

  const displayCode = raw || "unknown";
  return {
    code: displayCode,
    name: raw ? `UNKNOWN_CODE_${raw}` : "UNKNOWN",
    explanation: raw
      ? `Unrecognized SMS result code ${raw}. See the TextBee error message for details.`
      : "SMS delivery failed with no error code.",
    suggestedFix: "Check the TextBee dashboard and gateway phone status, then retry if appropriate.",
    isGatewayConfig: false,
    known: false,
  };
}

module.exports = {
  SMS_MANAGER_RESULT_CODES,
  explainSmsManagerResultCode,
};
