import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "../firebase/auth";
import { getPushApiBase } from "./pushService";
import { getPasswordResetActionSettings } from "../utils/appUrl";

const CONTINUE_URI_ERROR_CODES = new Set([
  "auth/unauthorized-continue-uri",
  "auth/invalid-continue-uri",
]);

export const PASSWORD_RESET_DAILY_LIMIT_MESSAGE =
  "You've reached today's password reset limit. Please try again tomorrow.";

function apiBase() {
  return (getPushApiBase() || "").replace(/\/$/, "");
}

async function claimPasswordResetSlot(email) {
  const trimmed = String(email || "").trim();
  let res;
  try {
    res = await fetch(`${apiBase()}/api/auth/password-reset/claim`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: trimmed }),
    });
  } catch (networkErr) {
    const err = new Error("Unable to reach the server. Please try again.");
    err.code = "network_error";
    err.cause = networkErr;
    throw err;
  }

  const contentType = res.headers.get("content-type") || "";
  const raw = await res.text();
  let data = {};
  if (raw) {
    try {
      data = JSON.parse(raw);
    } catch {
      const err = new Error(
        "Unable to reach the password reset API. On the hosted site, deploy Cloud Functions; locally run the Express server (port 5000)."
      );
      err.code = "invalid_response";
      throw err;
    }
  }

  if (!contentType.includes("application/json") && Object.keys(data).length === 0) {
    const err = new Error(
      "Unable to reach the password reset API. On the hosted site, deploy Cloud Functions; locally run the Express server (port 5000)."
    );
    err.code = "invalid_response";
    throw err;
  }

  if (!res.ok || data.success === false) {
    const err = new Error(
      data.message ||
        (res.status === 429
          ? PASSWORD_RESET_DAILY_LIMIT_MESSAGE
          : "Unable to send reset email. Please try again.")
    );
    err.code = data.error || (res.status === 429 ? "rate_limited" : "request_failed");
    throw err;
  }

  return data;
}

/**
 * Claim one daily reset slot, then send Firebase's built-in reset email.
 * Used by Forgot Password (all roles) and Admin Reset Password.
 */
export async function sendPasswordResetLink(
  email,
  actionCodeSettings = getPasswordResetActionSettings()
) {
  const trimmed = String(email || "").trim();
  await claimPasswordResetSlot(trimmed);
  try {
    return await sendPasswordResetEmail(auth, trimmed, actionCodeSettings);
  } catch (err) {
    if (!CONTINUE_URI_ERROR_CODES.has(err?.code)) throw err;
    // Domain is missing from Firebase Auth > Authorized domains; fall back to Firebase's hosted reset page.
    console.error(
      `[PasswordReset] Continue URL rejected (${err.code}): ${actionCodeSettings?.url}. ` +
        "Add its domain under Firebase Console > Authentication > Settings > Authorized domains.",
      err
    );
    return sendPasswordResetEmail(auth, trimmed);
  }
}
