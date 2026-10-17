const { RESEND_COOLDOWN_MS, RESEND_COOLDOWN_SECONDS } = require("./resendCooldown");

const DAILY_LIMIT = 5;
const TIME_ZONE = "Asia/Manila";
const LIMIT_MESSAGE =
  "You've reached today's password reset limit. Please try again tomorrow.";
const COOLDOWN_MESSAGE_PREFIX = "Please wait";
const ADMIN_RESET_BLOCKED_MESSAGE =
  "Password reset is not available for this account. Contact the system owner.";
const STAFF_RESET_BLOCKED_MESSAGE =
  "Password reset emails are for parent accounts only. Ask the System Admin for a temporary password.";

const admin = require("firebase-admin");
const { getRtdb } = require("./rtdbRouter");

function getDb() {
  return getRtdb();
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function emailToKey(email) {
  return normalizeEmail(email).replace(/[.#$\[\]]/g, "_");
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function manilaDateYYYYMMDD(nowMs = Date.now()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(nowMs));
  const get = (type) => parts.find((part) => part.type === type)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function limitError() {
  const err = new Error(LIMIT_MESSAGE);
  err.code = "rate_limited";
  err.limitKind = "daily";
  return err;
}

function cooldownError(waitSec) {
  const err = new Error(`Please wait ${waitSec}s before requesting another reset email.`);
  err.code = "rate_limited";
  err.limitKind = "cooldown";
  err.retryAfterSeconds = waitSec;
  return err;
}

/**
 * Reset emails are for parents only. Doctors and secretaries get a temporary password from
 * the System Admin; admin credentials are managed via the Admin SDK (docs/AdminBreakGlass.md).
 */
async function assertResetAllowed(email, { auth, db }) {
  let record;
  try {
    record = await auth.getUserByEmail(email);
  } catch (err) {
    if (err?.code === "auth/user-not-found") return;
    throw err;
  }
  const roleSnap = await db.ref(`users/${record.uid}/role`).once("value");
  const role = roleSnap.val();
  if (role && role !== "parent") {
    const err = new Error(role === "admin" ? ADMIN_RESET_BLOCKED_MESSAGE : STAFF_RESET_BLOCKED_MESSAGE);
    err.code = "auth_denied";
    throw err;
  }
}

/**
 * Atomically consume one password-reset slot for today (Asia/Manila).
 * Also enforces a short resend cooldown via lastSentAt (does not consume a daily slot on cooldown).
 * Shared by Forgot Password and the admin's parent reset email. Non-parent accounts are refused.
 */
async function claimPasswordResetSlot(rawEmail, deps = {}) {
  const email = normalizeEmail(rawEmail);
  if (!email || !isValidEmail(email)) {
    const err = new Error("Please enter a valid email address.");
    err.code = "invalid_email";
    throw err;
  }

  const db = deps.db || getDb();
  const now = typeof deps.now === "function" ? deps.now() : Date.now();
  await assertResetAllowed(email, { auth: deps.auth || admin.auth(), db });

  const key = emailToKey(email);
  const limitRef = db.ref(`passwordResetLimits/${key}`);
  const today = manilaDateYYYYMMDD(now);

  let abortReason = null;
  let abortWaitSec = 0;

  const result = await limitRef.transaction((current) => {
    const prev = current && typeof current === "object" ? current : {};
    const lastSentAt = Number(prev.lastSentAt) || 0;
    if (lastSentAt > 0) {
      const age = now - lastSentAt;
      if (age < RESEND_COOLDOWN_MS) {
        abortReason = "cooldown";
        abortWaitSec = Math.ceil((RESEND_COOLDOWN_MS - age) / 1000);
        return;
      }
    }
    const count = prev.date === today ? Number(prev.count) || 0 : 0;
    if (count >= DAILY_LIMIT) {
      abortReason = "daily";
      return;
    }
    return {
      email,
      date: today,
      count: count + 1,
      lastSentAt: now,
      updatedAt: now,
    };
  });

  if (!result.committed) {
    if (abortReason === "cooldown" || (!abortReason && abortWaitSec > 0)) {
      throw cooldownError(abortWaitSec || RESEND_COOLDOWN_SECONDS);
    }
    const snap = await limitRef.once("value");
    const stored = snap.val() || {};
    const lastSentAt = Number(stored.lastSentAt) || 0;
    if (lastSentAt > 0) {
      const age = now - lastSentAt;
      if (age < RESEND_COOLDOWN_MS) {
        throw cooldownError(Math.ceil((RESEND_COOLDOWN_MS - age) / 1000));
      }
    }
    throw limitError();
  }

  const stored = result.snapshot.val() || {};
  return {
    success: true,
    remaining: Math.max(0, DAILY_LIMIT - (Number(stored.count) || 0)),
    limit: DAILY_LIMIT,
    date: stored.date || today,
    cooldownSeconds: RESEND_COOLDOWN_SECONDS,
  };
}

module.exports = {
  claimPasswordResetSlot,
  ADMIN_RESET_BLOCKED_MESSAGE,
  STAFF_RESET_BLOCKED_MESSAGE,
  DAILY_LIMIT,
  TIME_ZONE,
  LIMIT_MESSAGE,
  COOLDOWN_MESSAGE_PREFIX,
  RESEND_COOLDOWN_SECONDS,
  RESEND_COOLDOWN_MS,
  manilaDateYYYYMMDD,
  emailToKey,
};
