export const ACTIVE_DOCTOR_EXISTS_MESSAGE =
  "An active doctor already exists. Deactivate the current doctor first.";

/** Mirrors client/functions/doctorAccountShared.js#isActiveDoctor. */
export function isActiveDoctor(user) {
  return Boolean(
    user && user.role === "doctor" && user.status === "active" && user.isDeleted !== true
  );
}

function toList(users) {
  if (Array.isArray(users)) return users;
  return Object.entries(users || {}).map(([id, user]) => ({ id, ...user }));
}

export function findActiveDoctor(users, { excludeId = null } = {}) {
  return (
    toList(users).find((user) => isActiveDoctor(user) && (excludeId == null || (user.id ?? user.uid) !== excludeId)) ||
    null
  );
}

export function canCreateDoctor(users) {
  return !findActiveDoctor(users);
}

/** A deactivated doctor can be reactivated only when no other doctor is active. */
export function canReactivateDoctor(users, doctorId) {
  return !findActiveDoctor(users, { excludeId: doctorId });
}
