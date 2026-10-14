import { initializeApp, getApps, deleteApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, updateProfile, signOut } from "firebase/auth";
import { getFunctions, httpsCallable } from "firebase/functions";
import { ref, set, get } from "firebase/database";
import app, { firebaseConfig } from "../firebase/firebaseConfig";
import { getDb } from "../firebase/database";
import { auth } from "../firebase/auth";
import { logAuditEvent, AUDIT_ACTIONS, AUDIT_CATEGORIES } from "./auditService";
import { sendPasswordResetLink } from "./passwordResetService";
import { getPasswordResetActionSettings } from "../utils/appUrl";
import {
  assertAdminCanUpdateUserProfile,
  buildStaffPasswordResetAuditDescription,
  isDirectPasswordResetRole,
} from "../utils/adminUserManagementPolicy";
import { findActiveDoctor } from "../utils/doctorAccountPolicy";

const PROFILE_UPDATE_ALLOWLIST = ["name", "phone", "assignedBranch", "assignedBranchId"];

async function getCallerRole() {
  if (!auth.currentUser) return null;
  const snap = await get(ref(getDb(), `users/${auth.currentUser.uid}/role`));
  return snap.exists() ? snap.val() : null;
}

export const getActiveDoctor = async () => {
  const snapshot = await get(ref(getDb(), "users"));
  if (!snapshot.exists()) return null;
  return findActiveDoctor(snapshot.val());
};

const SERVER_CLIENT_ERRORS = new Set([400, 401, 403, 404, 409]);
const DOCTOR_CREATE_CLIENT_ERRORS = SERVER_CLIENT_ERRORS;

/**
 * Admin-only: creates the single active Doctor through the Admin SDK (Express mirror in dev,
 * `createDoctorAccount` callable in hosted builds). The server enforces the one-doctor rule
 * and writes the audit entry; client rules reject role "doctor" writes.
 */
export const createDoctorAccount = async ({ name, email, phone, password }) => {
  if (!auth.currentUser) throw new Error("Authentication required.");
  const payload = { name, email, phone, password };
  const token = await auth.currentUser.getIdToken();
  const apiBase = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

  try {
    const res = await fetch(`${apiBase}/api/admin/create-doctor`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const isJson = (res.headers.get("content-type") || "").includes("application/json");
    if (res.ok && isJson) {
      return await res.json();
    }
    if (isJson && DOCTOR_CREATE_CLIENT_ERRORS.has(res.status)) {
      const body = await res.json().catch(() => ({}));
      const err = new Error(body.error || "Failed to create doctor account.");
      err.status = res.status;
      throw err;
    }
  } catch (err) {
    if (!(err instanceof TypeError)) throw err;
  }

  const functions = getFunctions(app, "asia-southeast1");
  const callCreate = httpsCallable(functions, "createDoctorAccount");
  try {
    const response = await callCreate(payload);
    return response?.data || response;
  } catch (err) {
    throw new Error(err?.message || "Failed to create doctor account.", { cause: err });
  }
};

export const createStaffAccount = async (staffData) => {
  if (staffData?.role === "doctor") {
    return createDoctorAccount(staffData);
  }
  // Admin accounts are Admin SDK only (docs/AdminBreakGlass.md).
  if (staffData?.role !== "secretary") {
    throw new Error("Only Secretary or Doctor accounts can be created in the app.");
  }

  if (!staffData.assignedBranch) {
    throw new Error("Assigned Branch is required for Secretary.");
  }

  // Secondary app so the signed-in admin stays logged in
  const secondaryAppName = "SecondaryAppInstance";
  let secondaryApp;
  
  const existingApps = getApps();
  const existingSecondary = existingApps.find(app => app.name === secondaryAppName);
  
  if (existingSecondary) {
    secondaryApp = existingSecondary;
  } else {
    secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
  }

  const secondaryAuth = getAuth(secondaryApp);
  
  try {
    // Create user in Firebase Auth
    const userCredential = await createUserWithEmailAndPassword(
      secondaryAuth,
      staffData.email,
      staffData.password
    );

    const user = userCredential.user;

    // Update Auth Profile
    if (staffData.name) {
      await updateProfile(user, { displayName: staffData.name }).catch(err => console.error("Could not update profile:", err));
    }

    // Save user details to Realtime Database
    const now = Date.now();
    const dbPayload = {
      uid: user.uid,
      name: staffData.name,
      email: staffData.email,
      phone: staffData.phone || "",
      role: "secretary",
      status: "active",
      createdAt: now,
      updatedAt: now,
      hasCompletedTour: false,
      assignedBranch: staffData.assignedBranch,
    };

    if (staffData.assignedBranchId) {
      dbPayload.assignedBranchId = staffData.assignedBranchId;
    }

    await set(ref(getDb(), `users/${user.uid}`), dbPayload);

    const callerToken = await auth.currentUser?.getIdTokenResult();
    if (callerToken?.claims?.isDemo === true) {
      const functions = getFunctions(app, "asia-southeast1");
      const stampDemoClaim = httpsCallable(functions, "stampDemoClaim");
      await stampDemoClaim({ uid: user.uid });
    }

    // Sign out from the secondary app instance
    await signOut(secondaryAuth);
    
    // Delete the secondary app instance to clean up
    await deleteApp(secondaryApp);

    // Audit Log
    logAuditEvent({
      action: AUDIT_ACTIONS.USER_CREATED,
      category: AUDIT_CATEGORIES.USER_MANAGEMENT,
      description: `Created a new secretary account for ${staffData.name}`,
      targetType: "user",
      targetId: user.uid
    });

    return user;
  } catch (error) {
    // Clean up on error as well
    if (secondaryAuth.currentUser) {
      await signOut(secondaryAuth).catch(() => {});
    }
    await deleteApp(secondaryApp).catch(() => {});
    throw error;
  }
};

export const updateUser = async (uid, updates) => {
  if (!auth.currentUser) throw new Error("Authentication required.");

  const sanitized = {};
  for (const key of PROFILE_UPDATE_ALLOWLIST) {
    if (Object.prototype.hasOwnProperty.call(updates, key)) {
      sanitized[key] = updates[key];
    }
  }

  if (Object.keys(sanitized).length === 0) {
    throw new Error("No allowed profile fields to update.");
  }

  const targetSnap = await get(ref(getDb(), `users/${uid}`));
  const target = targetSnap.exists() ? targetSnap.val() : null;
  const callerRole = await getCallerRole();

  const gate = assertAdminCanUpdateUserProfile({
    callerRole,
    targetRole: target?.role,
    updates: sanitized,
  });
  if (!gate.ok) {
    const err = new Error(gate.message);
    err.status = gate.status;
    err.code = "permission-denied";
    throw err;
  }

  let completed = false;
  const token = await auth.currentUser.getIdToken();
  const apiBase = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

  try {
    const res = await fetch(`${apiBase}/api/admin/update-user`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ uid, updates: sanitized }),
    });

    if (res.ok) {
      completed = true;
    } else {
      const body = await res.json().catch(() => ({}));
      if (res.status === 400 || res.status === 401 || res.status === 403 || res.status === 404) {
        const err = new Error(body.error || "Failed to update user.");
        err.status = res.status;
        err.code = res.status === 403 ? "permission-denied" : "request_failed";
        throw err;
      }
    }
  } catch (err) {
    if (err instanceof TypeError) {
      completed = false;
    } else {
      throw err;
    }
  }

  if (!completed) {
    if (target?.role === "parent") {
      const err = new Error("Parent profile information cannot be edited by staff.");
      err.status = 403;
      err.code = "permission-denied";
      throw err;
    }

    let callableOk = false;
    try {
      const functions = getFunctions(app, "asia-southeast1");
      const callUpdate = httpsCallable(functions, "updateUserAccount");
      await callUpdate({ uid, updates: sanitized });
      callableOk = true;
    } catch {
      callableOk = false;
    }

    if (!callableOk) {
      // Local fallback for staff edits when Admin SDK / Functions are unavailable.
      const { update } = await import("firebase/database");
      await update(ref(getDb(), `users/${uid}`), {
        ...sanitized,
        updatedAt: Date.now(),
      });
    }
  }

  logAuditEvent({
    action: AUDIT_ACTIONS.USER_EDITED,
    category: AUDIT_CATEGORIES.USER_MANAGEMENT,
    description: `Updated user profile details`,
    targetType: "user",
    targetId: uid
  });
};

/**
 * Doctor deactivate/reactivate always goes through the server (one-active-doctor rule, audit, token revoke).
 * There is no client-side fallback write.
 */
export const setDoctorAccountStatus = async (uid, status) => {
  if (!auth.currentUser) throw new Error("Authentication required.");
  const token = await auth.currentUser.getIdToken();
  const apiBase = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
  try {
    const res = await fetch(`${apiBase}/api/admin/doctor-status`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ uid, status }),
    });
    const isJson = (res.headers.get("content-type") || "").includes("application/json");
    if (res.ok && isJson) return await res.json();
    if (isJson && SERVER_CLIENT_ERRORS.has(res.status)) {
      const body = await res.json().catch(() => ({}));
      const err = new Error(body.error || "Failed to change doctor status.");
      err.status = res.status;
      throw err;
    }
  } catch (err) {
    if (!(err instanceof TypeError)) throw err;
  }

  const functions = getFunctions(app, "asia-southeast1");
  const callSetStatus = httpsCallable(functions, "setDoctorAccountStatus");
  try {
    const response = await callSetStatus({ uid, status });
    return response?.data || response;
  } catch (err) {
    throw new Error(err?.message || "Failed to change doctor status.", { cause: err });
  }
};

export const toggleUserStatus = async (uid, currentStatus) => {
  if (!auth.currentUser) throw new Error("Authentication required.");
  if (auth.currentUser.uid === uid) {
    throw new Error("You cannot deactivate or reactivate your own account.");
  }

  const targetSnap = await get(ref(getDb(), `users/${uid}`));
  const target = targetSnap.exists() ? targetSnap.val() : null;
  if (target?.role === "admin") {
    throw new Error("Admin accounts cannot be deactivated in the app.");
  }

  const newStatus = currentStatus === "active" ? "inactive" : "active";

  if (target?.role === "doctor") {
    await setDoctorAccountStatus(uid, newStatus);
    return newStatus;
  }
  const targetLabel = target?.name ? ` for ${target.name}` : "";

  const userRef = ref(getDb(), `users/${uid}`);
  const { update } = await import("firebase/database");
  await update(userRef, {
    status: newStatus,
    // "admin" = administrative deactivation (blocks staff self-reactivation)
    deactivationSource: newStatus === "inactive" ? "admin" : null,
    updatedAt: Date.now()
  });
  
  logAuditEvent({
    action: newStatus === "active" ? AUDIT_ACTIONS.USER_ACTIVATED : AUDIT_ACTIONS.USER_DEACTIVATED,
    category: AUDIT_CATEGORIES.USER_MANAGEMENT,
    description: newStatus === "active"
      ? `Reactivated user account${targetLabel}`
      : `Deactivated user account${targetLabel}`,
    targetType: "user",
    targetId: uid
  });

  return newStatus;
};

const sendResetEmail = async (email) => {
  if (!email || !String(email).trim()) {
    const err = new Error("This account has no email on file. A password reset email cannot be sent.");
    err.code = "missing_email";
    throw err;
  }

  return sendPasswordResetLink(email, getPasswordResetActionSettings({ handleCodeInApp: false }));
};

/**
 * Direct secretary or doctor password reset (no email). Returns a one-time temporary password.
 * Never log the returned password.
 */
export const resetStaffPasswordDirect = async (uid) => {
  if (!uid) throw new Error("A user id is required.");
  if (!auth.currentUser) throw new Error("Authentication required.");
  if (auth.currentUser.uid === uid) {
    throw new Error("You cannot reset your own password through this action.");
  }

  const targetSnap = await get(ref(getDb(), `users/${uid}`));
  const target = targetSnap.exists() ? targetSnap.val() : null;
  if (!isDirectPasswordResetRole(target?.role)) {
    const err = new Error("Direct password reset is only allowed for secretary and doctor accounts.");
    err.status = 403;
    err.code = "permission-denied";
    throw err;
  }

  let result = null;
  const token = await auth.currentUser.getIdToken();
  const apiBase = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

  try {
    const res = await fetch(`${apiBase}/api/admin/reset-secretary-password`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ uid }),
    });

    if (res.ok) {
      result = await res.json();
    } else {
      const body = await res.json().catch(() => ({}));
      if (res.status === 400 || res.status === 401 || res.status === 403 || res.status === 404) {
        const err = new Error(body.error || "Failed to reset staff password.");
        err.status = res.status;
        err.code = res.status === 403 ? "permission-denied" : "request_failed";
        throw err;
      }
    }
  } catch (err) {
    if (err instanceof TypeError) {
      result = null;
    } else {
      throw err;
    }
  }

  if (!result?.temporaryPassword) {
    const functions = getFunctions(app, "asia-southeast1");
    const callReset = httpsCallable(functions, "resetSecretaryPassword");
    const response = await callReset({ uid });
    result = response?.data || response;
  }

  if (!result?.temporaryPassword) {
    throw new Error("Failed to reset staff password.");
  }

  const staffName = target?.name || result.staffName || null;
  logAuditEvent({
    action: AUDIT_ACTIONS.USER_PASSWORD_RESET,
    category: AUDIT_CATEGORIES.USER_MANAGEMENT,
    description: buildStaffPasswordResetAuditDescription(staffName, target.role),
    targetType: "user",
    targetId: uid,
  });

  return {
    temporaryPassword: result.temporaryPassword,
    staffName,
    role: target.role,
  };
};

/**
 * Parent password reset via email — audited. Reset emails are for parents only.
 */
export const sendParentPasswordResetEmail = async ({ email, uid, name }) => {
  await sendResetEmail(email);
  logAuditEvent({
    action: AUDIT_ACTIONS.USER_PASSWORD_RESET,
    category: AUDIT_CATEGORIES.USER_MANAGEMENT,
    description: `Sent password reset email for parent${name ? ` ${name}` : ""}`,
    targetType: "user",
    targetId: uid || null,
  });
};

export const deleteUserAccount = async (uid) => {
  if (!uid) throw new Error("A user id is required.");
  if (!auth.currentUser) throw new Error("Authentication required.");
  if (auth.currentUser.uid === uid) {
    throw new Error("You cannot delete your own account.");
  }

  const snapshot = await get(ref(getDb(), `users/${uid}`));
  const target = snapshot.exists() ? snapshot.val() : null;
  if (target?.role === "admin") {
    throw new Error("Admin accounts cannot be deleted.");
  }
  const isDoctorTarget = target?.role === "doctor";

  let completed = false;
  const token = await auth.currentUser.getIdToken();
  const apiBase = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

  try {
    const res = await fetch(`${apiBase}/api/admin/delete-user`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ uid }),
    });

    const isJson = (res.headers.get("content-type") || "").includes("application/json");
    if (res.ok && isJson) {
      completed = true;
    } else if (isJson && SERVER_CLIENT_ERRORS.has(res.status)) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || "Failed to delete user.");
    }
  } catch (err) {
    if (err instanceof TypeError) {
      completed = false;
    } else {
      throw err;
    }
  }

  if (!completed) {
    const functions = getFunctions(app, "asia-southeast1");
    const callDelete = httpsCallable(functions, "deleteUserAccount");
    try {
      await callDelete({ uid });
    } catch (err) {
      throw new Error(err?.message || "Failed to delete user.", { cause: err });
    }
  }

  // Doctor deletes are audited server-side (actorRole "admin", name/email snapshot).
  if (isDoctorTarget) return;

  logAuditEvent({
    action: AUDIT_ACTIONS.USER_DELETED,
    category: AUDIT_CATEGORIES.USER_MANAGEMENT,
    description: `Deleted user account${target?.name ? ` for ${target.name}` : ""}`,
    targetType: "user",
    targetId: uid,
  });
};
