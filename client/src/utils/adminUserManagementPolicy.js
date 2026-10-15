/**
 * Pure authorization helpers for admin staff/user management (Admin → Users).
 * Used by the UI/service layer and unit tests. Server runtimes (active-admin check)
 * and RTDB rules remain the authoritative gates.
 */

export function canAdminEditUserProfile(targetRole) {
  // Admin accounts are Admin SDK only; parents edit their own profile.
  return targetRole === "secretary" || targetRole === "doctor";
}

/**
 * @returns {{ ok: true } | { ok: false, status: number, message: string }}
 */
export function assertAdminCanUpdateUserProfile({ callerRole, targetRole, updates = {} }) {
  if (callerRole !== "admin") {
    return {
      ok: false,
      status: 403,
      message: "Only an admin can manage clinic user profiles.",
    };
  }

  if (targetRole === "admin") {
    return {
      ok: false,
      status: 403,
      message: "Admin accounts cannot be edited in the app.",
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
        message: "Parent profile information cannot be edited by staff.",
      };
    }
  }

  return { ok: true };
}

/** Staff get a temporary password from the admin; reset emails are for parents only. */
export function isDirectPasswordResetRole(targetRole) {
  return targetRole === "secretary" || targetRole === "doctor";
}

/**
 * @returns {{ ok: true } | { ok: false, status: number, message: string }}
 */
export function assertAdminCanDirectResetStaffPassword({ callerRole, targetRole }) {
  if (callerRole !== "admin") {
    return {
      ok: false,
      status: 403,
      message: "Only an admin can reset a staff password directly.",
    };
  }
  if (!isDirectPasswordResetRole(targetRole)) {
    return {
      ok: false,
      status: 403,
      message: "Direct password reset is only allowed for secretary and doctor accounts.",
    };
  }
  return { ok: true };
}

/**
 * Actions Admin → Users may offer on a row. Mirrors the server: admin accounts and the
 * signed-in admin's own row get none (no edit, reset, deactivate, or delete).
 */
export function getUserRowActions({ target, currentUid }) {
  const none = { canEdit: false, canResetPassword: false, canToggleStatus: false, canDelete: false };
  if (!target?.id || target.id === "admin" || target.role === "admin") return none;
  if (currentUid && target.id === currentUid) return none;
  return {
    canEdit: canAdminEditUserProfile(target.role),
    canResetPassword: isDirectPasswordResetRole(target.role) || target.role === "parent",
    canToggleStatus: true,
    canDelete: true,
  };
}

export function buildStaffPasswordResetAuditDescription(staffName, role = "secretary") {
  const roleLabel = role === "doctor" ? "doctor" : "secretary";
  const name = staffName && String(staffName).trim() ? ` ${String(staffName).trim()}` : "";
  return `Admin reset password for ${roleLabel}${name}`;
}

export function auditDescriptionContainsSecret(description, secret) {
  if (!description || !secret) return false;
  return String(description).includes(String(secret));
}
