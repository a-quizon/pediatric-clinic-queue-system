const { databaseFor } = require("./rtdbRouter");
const { assertActiveAdmin } = require("./doctorAccountShared");
const { claimPhoneForUid, normalizePhoneE164, PHONE_IN_USE_MESSAGE } = require("./phoneRegistry");

function makeError(message, status, code) {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  return err;
}

const PROFILE_ALLOWLIST = ["name", "phone", "assignedBranch", "assignedBranchId"];

/**
 * Active admin updates another staff user's profile fields.
 * Parent profile edits are rejected with 403.
 */
async function updateUserAccount({ admin, callerUid, targetUid, updates }) {
  if (!callerUid) {
    throw makeError("Authentication required.", 401, "unauthenticated");
  }
  if (!targetUid || typeof targetUid !== "string") {
    throw makeError("A user id is required.", 400, "invalid-argument");
  }
  if (!updates || typeof updates !== "object") {
    throw makeError("Update payload is required.", 400, "invalid-argument");
  }

  const db = databaseFor(admin);
  await assertActiveAdmin(db, callerUid, "update user profiles");

  const targetSnap = await db.ref(`users/${targetUid}`).once("value");
  const target = targetSnap.exists() ? targetSnap.val() : null;
  if (!target) {
    throw makeError("User not found.", 404, "not-found");
  }

  if (target.role === "parent") {
    throw makeError(
      "Parent profile information cannot be edited by staff.",
      403,
      "permission-denied"
    );
  }
  if (target.role === "admin") {
    throw makeError("Admin accounts cannot be edited in the app.", 403, "permission-denied");
  }

  const sanitized = {};
  for (const key of PROFILE_ALLOWLIST) {
    if (Object.prototype.hasOwnProperty.call(updates, key)) {
      sanitized[key] = updates[key];
    }
  }

  if (Object.keys(sanitized).length === 0) {
    throw makeError("No allowed profile fields to update.", 400, "invalid-argument");
  }

  if (target.role !== "secretary") {
    delete sanitized.assignedBranch;
    delete sanitized.assignedBranchId;
  }

  if (Object.prototype.hasOwnProperty.call(sanitized, "phone")) {
    const phone = normalizePhoneE164(sanitized.phone);
    if (!phone) {
      throw makeError("Phone number must be a valid PH mobile number.", 400, "invalid-argument");
    }
    try {
      await claimPhoneForUid(db, phone, targetUid, {
        previousPhone: target.phone || target.phoneNumber || target.contactNumber || null,
      });
    } catch (err) {
      if (err.code === "phone_in_use") {
        throw makeError(PHONE_IN_USE_MESSAGE, 409, "phone_in_use");
      }
      throw err;
    }
    sanitized.phone = phone;
    sanitized.phoneNumber = phone;
    if (target.role === "doctor") {
      sanitized.contactNumber = phone;
    }
  }

  await db.ref(`users/${targetUid}`).update({
    ...sanitized,
    updatedAt: Date.now(),
  });

  return { success: true, uid: targetUid };
}

module.exports = {
  updateUserAccount,
  PROFILE_ALLOWLIST,
};
