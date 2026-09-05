const { normalizePhoneE164 } = require("./smsService");

/**
 * Build candidate phone strings that may exist in legacy RTDB records.
 * Canonical storage is E.164 (+639XXXXXXXXX).
 */
function phoneLookupCandidates(rawPhone) {
  const e164 = normalizePhoneE164(rawPhone);
  if (!e164) return [];

  const digits = e164.replace(/\D/g, ""); // 639XXXXXXXXX
  const local10 = digits.startsWith("63") && digits.length === 12 ? digits.slice(2) : "";
  const candidates = new Set([e164]);

  if (local10) {
    candidates.add(local10);
    candidates.add(`0${local10}`);
    candidates.add(`63${local10}`);
    candidates.add(`+63${local10}`);
  }

  return [...candidates];
}

function isUsableAccount(user, { parentsOnly = false, requireActive = false } = {}) {
  if (!user || user.isDeleted === true) return false;
  if (parentsOnly && user.role !== "parent") return false;
  if (requireActive && user.status === "inactive") return false;
  return true;
}

/**
 * Find any non-deleted user by phone / phoneNumber across legacy formats.
 */
async function findUserByPhoneFlexible(db, rawPhone, options = {}) {
  const candidates = phoneLookupCandidates(rawPhone);
  if (!candidates.length) return null;

  for (const candidate of candidates) {
    for (const field of ["phone", "phoneNumber"]) {
      const snap = await db.ref("users").orderByChild(field).equalTo(candidate).once("value");
      if (!snap.exists()) continue;

      let match = null;
      snap.forEach((child) => {
        if (match) return;
        const user = child.val() || {};
        if (!isUsableAccount(user, options)) return;
        if (options.excludeUid && child.key === options.excludeUid) return;
        match = { uid: child.key, ...user };
      });
      if (match) return match;
    }
  }

  return null;
}

/**
 * Find account email by identifier (email or phone).
 */
async function resolveAccountByIdentifier(db, rawIdentifier) {
  const raw = String(rawIdentifier || "").trim();
  if (!raw) {
    const err = new Error("Enter an email or phone number.");
    err.code = "invalid_input";
    throw err;
  }

  if (raw.includes("@")) {
    const email = raw.toLowerCase();
    const snap = await db.ref("users").orderByChild("email").equalTo(email).once("value");
    if (snap.exists()) {
      let match = null;
      snap.forEach((child) => {
        if (match) return;
        const user = child.val() || {};
        if (!isUsableAccount(user)) return;
        match = { uid: child.key, ...user };
      });
      if (match?.email) {
        return { type: "email", email: String(match.email).toLowerCase(), uid: match.uid, user: match };
      }
    }
    // Allow Firebase Auth email even if RTDB email casing differs / missing profile yet
    return { type: "email", email, uid: null, user: null };
  }

  const phone = normalizePhoneE164(raw);
  if (!phone) {
    const err = new Error("Enter a valid email address or phone number.");
    err.code = "invalid_input";
    throw err;
  }

  const user = await findUserByPhoneFlexible(db, phone);
  if (!user?.email) {
    const err = new Error("No account was found with this phone number.");
    err.code = "user_not_found";
    throw err;
  }

  return {
    type: "phone",
    email: String(user.email).toLowerCase(),
    uid: user.uid,
    user,
    phone,
  };
}

module.exports = {
  phoneLookupCandidates,
  findUserByPhoneFlexible,
  resolveAccountByIdentifier,
  normalizePhoneE164,
};
