import { formatToE164, parseToLocal } from "./phoneUtils";

/**
 * Detect whether a login identifier is an email or a Philippine phone number.
 * @param {string} raw
 * @returns {{ type: "email"|"phone"|"unknown", value: string, display?: string }}
 */
export function detectLoginIdentifier(raw) {
  const trimmed = String(raw || "").trim();
  if (!trimmed) return { type: "unknown", value: "" };

  if (trimmed.includes("@")) {
    return { type: "email", value: trimmed.toLowerCase() };
  }

  const digits = trimmed.replace(/\D/g, "");
  let local = "";
  if (digits.length === 10 && digits.startsWith("9")) {
    local = digits;
  } else if (digits.length === 11 && digits.startsWith("09")) {
    local = digits.slice(1);
  } else if (digits.length === 12 && digits.startsWith("639")) {
    local = digits.slice(2);
  } else if (digits.length === 13 && digits.startsWith("630")) {
    local = digits.slice(3);
  }

  if (local.length === 10) {
    return {
      type: "phone",
      value: formatToE164(local),
      display: local,
    };
  }

  // Still typing a phone (digits only) — treat as phone-in-progress
  if (/^[\d\s+\-()]+$/.test(trimmed) && digits.length > 0 && digits.length < 10) {
    return { type: "phone", value: "", display: digits.slice(0, 10) };
  }

  // Ambiguous text without @ — treat as email draft
  if (/[a-zA-Z]/.test(trimmed)) {
    return { type: "email", value: trimmed.toLowerCase() };
  }

  return { type: "unknown", value: trimmed };
}

export function formatOtpCountdown(totalSeconds) {
  const safe = Math.max(0, Number(totalSeconds) || 0);
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/**
 * Listen for Web OTP API / SMS autofill when available.
 * Returns an abort cleanup function.
 */
export function startOtpAutofill(onCode) {
  if (typeof window === "undefined" || typeof onCode !== "function") {
    return () => {};
  }

  const abort = new AbortController();

  if ("OTPCredential" in window && navigator.credentials?.get) {
    navigator.credentials
      .get({
        otp: { transport: ["sms"] },
        signal: abort.signal,
      })
      .then((cred) => {
        const code = cred?.code || "";
        if (code) onCode(String(code).replace(/\D/g, "").slice(0, 6));
      })
      .catch(() => {
        // User cancelled or unsupported — ignore
      });
  }

  return () => abort.abort();
}

export { formatToE164, parseToLocal };
