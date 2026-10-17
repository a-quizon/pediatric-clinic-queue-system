const { databaseFor } = require("./rtdbRouter");
const { assertActiveAdmin } = require("./doctorAccountShared");
const {
  claimPhoneForUid,
  normalizePhoneE164,
  PHONE_IN_USE_MESSAGE,
} = require("./phoneRegistry");

function makeError(message, status, code) {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  return err;
}

/**
 * Claim a phone for a staff (or self) account in phoneRegistry.
 * Admin may claim for any non-parent target; non-admins may only claim for themselves.
 */
async function claimStaffPhone({ admin, callerUid, targetUid, phone }) {
  if (!callerUid) throw makeError("Authentication required.", 401, "unauthenticated");
  if (!targetUid) throw makeError("A user id is required.", 400, "invalid-argument");

  const normalized = normalizePhoneE164(phone);
  if (!normalized) {
    throw makeError("Phone number must be a valid PH mobile number.", 400, "invalid-argument");
  }

  const db = databaseFor(admin);
  const callerSnap = await db.ref(`users/${callerUid}`).once("value");
  const caller = callerSnap.exists() ? callerSnap.val() : null;
  if (!caller || caller.status === "inactive" || caller.isDeleted === true) {
    throw makeError("Authentication required.", 401, "unauthenticated");
  }

  const isSelf = callerUid === targetUid;
  if (!isSelf) {
    await assertActiveAdmin(db, callerUid, "claim a phone number for another user");
  }

  const targetSnap = await db.ref(`users/${targetUid}`).once("value");
  const target = targetSnap.exists() ? targetSnap.val() : null;
  // Allow claim before profile exists (secretary create) when self after Auth create
  if (target?.role === "parent" && !isSelf) {
    throw makeError("Parent phones are claimed via SMS verification.", 403, "permission-denied");
  }

  try {
    await claimPhoneForUid(db, normalized, targetUid, {
      previousPhone: target?.phone || target?.phoneNumber || target?.contactNumber || null,
    });
  } catch (err) {
    if (err.code === "phone_in_use") {
      throw makeError(PHONE_IN_USE_MESSAGE, 409, "phone_in_use");
    }
    throw err;
  }

  return { success: true, phone: normalized, uid: targetUid };
}

module.exports = { claimStaffPhone };
