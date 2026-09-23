export const MANILA_TZ = "Asia/Manila";
export const BOOKING_HORIZON_DAYS = 60;

export const WEEKDAY_KEYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

export function manilaDateString(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: MANILA_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function manilaNowMinutes(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: MANILA_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const hour = Number(parts.find((part) => part.type === "hour")?.value || 0);
  const minute = Number(parts.find((part) => part.type === "minute")?.value || 0);
  return hour * 60 + minute;
}

function manilaNoonUtc(dateStr) {
  const [year, month, day] = String(dateStr).split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 4, 0, 0));
}

export function addManilaDays(dateStr, days) {
  const utc = manilaNoonUtc(dateStr);
  utc.setUTCDate(utc.getUTCDate() + Number(days || 0));
  return manilaDateString(utc);
}

export function manilaWeekdayIndex(dateStr) {
  return manilaNoonUtc(dateStr).getUTCDay();
}

export function eachDateInclusive(start, end) {
  if (!start || !end || start > end) return [];
  const dates = [];
  let cursor = start;
  while (cursor <= end && dates.length < 400) {
    dates.push(cursor);
    cursor = addManilaDays(cursor, 1);
  }
  return dates;
}

export function weekStartSunday(dateStr) {
  return addManilaDays(dateStr, -manilaWeekdayIndex(dateStr));
}

export function shiftMonth(year, monthIndex, delta) {
  const shifted = new Date(Date.UTC(year, monthIndex + delta, 1, 4, 0, 0));
  return { year: shifted.getUTCFullYear(), monthIndex: shifted.getUTCMonth() };
}

export function manilaMonthMeta(year, monthIndex) {
  const month = String(monthIndex + 1).padStart(2, "0");
  const first = `${year}-${month}-01`;
  let last = first;
  let cursor = first;
  while (cursor.slice(0, 7) === first.slice(0, 7)) {
    last = cursor;
    cursor = addManilaDays(cursor, 1);
  }
  return { first, last, leadBlanks: manilaWeekdayIndex(first) };
}

export function formatManilaLong(dateStr) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: MANILA_TZ,
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(manilaNoonUtc(dateStr));
}

export function formatManilaMonth(year, monthIndex) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: MANILA_TZ,
    month: "long",
    year: "numeric",
  }).format(manilaNoonUtc(`${year}-${String(monthIndex + 1).padStart(2, "0")}-01`));
}

export function formatManilaWeekday(dateStr) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: MANILA_TZ,
    weekday: "long",
  }).format(manilaNoonUtc(dateStr));
}

export function bookingHorizonEnd(today = manilaDateString()) {
  return addManilaDays(today, BOOKING_HORIZON_DAYS);
}
