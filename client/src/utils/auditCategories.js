/** Single source of truth: stable stored keys + title-case display labels. */
export const AUDIT_CATEGORY_DEFS = [
  { key: "user_management", label: "User Management" },
  { key: "branch_management", label: "Branch Management" },
  { key: "schedule_management", label: "Schedule Management" },
  { key: "queue_operations", label: "Queue Operations" },
  { key: "queue_intervention", label: "Queue Intervention" },
  { key: "system_management", label: "System Management" },
];

/** Constant-name → stored key (for writers). */
export const AUDIT_CATEGORIES = Object.fromEntries(
  AUDIT_CATEGORY_DEFS.map(({ key }) => [key.toUpperCase(), key])
);

/** Stored key → display label. */
export const AUDIT_CATEGORY_LABELS = Object.fromEntries(
  AUDIT_CATEGORY_DEFS.map(({ key, label }) => [key, label])
);
