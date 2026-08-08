import { ref, push, set } from "firebase/database";
import { database } from "../firebase/database";
import { auth } from "../firebase/auth";

export const AUDIT_CATEGORIES = {
  USER_MANAGEMENT: "user_management",
  BRANCH_MANAGEMENT: "branch_management",
  SCHEDULE_MANAGEMENT: "schedule_management",
  QUEUE_OPERATIONS: "queue_operations",
  QUEUE_INTERVENTION: "queue_intervention"
};

export const AUDIT_ACTIONS = {
  // User Management
  USER_CREATED: "USER_CREATED",
  USER_ACTIVATED: "USER_ACTIVATED",
  USER_DEACTIVATED: "USER_DEACTIVATED",
  USER_EDITED: "USER_EDITED",
  
  // Branch Management
  BRANCH_CREATED: "BRANCH_CREATED",
  BRANCH_DELETED: "BRANCH_DELETED",
  BRANCH_EDITED: "BRANCH_EDITED",
  
  // Schedule Management
  SCHEDULE_PUBLISHED: "SCHEDULE_PUBLISHED",
  SCHEDULE_COMPLETED: "SCHEDULE_COMPLETED",
  
  // Queue Operations
  QUEUE_STARTED: "QUEUE_STARTED",
  QUEUE_PAUSED: "QUEUE_PAUSED",
  QUEUE_RESUMED: "QUEUE_RESUMED",
  QUEUE_CLOSED: "QUEUE_CLOSED",
  
  // Queue Intervention
  PATIENT_FORFEITED: "PATIENT_FORFEITED",
  PATIENT_PENALIZED: "PATIENT_PENALIZED"
};

/**
 * Centralized audit logging service.
 * @param {Object} params
 * @param {string} params.action - From AUDIT_ACTIONS
 * @param {string} params.category - From AUDIT_CATEGORIES
 * @param {string} params.description - Human readable summary of the event
 * @param {string} [params.targetType] - e.g., 'user', 'branch', 'schedule', 'reservation'
 * @param {string} [params.targetId] - The ID of the affected resource
 * @param {string} [params.branchId] - Optional branch context
 * @param {string} [params.actorRole] - Optional explicitly provided role
 */
export const logAuditEvent = async ({
  action,
  category,
  description,
  targetType = null,
  targetId = null,
  branchId = null,
  actorRole = null
}) => {
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      console.warn(`Audit Service: No authenticated user. Cannot log event: ${action}`);
      return false;
    }

    if (!action || !category || !description) {
      console.warn("Audit Service: Missing required fields (action, category, description)");
      return false;
    }

    const auditRef = ref(database, 'auditLogs');
    const newLogRef = push(auditRef);

    const logEntry = {
      action,
      category,
      actorUid: currentUser.uid,
      actorName: currentUser.displayName || "Unknown User",
      actorRole: actorRole || "unknown", // Optional fallback since service files don't have AuthContext
      description,
      timestamp: Date.now(),
    };

    if (targetType) logEntry.targetType = targetType;
    if (targetId) logEntry.targetId = targetId;
    if (branchId) logEntry.branchId = branchId;

    await set(newLogRef, logEntry);
    return true;

  } catch (error) {
    // IMPORTANT: Audit logging is secondary to primary business logic.
    // If an audit fails (e.g., due to network drop or security rules),
    // we catch and log it rather than breaking the user's action.
    console.error(`Audit Service: Failed to write audit log for ${action}`, error);
    return false;
  }
};
