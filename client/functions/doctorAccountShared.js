const LOCK_PATH = "systemLocks/doctorProvisioning";
const LOCK_TTL_MS = 60 * 1000;
const ACTIVE_DOCTOR_EXISTS_MESSAGE =
  "An active doctor already exists. Deactivate the current doctor first.";
const IN_CONSULTATION_STATUSES = new Set(["with_doctor", "in_consultation"]);
const FINISHED_QUEUE_STATUSES = new Set(["ended", "completed", "closed"]);

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

function findActiveDoctor(usersById, { excludeUid = null } = {}) {
  for (const [uid, user] of Object.entries(usersById || {})) {
    if (uid !== excludeUid && isActiveDoctor(user)) return { uid, ...user };
  }
  return null;
}

function activeDoctorError() {
  return makeError(ACTIVE_DOCTOR_EXISTS_MESSAGE, 409, "failed-precondition");
}

async function assertActiveAdmin(db, callerUid, action = "manage doctor accounts") {
  if (!callerUid) {
    throw makeError("Authentication required.", 401, "unauthenticated");
  }
  const snap = await db.ref(`users/${callerUid}`).once("value");
  const caller = snap.exists() ? snap.val() : null;
  if (!caller || caller.role !== "admin" || caller.status !== "active") {
    throw makeError(`Only an active admin can ${action}.`, 403, "permission-denied");
  }
  return caller;
}

async function readUsers(db) {
  const snap = await db.ref("users").once("value");
  return snap.exists() ? snap.val() : {};
}

/** Short-lived lock so concurrent create/reactivate calls cannot both pass the one-active-doctor check. */
async function acquireDoctorLock(db, callerUid, now = Date.now) {
  const token = `${callerUid}:${now()}:${Math.random().toString(36).slice(2, 8)}`;
  const result = await db.ref(LOCK_PATH).transaction((current) => {
    if (current && Number(current.expiresAt) > now()) return undefined;
    return { token, by: callerUid, expiresAt: now() + LOCK_TTL_MS };
  });
  if (!result.committed) {
    throw makeError(
      "Another doctor account change is in progress. Please try again in a moment.",
      409,
      "failed-precondition"
    );
  }
  return token;
}

async function releaseDoctorLock(db, token) {
  await db
    .ref(LOCK_PATH)
    .transaction((current) => (current && current.token === token ? null : current))
    .catch(() => {});
}

/**
 * A patient currently in the doctor's room on a session that is still running.
 * Only the doctor can complete a consultation, so removing the doctor now would strand that patient.
 */
async function findLiveConsultation(db) {
  const snap = await db.ref("reservations").once("value");
  if (!snap.exists()) return null;
  const rows = Object.entries(snap.val() || {}).filter(([, r]) => IN_CONSULTATION_STATUSES.has(r?.status));
  for (const [id, reservation] of rows) {
    if (!reservation.scheduleId) continue;
    const scheduleSnap = await db.ref(`schedules/${reservation.scheduleId}`).once("value");
    const schedule = scheduleSnap.exists() ? scheduleSnap.val() : null;
    if (!schedule) continue;
    if (FINISHED_QUEUE_STATUSES.has(schedule.queueStatus) || schedule.status === "completed") continue;
    return { id, ...reservation };
  }
  return null;
}

async function writeAdminAudit(db, caller, callerUid, entry, timestamp = Date.now()) {
  const auditRef = db.ref("auditLogs").push();
  await auditRef.set({
    category: "user_management",
    actorUid: callerUid,
    actorName: caller?.name || "Admin",
    actorRole: "admin",
    targetType: "user",
    timestamp,
    ...entry,
  });
  return auditRef.key;
}

module.exports = {
  LOCK_PATH,
  LOCK_TTL_MS,
  ACTIVE_DOCTOR_EXISTS_MESSAGE,
  makeError,
  isActiveDoctor,
  findActiveDoctor,
  activeDoctorError,
  assertActiveAdmin,
  readUsers,
  acquireDoctorLock,
  releaseDoctorLock,
  findLiveConsultation,
  writeAdminAudit,
};
