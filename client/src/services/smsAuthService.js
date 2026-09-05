import { signInWithCustomToken } from "firebase/auth";
import { auth } from "../firebase/auth";
import { formatToE164 } from "../utils/phoneUtils";
import { getPushApiBase } from "./pushService";

function apiBase() {
  return (getPushApiBase() || "").replace(/\/$/, "");
}

function toE164(phoneLocalOrE164) {
  if (phoneLocalOrE164?.startsWith("+")) return phoneLocalOrE164.trim();
  return formatToE164(String(phoneLocalOrE164 || "").trim());
}

async function authHeaders() {
  const headers = { "Content-Type": "application/json" };
  const user = auth.currentUser;
  if (user) {
    const token = await user.getIdToken();
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

async function postJson(path, body, { withAuth = false } = {}) {
  const headers = withAuth ? await authHeaders() : { "Content-Type": "application/json" };
  const res = await fetch(`${apiBase()}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.message || "Request failed.");
    err.code = data.error || "request_failed";
    err.retryAfterSeconds = data.retryAfterSeconds;
    throw err;
  }
  return data;
}

/**
 * @param {string} phoneLocalOrE164
 * @param {"login"|"register"|"update"} [purpose="login"]
 */
export async function sendSmsOtp(phoneLocalOrE164, purpose = "login") {
  return postJson(
    "/api/auth/sms/send-otp",
    {
      phone: toE164(phoneLocalOrE164),
      purpose,
    },
    { withAuth: purpose === "update" }
  );
}

/**
 * Login: returns Firebase user after custom-token sign-in.
 * Register / update: returns { verified, verificationId, phone }.
 */
export async function verifySmsOtp(phoneLocalOrE164, code, purpose = "login") {
  const data = await postJson(
    "/api/auth/sms/verify-otp",
    {
      phone: toE164(phoneLocalOrE164),
      code: String(code || "").trim(),
      purpose,
    },
    { withAuth: purpose === "update" }
  );

  if (purpose === "register" || purpose === "update") {
    return data;
  }

  if (!data.customToken) {
    const err = new Error("Verification failed.");
    err.code = "verify_failed";
    throw err;
  }

  const credential = await signInWithCustomToken(auth, data.customToken);
  return credential.user;
}

/** @deprecated Prefer verifySmsOtp(..., "login") */
export async function verifySmsOtpAndLogin(phoneLocalOrE164, code) {
  return verifySmsOtp(phoneLocalOrE164, code, "login");
}

export async function assertPhoneVerified(phoneLocalOrE164, verificationId, purpose = null) {
  return postJson(
    "/api/auth/sms/assert-phone-verified",
    {
      phone: toE164(phoneLocalOrE164),
      verificationId,
      ...(purpose ? { purpose } : {}),
    },
    { withAuth: purpose === "update" }
  );
}

export async function consumePhoneVerification(phoneLocalOrE164, verificationId, purpose = null) {
  return postJson(
    "/api/auth/sms/consume-phone-verification",
    {
      phone: toE164(phoneLocalOrE164),
      verificationId,
      ...(purpose ? { purpose } : {}),
    },
    { withAuth: purpose === "update" }
  );
}
