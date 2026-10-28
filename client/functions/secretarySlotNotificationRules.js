/**
 * Pure helpers for secretary Notification Center + Web Push on parent
 * reserve / cancel. Shared by Express notificationEngine and Cloud Functions pushRuntime.
 */

function normalizeBranchName(name) {
  if (!name || typeof name !== "string") return "";
  return name
    .trim()
    .replace(/\s+branch$/i, "")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function formatClinicDateLabel(clinicDate) {
  if (!clinicDate) return "an upcoming clinic day";
  try {
    const parts = String(clinicDate).split("-").map(Number);
    const y = parts[0];
    const m = parts[1];
    const d = parts[2];
    if (!y || !m || !d) return String(clinicDate);
    const utc = new Date(Date.UTC(y, m - 1, d, 4, 0, 0));
    return new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Manila",
      month: "long",
      day: "numeric",
      year: "numeric",
    }).format(utc);
  } catch {
    return String(clinicDate);
  }
}

/**
 * Active secretary assigned to the reservation's branch.
 */
function secretaryMatchesBranch(user, { branchId = null, branch = null } = {}) {
  if (!user || user.role !== "secretary") return false;
  if (user.status === "inactive" || user.isDeleted === true) return false;

  if (branchId && user.assignedBranchId && String(branchId) === String(user.assignedBranchId)) {
    return true;
  }

  const reservationBranch = branch || branchId;
  if (reservationBranch && user.assignedBranch) {
    if (String(reservationBranch) === String(user.assignedBranch)) return true;
    if (normalizeBranchName(reservationBranch) === normalizeBranchName(user.assignedBranch)) {
      return true;
    }
  }

  return false;
}

/**
 * @param {Record<string, object>|null|undefined} usersMap
 * @param {{ branchId?: string|null, branch?: string|null }} branchInfo
 * @returns {string[]}
 */
function listActiveSecretaryIdsForBranch(usersMap, branchInfo = {}) {
  if (!usersMap || typeof usersMap !== "object") return [];
  const ids = [];
  Object.entries(usersMap).forEach(([uid, user]) => {
    if (secretaryMatchesBranch(user, branchInfo)) ids.push(uid);
  });
  return ids;
}

/**
 * Secretary Notification Center / push events for parent reserve + cancel.
 * Create: new reservation with parentId. Cancel: status → cancelled (not clinic cancel).
 *
 * @param {object|null} before
 * @param {object|null} after
 * @returns {Array<object>}
 */
function secretaryEventsFromReservationChange(before, after) {
  const events = [];
  if (!after?.parentId || !after?.id) return events;

  const branchId = after.branchId || null;
  const branch = after.branch || null;
  const clinicDate = after.clinicDate || null;
  const dateLabel = formatClinicDateLabel(clinicDate);
  const base = {
    reservationId: after.id,
    scheduleId: after.scheduleId || null,
    branchId: branchId || branch,
    clinicDate,
    parentId: after.parentId,
  };

  if (!before) {
    events.push({
      ...base,
      eventId: "SECRETARY_SLOT_RESERVED",
      customMessage: `A parent reserved a slot on ${dateLabel}.`,
      dedupeKey: `sec_reserved_${after.id}`,
    });
  }

  const prevStatus = before?.status;
  const currStatus = after.status;
  if (before && prevStatus !== currStatus && currStatus === "cancelled") {
    events.push({
      ...base,
      eventId: "SECRETARY_SLOT_CANCELLED",
      customMessage: `A parent cancelled their slot on ${dateLabel}.`,
      dedupeKey: `sec_cancelled_${after.id}`,
    });
  }

  return events;
}

module.exports = {
  formatClinicDateLabel,
  normalizeBranchName,
  secretaryMatchesBranch,
  listActiveSecretaryIdsForBranch,
  secretaryEventsFromReservationChange,
};
