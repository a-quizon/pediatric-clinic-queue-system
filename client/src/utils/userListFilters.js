export const USER_ROLE_FILTER_OPTIONS = [
  { value: "all", label: "All Roles" },
  { value: "staff", label: "Staff" },
  { value: "admin", label: "Admin" },
  { value: "doctor", label: "Doctor" },
  { value: "secretary", label: "Secretary" },
  { value: "parent", label: "Parent" },
];

const ROLE_FILTER_VALUES = new Set(USER_ROLE_FILTER_OPTIONS.map((option) => option.value));

/** `?role=` value for Admin → Users, or null when it is missing or unknown. */
export function parseUserRoleParam(value) {
  return value && value !== "all" && ROLE_FILTER_VALUES.has(value) ? value : null;
}

/** "Staff" is clinic staff only (doctor and secretary); admins have their own filter. */
export function matchesUserRoleFilter(user, roleFilter) {
  if (!roleFilter || roleFilter === "all") return true;
  if (roleFilter === "staff") return user?.role === "doctor" || user?.role === "secretary";
  return user?.role === roleFilter;
}

/** Users listed in Admin → Users: everyone except soft-deleted profiles and the legacy `admin` placeholder node. */
export function isListedUser(user) {
  return Boolean(user && user.id !== "admin" && user.isDeleted !== true);
}
