const { databaseFor } = require("./rtdbRouter");
const {
  LOCK_PATH,
  makeError,
  isActiveDoctor,
  findActiveDoctor,
  activeDoctorError,
  assertActiveAdmin,
  readUsers,
  acquireDoctorLock,
  releaseDoctorLock,
  writeAdminAudit,
} = require("./doctorAccountShared");
const { claimPhoneForUid, PHONE_IN_USE_MESSAGE } = require("./phoneRegistry");

const MIN_PASSWORD_LENGTH = 12;

function normalizePayload(payload) {
  const name = String(payload?.name || "").trim();
  const email = String(payload?.email || "").trim().toLowerCase();
  const phone = String(payload?.phone || "").trim();
  const password = typeof payload?.password === "string" ? payload.password : "";

  if (!name) throw makeError("Name is required.", 400, "invalid-argument");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw makeError("A valid email is required.", 400, "invalid-argument");
  }
  if (!/^\+639\d{9}$/.test(phone)) {
    throw makeError("Phone number must be a valid PH mobile number.", 400, "invalid-argument");
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw makeError(
      `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
      400,
      "invalid-argument"
    );
  }
  return { name, email, phone, password };
}

/**
 * Admin creates the clinic Doctor account (Auth + RTDB profile) and writes the audit entry.
 * Enforces one active doctor: pre-check, a short-lived provisioning lock, then a re-check.
 */
async function createDoctorAccount({ admin, callerUid, payload, now = Date.now }) {
  const db = databaseFor(admin);
  const caller = await assertActiveAdmin(db, callerUid, "create a doctor account");
  const input = normalizePayload(payload);

  if (findActiveDoctor(await readUsers(db))) throw activeDoctorError();

  const lockToken = await acquireDoctorLock(db, callerUid, now);
  try {
    if (findActiveDoctor(await readUsers(db))) throw activeDoctorError();

    const userRecord = await admin.auth().createUser({
      email: input.email,
      password: input.password,
      displayName: input.name,
      emailVerified: true,
    });
    const createdUid = userRecord.uid;

    const timestamp = now();
    const profile = {
      uid: createdUid,
      name: input.name,
      email: input.email,
      phone: input.phone,
      contactNumber: input.phone,
      role: "doctor",
      status: "active",
      hasCompletedTour: false,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    try {
      await claimPhoneForUid(db, input.phone, createdUid);
      await db.ref(`users/${createdUid}`).set(profile);
    } catch (err) {
      await admin.auth().deleteUser(createdUid).catch(() => {});
      if (err?.code === "phone_in_use") {
        throw makeError(PHONE_IN_USE_MESSAGE, 409, "phone_in_use");
      }
      throw err;
    }

    const auditLogId = await writeAdminAudit(
      db,
      caller,
      callerUid,
      {
        action: "USER_CREATED",
        description: `Created a new doctor account for ${input.name}`,
        targetId: createdUid,
        metadata: { targetName: input.name, targetEmail: input.email, targetRole: "doctor" },
      },
      timestamp
    );

    return { success: true, uid: createdUid, auditLogId };
  } catch (err) {
    if (err?.code === "auth/email-already-exists") {
      throw makeError("The email address is already in use by another account.", 409, "failed-precondition");
    }
    throw err;
  } finally {
    await releaseDoctorLock(db, lockToken);
  }
}

module.exports = {
  createDoctorAccount,
  findActiveDoctor,
  isActiveDoctor,
  LOCK_PATH,
};
