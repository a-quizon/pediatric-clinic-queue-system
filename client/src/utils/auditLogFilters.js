export const AUDIT_ROLE_FILTER_OPTIONS = [
  { value: "all", label: "All Roles" },
  { value: "admin", label: "Admin" },
  { value: "doctor", label: "Doctor" },
  { value: "secretary", label: "Secretary" },
  { value: "system", label: "System" },
];

/** Exact actorRole match; entries written before the admin split keep their original actorRole. */
export function matchesAuditRoleFilter(log, roleFilter) {
  if (!roleFilter || roleFilter === "all") return true;
  return log?.actorRole === roleFilter;
}

/** Action / event-type filter options for Admin → Audit Logs. */
export const AUDIT_ACTION_FILTER_OPTIONS = [
  { value: "all", label: "All Actions" },
  { value: "MANUAL_CODE_FAILED", label: "Manual code failed" },
  { value: "MANUAL_CODE_LOCKED", label: "Manual code lockout" },
  { value: "ACCOUNT_FLAGGED_SUSPICIOUS", label: "Suspicious account" },
  { value: "USER_CREATED", label: "User created" },
  { value: "USER_ACTIVATED", label: "User activated" },
  { value: "USER_DEACTIVATED", label: "User deactivated" },
  { value: "USER_DELETED", label: "User deleted" },
  { value: "USER_PASSWORD_RESET", label: "Password reset" },
  { value: "BRANCH_CREATED", label: "Branch created" },
  { value: "BRANCH_EDITED", label: "Branch edited" },
  { value: "BRANCH_DELETED", label: "Branch deleted" },
  { value: "QUEUE_STARTED", label: "Queue started" },
  { value: "QUEUE_PAUSED", label: "Queue paused" },
  { value: "QUEUE_RESUMED", label: "Queue resumed" },
  { value: "QUEUE_CLOSED", label: "Queue closed" },
  { value: "PATIENT_FORFEITED", label: "Patient forfeited" },
  { value: "PATIENT_PENALIZED", label: "Patient penalized" },
  { value: "WALK_IN_CREATED", label: "Walk-in created" },
  { value: "SYSTEM_CONFIGURATION_CHANGED", label: "System configuration" },
  { value: "QUEUE_RULES_UPDATED", label: "Queue rules updated" },
  { value: "SMS_RULES_UPDATED", label: "SMS rules updated" },
  { value: "SCHEDULE_PUBLISHED", label: "Schedule published" },
  { value: "SCHEDULE_RANGE_PUBLISHED", label: "Schedule range published" },
  { value: "SCHEDULE_COMPLETED", label: "Session ended" },
  { value: "SLOT_CAPACITY_UPDATED", label: "Slot capacity updated" },
];

export function matchesAuditActionFilter(log, actionFilter) {
  if (!actionFilter || actionFilter === "all") return true;
  return log?.action === actionFilter;
}
