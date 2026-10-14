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
