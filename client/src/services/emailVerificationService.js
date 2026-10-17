import { sendEmailVerification } from "firebase/auth";
import { auth } from "../firebase/auth";
import { getPushApiBase } from "./pushService";
import { RESEND_FLOW, startCooldown } from "../utils/resendCooldown";
import { RESEND_COOLDOWN_SECONDS } from "../utils/constants";

function apiBase() {
  return (getPushApiBase() || "").replace(/\/$/, "");
}

function parseRetryAfter(res, data) {
  if (data?.retryAfterSeconds != null) {
    const n = Number(data.retryAfterSeconds);
    if (Number.isFinite(n) && n > 0) return Math.ceil(n);
  }
  const header = res.headers.get("Retry-After");
  if (header) {
    const n = Number(header);
    if (Number.isFinite(n) && n > 0) return Math.ceil(n);
  }
  return null;
}

/**
 * Claim a short server-side cooldown slot before sendEmailVerification.
 * Requires the user to be signed in (Bearer token).
 */
export async function claimEmailVerificationSlot() {
  const user = auth.currentUser;
  if (!user) {
    const err = new Error("You must be signed in.");
    err.code = "auth_denied";
    throw err;
  }

  const token = await user.getIdToken();
  let res;
  try {
    res = await fetch(`${apiBase()}/api/auth/email-verification/claim`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({}),
    });
  } catch (networkErr) {
    const err = new Error("Unable to reach the server. Please try again.");
    err.code = "network_error";
    err.cause = networkErr;
    throw err;
  }

  const raw = await res.text();
  let data = {};
  if (raw) {
    try {
      data = JSON.parse(raw);
    } catch {
      const err = new Error(
        "Unable to reach the verification API. On the hosted site, deploy Cloud Functions; locally run the Express server (port 5000)."
      );
      err.code = "invalid_response";
      throw err;
    }
  }

  if (!res.ok || data.success === false) {
    const retryAfterSeconds = parseRetryAfter(res, data);
    const err = new Error(data.message || "Unable to send verification email. Please try again.");
    err.code = data.error || (res.status === 429 ? "rate_limited" : "request_failed");
    if (retryAfterSeconds != null) err.retryAfterSeconds = retryAfterSeconds;
    throw err;
  }

  return data;
}

/**
 * Claim cooldown then send Firebase email verification.
 */
export async function sendVerificationEmail(firebaseUser = auth.currentUser) {
  if (!firebaseUser) {
    const err = new Error("You must be signed in.");
    err.code = "auth_denied";
    throw err;
  }
  await claimEmailVerificationSlot();
  await sendEmailVerification(firebaseUser);
  if (firebaseUser.uid) {
    startCooldown(RESEND_FLOW.EMAIL_VERIFICATION, firebaseUser.uid, RESEND_COOLDOWN_SECONDS);
  }
}
