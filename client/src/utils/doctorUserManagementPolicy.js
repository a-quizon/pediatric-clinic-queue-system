/**
 * Pure authorization helpers for doctor clinic-admin user management.
 * Used by the UI/service layer and unit tests. RTDB rules remain the
 * authoritative write gate for client profile updates.
 */

export function canDoctorEditUserProfile(targetRole) {
  if (targetRole === "parent") return false;
  if (targetRole === "secretary") return true;
  // Doctor/admin profiles: name/phone edits remain allowed for non-self management screens,
  // but status/delete stay blocked elsewhere.
  return targetRole === "doctor" || targetRole === "admin";
}

/**
 * @returns {{ ok: true } | { ok: false, status: number, message: string }}
 */
export function assertDoctorCanUpdateUserProfile({ callerRole, targetRole, updates = {} }) {
  if (callerRole !== "doctor" && callerRole !== "admin") {
    return {
      ok: false,
      status: 403,
      message: "Only a doctor can manage clinic user profiles.",
    };
  }

  if (targetRole === "parent") {
    const profileKeys = ["name", "phone", "email", "assignedBranch", "assignedBranchId"];
    const touchingProfile = profileKeys.some((key) =>
      Object.prototype.hasOwnProperty.call(updates, key)
    );
    if (touchingProfile) {
      return {
        ok: false,
        status: 403,
        message: "Doctors cannot edit parent profile information.",
      };
    }
  }

  return { ok: true };
}

/**
 * @returns {{ ok: true } | { ok: false, status: number, message: string }}
 */
export function assertDoctorCanDirectResetSecretaryPassword({ callerRole, targetRole }) {
  if (callerRole !== "doctor" && callerRole !== "admin") {
    return {
      ok: false,
      status: 403,
      message: "Only a doctor can reset a secretary password directly.",
    };
  }
  if (targetRole !== "secretary") {
    return {
      ok: false,
      status: 403,
      message: "Direct password reset is only allowed for secretary accounts.",
    };
  }
  return { ok: true };
}

export function buildSecretaryPasswordResetAuditDescription(secretaryName) {
  const label = secretaryName && String(secretaryName).trim()
    ? String(secretaryName).trim()
    : "secretary";
  return `Doctor reset password for secretary ${label}`;
}

export function auditDescriptionContainsSecret(description, secret) {
  if (!description || !secret) return false;
  return String(description).includes(String(secret));
}
