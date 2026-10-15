const crypto = require("crypto");
const { databaseFor } = require("./rtdbRouter");
const { assertActiveAdmin } = require("./doctorAccountShared");

function makeError(message, status, code) {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  return err;
}

/**
 * Strong temporary password: 16 chars, mixed case, digits, and symbols.
 * Never log the return value.
 */
function generateTemporaryPassword(length = 16) {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnopqrstuvwxyz";
  const digits = "23456789";
  const symbols = "!@#$%&*?";
  const all = upper + lower + digits + symbols;

  const pick = (charset) => charset[crypto.randomInt(0, charset.length)];
  const chars = [pick(upper), pick(lower), pick(digits), pick(symbols)];

  for (let i = chars.length; i < length; i += 1) {
    chars.push(pick(all));
  }

  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = crypto.randomInt(0, i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }

  return chars.join("");
}

/** Staff roles whose passwords the admin resets directly; parents use the reset email. */
const DIRECT_RESET_ROLES = ["secretary", "doctor"];

/**
 * Active admin resets a secretary or doctor password directly. The deployed callable and
 * Express route keep the `resetSecretaryPassword` name so existing clients keep working.
 * Returns a one-time temporary password; never write it to logs or audit.
 */
async function resetSecretaryPassword({ admin, callerUid, targetUid }) {
  if (!callerUid) {
    throw makeError("Authentication required.", 401, "unauthenticated");
  }
  if (!targetUid || typeof targetUid !== "string") {
    throw makeError("A user id is required.", 400, "invalid-argument");
  }
  if (callerUid === targetUid) {
    throw makeError("You cannot reset your own password through this action.", 400, "failed-precondition");
  }

  const db = databaseFor(admin);
  await assertActiveAdmin(db, callerUid, "reset a staff password");

  const targetSnap = await db.ref(`users/${targetUid}`).once("value");
  const target = targetSnap.exists() ? targetSnap.val() : null;
  if (!target) {
    throw makeError("User not found.", 404, "not-found");
  }
  if (!DIRECT_RESET_ROLES.includes(target.role)) {
    throw makeError(
      "Direct password reset is only allowed for secretary and doctor accounts.",
      403,
      "permission-denied"
    );
  }

  const temporaryPassword = generateTemporaryPassword();

  await admin.auth().updateUser(targetUid, { password: temporaryPassword });
  await admin.auth().revokeRefreshTokens(targetUid);

  await db.ref(`users/${targetUid}`).update({
    mustChangePassword: true,
    updatedAt: Date.now(),
  });

  return {
    success: true,
    uid: targetUid,
    temporaryPassword,
    staffName: target.name || null,
    role: target.role,
  };
}

module.exports = {
  DIRECT_RESET_ROLES,
  resetSecretaryPassword,
  generateTemporaryPassword,
};
