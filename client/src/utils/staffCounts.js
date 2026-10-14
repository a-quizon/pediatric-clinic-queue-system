const CLINIC_STAFF_ROLES = new Set(["doctor", "secretary"]);

/** Active clinic staff = doctor or secretary, status active, not soft-deleted. Admins and parents are excluded. */
export function isActiveClinicStaff(user) {
  return Boolean(
    user &&
      CLINIC_STAFF_ROLES.has(user.role) &&
      user.status === "active" &&
      user.isDeleted !== true
  );
}

export function countActiveClinicStaff(users) {
  return (users || []).filter(isActiveClinicStaff).length;
}
