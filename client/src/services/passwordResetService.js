import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "../firebase/auth";
import { getPushApiBase } from "./pushService";

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
export async function sendPasswordResetLink(email, actionCodeSettings) {
  await claimPasswordResetSlot(email);
  return sendPasswordResetEmail(auth, String(email || "").trim(), actionCodeSettings);
}
