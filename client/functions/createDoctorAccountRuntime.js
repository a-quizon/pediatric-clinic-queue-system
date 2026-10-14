const { databaseFor } = require("./rtdbRouter");

const LOCK_PATH = "systemLocks/doctorProvisioning";
const LOCK_TTL_MS = 60 * 1000;
const MIN_PASSWORD_LENGTH = 12;

function makeError(message, status, code) {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  return err;
}

/** Active doctor = role doctor, status active, not soft-deleted. Deactivated/archived doctors do not count. */
function isActiveDoctor(user) {
  return Boolean(
    user && user.role === "doctor" && user.status === "active" && user.isDeleted !== true
  );
}

function findActiveDoctor(usersById) {
  for (const [uid, user] of Object.entries(usersById || {})) {
    if (isActiveDoctor(user)) return { uid, ...user };
  }
  return null;
}

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

function activeDoctorError() {
  return makeError(
    "An active doctor already exists. Only one active doctor is allowed.",
    409,
    "failed-precondition"
  );
}

/**
 * Admin creates the clinic Doctor account (Auth + RTDB profile) and writes the audit entry.
 * Enforces one active doctor: pre-check, a short-lived provisioning lock, then a re-check.
 */
async function createDoctorAccount({ admin, callerUid, payload, now = Date.now }) {
  if (!callerUid) {
    throw makeError("Authentication required.", 401, "unauthenticated");
  }

  const db = databaseFor(admin);
  const callerSnap = await db.ref(`users/${callerUid}`).once("value");
  const caller = callerSnap.exists() ? callerSnap.val() : null;
  if (!caller || caller.role !== "admin" || caller.status !== "active") {
    throw makeError("Only an active admin can create a doctor account.", 403, "permission-denied");
  }

  const input = normalizePayload(payload);

  const readUsers = async () => {
    const snap = await db.ref("users").once("value");
    return snap.exists() ? snap.val() : {};
  };

  if (findActiveDoctor(await readUsers())) throw activeDoctorError();

  const lockRef = db.ref(LOCK_PATH);
  const lockToken = `${callerUid}:${now()}`;
  const lockResult = await lockRef.transaction((current) => {
    if (current && Number(current.expiresAt) > now()) return undefined;
    return { token: lockToken, by: callerUid, expiresAt: now() + LOCK_TTL_MS };
  });
  if (!lockResult.committed) {
    throw makeError(
      "Another doctor account is being created. Please try again in a moment.",
      409,
      "failed-precondition"
    );
  }

  let createdUid = null;
  try {
    if (findActiveDoctor(await readUsers())) throw activeDoctorError();

    const userRecord = await admin.auth().createUser({
      email: input.email,
      password: input.password,
      displayName: input.name,
      emailVerified: true,
    });
    createdUid = userRecord.uid;

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
      await db.ref(`users/${createdUid}`).set(profile);
    } catch (err) {
      await admin.auth().deleteUser(createdUid).catch(() => {});
      throw err;
    }

    const auditRef = db.ref("auditLogs").push();
    await auditRef.set({
      action: "USER_CREATED",
      category: "user_management",
      actorUid: callerUid,
      actorName: caller.name || "Admin",
      actorRole: "admin",
      description: `Created a new doctor account for ${input.name}`,
      targetType: "user",
      targetId: createdUid,
      timestamp,
    });

    return { success: true, uid: createdUid, auditLogId: auditRef.key };
  } catch (err) {
    if (err?.code === "auth/email-already-exists") {
      throw makeError("The email address is already in use by another account.", 409, "failed-precondition");
    }
    throw err;
  } finally {
    await lockRef
      .transaction((current) => (current && current.token === lockToken ? null : current))
      .catch(() => {});
  }
}

module.exports = {
  createDoctorAccount,
  findActiveDoctor,
  isActiveDoctor,
  LOCK_PATH,
};
