import {
  AUDIT_CATEGORY_DEFS,
  AUDIT_CATEGORY_LABELS,
} from "./auditCategories.js";

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

/** Normalize stored category for comparison (handles legacy SYSTEM_MANAGEMENT, etc.). */
export function normalizeAuditCategory(value) {
  if (value == null || value === "") return "";
  return String(value).trim().toLowerCase();
}

/** Category filter options for Admin → Audit Logs (excludes "all"). */
export const AUDIT_CATEGORY_FILTER_OPTIONS = AUDIT_CATEGORY_DEFS.map(({ key, label }) => ({
  value: key,
  label,
}));

/** Match by stable key; legacy uppercase / mixed-case values normalize to the same key. */
export function matchesAuditCategoryFilter(log, categoryFilter) {
  if (!categoryFilter || categoryFilter === "all") return true;
  return normalizeAuditCategory(log?.category) === normalizeAuditCategory(categoryFilter);
}

/** Title-case label from the shared defs; unknown values get a best-effort title case. */
export function formatAuditCategoryLabel(value) {
  if (!value) return "System";
  const normalized = normalizeAuditCategory(value);
  if (AUDIT_CATEGORY_LABELS[normalized]) return AUDIT_CATEGORY_LABELS[normalized];
  return normalized
    .split("_")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Floor-ops actions hidden from admin Audit Logs / Dashboard feeds.
 * Writers still create these entries; we only exclude them from admin views.
 */
export const ADMIN_AUDIT_EXCLUDED_ACTIONS = Object.freeze([
  "PATIENT_PENALIZED",
  "PATIENT_FORFEITED",
  "WALK_IN_CREATED",
]);

const EXCLUDED_ACTION_SET = new Set(
  ADMIN_AUDIT_EXCLUDED_ACTIONS.map((a) => String(a).trim().toUpperCase())
);

/** Normalize stored action for comparison (case / spacing). */
export function normalizeAuditAction(value) {
  if (value == null || value === "") return "";
  return String(value).trim().toUpperCase().replace(/[\s-]+/g, "_");
}

export function isAdminVisibleAuditLog(log) {
  const action = normalizeAuditAction(log?.action);
  if (!action) return true;
  return !EXCLUDED_ACTION_SET.has(action);
}

export function filterAdminAuditLogs(logs) {
  if (!Array.isArray(logs)) return [];
  return logs.filter(isAdminVisibleAuditLog);
}

/**
 * Single source of truth: raw action → group key + display label.
 * Unmapped (non-excluded) actions fall under "other".
 */
export const AUDIT_ACTION_GROUP_DEFS = [
  {
    key: "create",
    label: "Create",
    actions: ["USER_CREATED", "BRANCH_CREATED"],
  },
  {
    key: "update",
    label: "Update",
    actions: [
      "USER_EDITED",
      "USER_ACTIVATED",
      "USER_DEACTIVATED",
      "BRANCH_EDITED",
      "SLOT_CAPACITY_UPDATED",
      "QUEUE_RULES_UPDATED",
      "SMS_RULES_UPDATED",
      "SYSTEM_CONFIGURATION_CHANGED",
      "CLINIC_DAY_CLOSED",
      "CLINIC_CLOSURE_REMOVED",
    ],
  },
  {
    key: "delete",
    label: "Delete",
    actions: ["USER_DELETED", "BRANCH_DELETED"],
  },
  {
    key: "publish",
    label: "Publish",
    actions: ["SCHEDULE_PUBLISHED", "SCHEDULE_RANGE_PUBLISHED"],
  },
  {
    key: "queue",
    label: "Queue",
    actions: [
      "QUEUE_STARTED",
      "QUEUE_PAUSED",
      "QUEUE_RESUMED",
      "QUEUE_CLOSED",
      "SCHEDULE_COMPLETED",
    ],
  },
  {
    key: "security",
    label: "Security",
    actions: [
      "ACCOUNT_FLAGGED_SUSPICIOUS",
      "SUSPICIOUS_ACCOUNT_DISMISSED",
      "MANUAL_CODE_FAILED",
      "MANUAL_CODE_LOCKED",
      "USER_PASSWORD_RESET",
    ],
  },
  {
    key: "system",
    label: "System",
    actions: ["SMS_SERVICE_STATUS_CHANGED"],
  },
  {
    key: "other",
    label: "Other",
    actions: [],
  },
];

const ACTION_TO_GROUP = (() => {
  const map = new Map();
  for (const group of AUDIT_ACTION_GROUP_DEFS) {
    if (group.key === "other") continue;
    for (const action of group.actions) {
      map.set(normalizeAuditAction(action), group.key);
    }
  }
  return map;
})();

const GROUP_LABELS = Object.fromEntries(
  AUDIT_ACTION_GROUP_DEFS.map(({ key, label }) => [key, label])
);

export function getAuditActionGroup(action) {
  const normalized = normalizeAuditAction(action);
  if (!normalized) return "other";
  if (EXCLUDED_ACTION_SET.has(normalized)) return null;
  return ACTION_TO_GROUP.get(normalized) || "other";
}

export function formatAuditActionGroupLabel(groupKey) {
  if (!groupKey || groupKey === "all") return "All Actions";
  return GROUP_LABELS[groupKey] || "Other";
}

/** Action group filter options for Admin → Audit Logs. */
export const AUDIT_ACTION_FILTER_OPTIONS = [
  { value: "all", label: "All Actions" },
  ...AUDIT_ACTION_GROUP_DEFS.map(({ key, label }) => ({ value: key, label })),
];

/** Match by action group key; "all" matches everything visible. */
export function matchesAuditActionFilter(log, actionFilter) {
  if (!actionFilter || actionFilter === "all") return true;
  const group = getAuditActionGroup(log?.action);
  if (group == null) return false;
  return group === actionFilter;
}
