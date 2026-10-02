import {
  BOOKING_HORIZON_DAYS,
  WEEKDAY_KEYS,
  manilaDateString,
  manilaNowMinutes,
  addManilaDays,
  manilaWeekdayIndex,
} from "./manilaDate.js";
import { closureForDate, scheduleForDate, formatClinicClock } from "./scheduleCalendar.js";

// UX mirror of client/functions/scheduleOpeningRules.js (the server is authoritative).

function minutesFromTime(value) {
  const [hour, minute] = String(value || "").split(":").map(Number);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  return hour * 60 + minute;
}

function locationLabel(name) {
  return String(name || "this branch").trim().replace(/\s+branch$/i, "") || "this branch";
}

function weekdayLabel(dateStr) {
  const key = WEEKDAY_KEYS[manilaWeekdayIndex(dateStr)];
  return key.charAt(0).toUpperCase() + key.slice(1);
}

export function clinicBlocksForDate(branch, dateStr) {
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

export function clinicHoursForDate(branch, dateStr) {
  const blocks = clinicBlocksForDate(branch, dateStr);
  if (blocks.length === 0) return null;
  const last = blocks.reduce((latest, block) =>
    minutesFromTime(block.closingTime) > minutesFromTime(latest.closingTime) ? block : latest
  );
  return { openingTime: blocks[0].openingTime, closingTime: last.closingTime };
}

/** True once today's last clinic block at this branch has closed (Asia/Manila). */
export function clinicHoursEnded(branch, dateStr, today = manilaDateString(), nowMinutes = manilaNowMinutes()) {
  if (dateStr !== today) return false;
  const hours = clinicHoursForDate(branch, dateStr);
  return Boolean(hours) && nowMinutes >= minutesFromTime(hours.closingTime);
}

function reject(code, message) {
  return { ok: false, code, message, hours: null };
}

export function checkScheduleOpening({
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
  if (closureForDate(closures, dateStr, id, name)) {
    return reject("closure", `The ${label} clinic is closed on this date.`);
  }
  if (scheduleForDate(schedules, dateStr, id, name)) {
    return reject("exists", `A schedule for ${label} on this date already exists.`);
  }
  const hours = clinicHoursForDate(branch, dateStr);
  if (!hours) {
    return reject("weekday_closed", `The ${label} clinic is closed on ${weekdayLabel(dateStr)}s.`);
  }
  if (dateStr === today && nowMinutes >= minutesFromTime(hours.closingTime)) {
    return reject(
      "after_hours",
      `You cannot open a reservation because today's clinic hours at ${label} have already ended (${formatClinicClock(hours.openingTime)} to ${formatClinicClock(hours.closingTime)}).`
    );
  }
  return { ok: true, code: null, message: "", hours };
}
