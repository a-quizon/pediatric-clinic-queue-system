const { databaseFor } = require("./rtdbRouter");
const {
  makeError,
  findActiveDoctor,
  activeDoctorError,
  assertActiveAdmin,
  readUsers,
  acquireDoctorLock,
  releaseDoctorLock,
  findLiveConsultation,
  writeAdminAudit,
} = require("./doctorAccountShared");

const LIVE_CONSULTATION_MESSAGE =
  "The doctor has a patient in consultation. Complete the consultation or end the session first.";

async function loadDoctor(db, targetUid) {
  if (!targetUid || typeof targetUid !== "string") {
    throw makeError("A user id is required.", 400, "invalid-argument");
  }
  const snap = await db.ref(`users/${targetUid}`).once("value");
  const target = snap.exists() ? snap.val() : null;
  if (!target || target.isDeleted === true) throw makeError("User not found.", 404, "not-found");
  if (target.role !== "doctor") {
    throw makeError("This action is only for doctor accounts.", 400, "invalid-argument");
  }
  return target;
}

/**
 * Admin deactivates or reactivates the Doctor.
 * Reactivation follows the one-active-doctor rule (lock + re-check), same as creation.
 * Deactivation revokes refresh tokens so an open session is signed out on its next token refresh;
 * AuthContext also signs out immediately when it sees status "inactive".
 */
async function setDoctorAccountStatus({ admin, callerUid, targetUid, status, now = Date.now }) {
  if (status !== "active" && status !== "inactive") {
    throw makeError("Status must be active or inactive.", 400, "invalid-argument");
  }
  const db = databaseFor(admin);
  const caller = await assertActiveAdmin(db, callerUid, "change a doctor's status");
  if (callerUid === targetUid) {
    throw makeError("You cannot change your own account status.", 400, "failed-precondition");
  }
  const target = await loadDoctor(db, targetUid);
  const label = target.name || target.email || "doctor";

  if (status === "inactive") {
    if (target.status === "inactive") return { success: true, uid: targetUid, status };
    if (await findLiveConsultation(db)) {
      throw makeError(LIVE_CONSULTATION_MESSAGE, 409, "failed-precondition");
    }
    const timestamp = now();
    await db.ref(`users/${targetUid}`).update({
      status: "inactive",
      deactivationSource: "admin",
      updatedAt: timestamp,
    });
    await admin.auth().revokeRefreshTokens(targetUid).catch((err) => {
      if (err?.code !== "auth/user-not-found") throw err;
    });
    await writeAdminAudit(
      db,
      caller,
      callerUid,
      {
        action: "USER_DEACTIVATED",
        description: `Deactivated doctor account for ${label}`,
        targetId: targetUid,
        metadata: { targetName: target.name || null, targetEmail: target.email || null, targetRole: "doctor" },
      },
      timestamp
    );
    return { success: true, uid: targetUid, status };
  }

  if (target.status === "active") return { success: true, uid: targetUid, status };
  if (findActiveDoctor(await readUsers(db), { excludeUid: targetUid })) throw activeDoctorError();

  const lockToken = await acquireDoctorLock(db, callerUid, now);
  try {
    if (findActiveDoctor(await readUsers(db), { excludeUid: targetUid })) throw activeDoctorError();
    const timestamp = now();
    await db.ref(`users/${targetUid}`).update({
      status: "active",
      deactivationSource: null,
      updatedAt: timestamp,
    });
    await writeAdminAudit(
      db,
      caller,
      callerUid,
      {
        action: "USER_ACTIVATED",
        description: `Reactivated doctor account for ${label}`,
        targetId: targetUid,
        metadata: { targetName: target.name || null, targetEmail: target.email || null, targetRole: "doctor" },
      },
      timestamp
    );
    return { success: true, uid: targetUid, status };
  } finally {
    await releaseDoctorLock(db, lockToken);
  }
}

module.exports = {
  setDoctorAccountStatus,
  LIVE_CONSULTATION_MESSAGE,
  loadDoctor,
};
