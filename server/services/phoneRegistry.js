/**
 * Exclusive phone ownership index (server-only).
 * Mirror of client/functions/phoneRegistry.js — keep behavior in sync.
 */
const { normalizePhoneE164 } = require("./smsService");
const { findUserByPhoneFlexible } = require("./phoneLookup");

const PHONE_IN_USE_MESSAGE = "This mobile number is already registered.";
const RESERVE_TTL_MS = 30 * 60 * 1000;

function phoneToKey(phoneE164) {
  return String(phoneE164 || "").replace(/[.#$\[\]]/g, "_");
}

function phoneInUseError(message = PHONE_IN_USE_MESSAGE) {
  const err = new Error(message);
  err.code = "phone_in_use";
  return err;
}

function isReserveExpired(record, now = Date.now()) {
  if (!record) return true;
  if (record.uid) return false;
  const reservedAt = Number(record.reservedAt || 0);
  return !reservedAt || now - reservedAt > RESERVE_TTL_MS;
}

async function assertPhoneAvailable(
  db,
  rawPhone,
  { excludeUid = null, parentsOnly = false, allowVerificationId = null } = {}
) {
  const phone = normalizePhoneE164(rawPhone);
  if (!phone) {
    const err = new Error("Enter a valid mobile number.");
    err.code = "invalid_phone";
    throw err;
  }

  const existing = await findUserByPhoneFlexible(db, phone, {
    parentsOnly,
    requireActive: false,
    excludeUid,
  });
  if (existing) throw phoneInUseError();

  const key = phoneToKey(phone);
  const snap = await db.ref(`phoneRegistry/${key}`).once("value");
  if (snap.exists()) {
    const record = snap.val() || {};
    if (record.uid && record.uid !== excludeUid) throw phoneInUseError();
    if (!record.uid && !isReserveExpired(record)) {
      if (allowVerificationId && record.verificationId === allowVerificationId) {
        // same in-flight verification — ok
      } else {
        throw phoneInUseError();
      }
    }
  }

  return phone;
}

async function reservePhone(db, rawPhone, { verificationId, purpose, uid = null } = {}) {
  const phone = normalizePhoneE164(rawPhone);
  if (!phone || !verificationId) throw phoneInUseError("Phone verification is required.");

  await assertPhoneAvailable(db, phone, {
    excludeUid: uid || null,
    parentsOnly: purpose === "register",
    allowVerificationId: verificationId,
  });

  const key = phoneToKey(phone);
  const now = Date.now();
  const result = await db.ref(`phoneRegistry/${key}`).transaction((current) => {
    if (current?.uid && current.uid !== uid) return;
    if (current && !current.uid && !isReserveExpired(current, now)) {
      if (current.verificationId && current.verificationId !== verificationId) return;
    }
    return {
      phone,
      uid: uid || null,
      verificationId,
      purpose: purpose || null,
      reservedAt: now,
      boundAt: current?.boundAt || null,
    };
  });

  if (!result.committed) throw phoneInUseError();
  return phone;
}

async function bindPhone(db, rawPhone, uid, { verificationId = null, purpose = null, previousPhone = null } = {}) {
  if (!uid) {
    const err = new Error("You must be signed in to claim this phone number.");
    err.code = "auth_denied";
    throw err;
  }

  const phone = normalizePhoneE164(rawPhone);
  if (!phone) {
    const err = new Error("Enter a valid mobile number.");
    err.code = "invalid_phone";
    throw err;
  }

  await assertPhoneAvailable(db, phone, {
    excludeUid: uid,
    parentsOnly: false,
    allowVerificationId: verificationId,
  });

  const key = phoneToKey(phone);
  const now = Date.now();
  const result = await db.ref(`phoneRegistry/${key}`).transaction((current) => {
    if (current?.uid && current.uid !== uid) return;
    if (
      current &&
      !current.uid &&
      verificationId &&
      current.verificationId &&
      current.verificationId !== verificationId &&
      !isReserveExpired(current, now)
    ) {
      return;
    }
    return {
      phone,
      uid,
      verificationId: verificationId || current?.verificationId || null,
      purpose: purpose || current?.purpose || null,
      reservedAt: current?.reservedAt || now,
      boundAt: now,
    };
  });

  if (!result.committed) throw phoneInUseError();

  const prev = normalizePhoneE164(previousPhone);
  if (prev && prev !== phone) {
    await releasePhone(db, prev, uid);
  }

  return phone;
}

async function releasePhone(db, rawPhone, uid) {
  const phone = normalizePhoneE164(rawPhone);
  if (!phone || !uid) return;
  const key = phoneToKey(phone);
  const snap = await db.ref(`phoneRegistry/${key}`).once("value");
  if (!snap.exists()) return;
  const record = snap.val() || {};
  if (record.uid && record.uid !== uid) return;
  await db.ref(`phoneRegistry/${key}`).remove();
}

async function claimPhoneForUid(db, rawPhone, uid, { previousPhone = null } = {}) {
  return bindPhone(db, rawPhone, uid, { previousPhone, purpose: "staff" });
}

module.exports = {
  PHONE_IN_USE_MESSAGE,
  phoneToKey,
  phoneInUseError,
  assertPhoneAvailable,
  reservePhone,
  bindPhone,
  releasePhone,
  claimPhoneForUid,
  normalizePhoneE164,
};
