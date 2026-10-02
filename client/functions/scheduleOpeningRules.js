const {
  BOOKING_HORIZON_DAYS,
  WEEKDAY_KEYS,
  manilaDateString,
  manilaNowMinutes,
  addManilaDays,
  manilaWeekdayIndex,
  minutesFromTime,
  formatTime12h,
} = require("./manilaDate");

// Keep in sync with client/src/utils/scheduleOpeningRules.js (UX mirror).

function normalizeBranchName(name) {
  if (!name || typeof name !== "string") return "";
  return name.trim().replace(/\s+branch$/i, "").replace(/\s+/g, " ").toLowerCase();
}

function branchesMatch(a, b) {
  if (!a || !b) return false;
  return a === b || normalizeBranchName(a) === normalizeBranchName(b);
}

function sameBranch(record, branchId, branchName) {
  if (!record) return false;
  if (branchId && record.branchId && record.branchId === branchId) return true;
  return Boolean(branchName && record.branch && branchesMatch(record.branch, branchName));
}

function locationLabel(name) {
  return String(name || "this branch").trim().replace(/\s+branch$/i, "") || "this branch";
}

function weekdayLabel(dateStr) {
  const key = WEEKDAY_KEYS[manilaWeekdayIndex(dateStr)];
  return key.charAt(0).toUpperCase() + key.slice(1);
}

/**
 * Open time blocks for a branch on a date, sorted by opening time. Supports an
 * optional `sessions` array per weekday (e.g. morning + afternoon); otherwise the
 * single openingTime/closingTime pair. Returns [] when the branch is closed.
 */
function clinicBlocksForDate(branch, dateStr) {
  const day = branch?.schedule?.[WEEKDAY_KEYS[manilaWeekdayIndex(dateStr)]];
  if (!day?.isOpen) return [];
  const raw = Array.isArray(day.sessions) && day.sessions.length > 0
    ? day.sessions
    : [{ openingTime: day.openingTime, closingTime: day.closingTime }];
  return raw
    .filter((block) => minutesFromTime(block?.openingTime) != null && minutesFromTime(block?.closingTime) != null)
    .map((block) => ({ openingTime: block.openingTime, closingTime: block.closingTime }))
    .sort((a, b) => minutesFromTime(a.openingTime) - minutesFromTime(b.openingTime));
}

/** First opening and last closing time of the day, or null when closed. */
function clinicHoursForDate(branch, dateStr) {
  const blocks = clinicBlocksForDate(branch, dateStr);
  if (blocks.length === 0) return null;
  const last = blocks.reduce((latest, block) =>
    minutesFromTime(block.closingTime) > minutesFromTime(latest.closingTime) ? block : latest
  );
  return { openingTime: blocks[0].openingTime, closingTime: last.closingTime };
}

function reject(code, message) {
  return { ok: false, code, message, hours: null };
}

/**
 * Single source of truth for whether a doctor/secretary may open (post) a
 * reservation schedule. All comparisons use Asia/Manila. Today is blocked once
 * the current time reaches the last closing time (same as parent booking).
 */
function checkScheduleOpening({
  dateStr,
  branch,
  branchId,
  branchName,
  schedules = [],
  closures = [],
  today = manilaDateString(),
  nowMinutes = manilaNowMinutes(),
}) {
  const name = branch?.name || branchName;
  const id = branch?.id || branchId;
  const label = locationLabel(name);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateStr || ""))) {
    return reject("invalid_date", "Choose a valid date.");
  }
  if (dateStr < today) {
    return reject("past_date", "You cannot open a reservation for a past date.");
  }
  if (dateStr > addManilaDays(today, BOOKING_HORIZON_DAYS)) {
    return reject(
      "beyond_window",
      `You can only open reservations up to ${BOOKING_HORIZON_DAYS} days ahead.`
    );
  }
  const closed = (closures || []).some(
    (closure) =>
      closure?.startDate &&
      closure?.endDate &&
      dateStr >= closure.startDate &&
      dateStr <= closure.endDate &&
      sameBranch(closure, id, name)
  );
  if (closed) {
    return reject("closure", `The ${label} clinic is closed on this date.`);
  }
  const existing = (schedules || []).some(
    (schedule) => schedule?.clinicDate === dateStr && sameBranch(schedule, id, name)
  );
  if (existing) {
    return reject("exists", `A schedule for ${label} on this date already exists.`);
  }
  const hours = clinicHoursForDate(branch, dateStr);
  if (!hours) {
    return reject("weekday_closed", `The ${label} clinic is closed on ${weekdayLabel(dateStr)}s.`);
  }
  if (dateStr === today && nowMinutes >= minutesFromTime(hours.closingTime)) {
    return reject(
      "after_hours",
      `You cannot open a reservation because today's clinic hours at ${label} have already ended (${formatTime12h(hours.openingTime)} to ${formatTime12h(hours.closingTime)}).`
    );
  }
  return { ok: true, code: null, message: "", hours };
}

module.exports = {
  clinicBlocksForDate,
  clinicHoursForDate,
  checkScheduleOpening,
  sameBranch,
  branchesMatch,
};
