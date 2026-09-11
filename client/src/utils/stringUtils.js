/**
 * Formats a name to Capitalized Each Word, correctly handling hyphens and apostrophes.
 * @param {string} name - The name to format
 * @returns {string} The formatted name
 */
export const formatName = (name) => {
  if (!name) return "";
  return name
    .trim()
    .toLowerCase()
    .replace(/(?:^|[\s-'])\w/g, (match) => match.toUpperCase());
};

/**
 * Strips a trailing "Branch" suffix and normalizes whitespace/case for comparisons.
 * Lets "Angeles Branch" and "Angeles" resolve as the same location after renames.
 */
export const normalizeBranchName = (name) => {
  if (!name || typeof name !== "string") return "";
  return name
    .trim()
    .replace(/\s+branch$/i, "")
    .replace(/\s+/g, " ")
    .toLowerCase();
};

/** Exact or normalized branch-name equality (legacy string matching). */
export const branchesMatch = (a, b) => {
  if (!a || !b) return false;
  if (a === b) return true;
  return normalizeBranchName(a) === normalizeBranchName(b);
};

/**
 * Prefer stable branch IDs when present; fall back to normalized name match.
 * Use for secretary ↔ schedule isolation after branch renames.
 */
export const scheduleMatchesAssignedBranch = (schedule, user) => {
  if (!schedule || !user) return false;
  if (schedule.branchId && user.assignedBranchId) {
    return schedule.branchId === user.assignedBranchId;
  }
  return branchesMatch(schedule.branch, user.assignedBranch);
};

/** Display label that avoids "Angeles Branch Branch" after renames. */
export const formatBranchLabel = (name) => {
  if (!name) return "";
  const trimmed = name.trim();
  if (/\bbranch$/i.test(trimmed)) return trimmed;
  return `${trimmed} Branch`;
};
