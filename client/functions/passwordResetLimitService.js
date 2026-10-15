const DAILY_LIMIT = 5;
const TIME_ZONE = "Asia/Manila";
const LIMIT_MESSAGE =
  "You've reached today's password reset limit. Please try again tomorrow.";
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
  await assertResetAllowed(email, { auth: deps.auth || admin.auth(), db });

  const key = emailToKey(email);
  const limitRef = db.ref(`passwordResetLimits/${key}`);
  const today = manilaDateYYYYMMDD();

  const result = await limitRef.transaction((current) => {
    const prev = current && typeof current === "object" ? current : {};
    const count = prev.date === today ? Number(prev.count) || 0 : 0;
    if (count >= DAILY_LIMIT) {
      return;
    }
    return {
      email,
      date: today,
      count: count + 1,
      updatedAt: Date.now(),
    };
  });

  if (!result.committed) {
    throw limitError();
  }

  const stored = result.snapshot.val() || {};
  return {
    success: true,
    remaining: Math.max(0, DAILY_LIMIT - (Number(stored.count) || 0)),
    limit: DAILY_LIMIT,
    date: stored.date || today,
  };
}

module.exports = {
  claimPasswordResetSlot,
  ADMIN_RESET_BLOCKED_MESSAGE,
  STAFF_RESET_BLOCKED_MESSAGE,
  DAILY_LIMIT,
  TIME_ZONE,
  LIMIT_MESSAGE,
  manilaDateYYYYMMDD,
  emailToKey,
};
