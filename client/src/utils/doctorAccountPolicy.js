export const ACTIVE_DOCTOR_EXISTS_MESSAGE =
  "An active doctor already exists. Only one active doctor is allowed. Deactivate the current doctor through break-glass recovery before adding a new one.";

/** Mirrors client/functions/createDoctorAccountRuntime.js#isActiveDoctor. */
export function isActiveDoctor(user) {
  return Boolean(
    user && user.role === "doctor" && user.status === "active" && user.isDeleted !== true
  );
}

export function findActiveDoctor(users) {
  const list = Array.isArray(users) ? users : Object.values(users || {});
  return list.find(isActiveDoctor) || null;
}

export function canCreateDoctor(users) {
  return !findActiveDoctor(users);
}
