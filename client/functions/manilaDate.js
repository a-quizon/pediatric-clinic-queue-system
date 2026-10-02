const MANILA_TZ = "Asia/Manila";
const BOOKING_HORIZON_DAYS = 60;

function manilaDateString(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: MANILA_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function manilaNowMinutes(date = new Date()) {
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

function addManilaDays(dateStr, days) {
  const utc = manilaNoonUtc(dateStr);
  utc.setUTCDate(utc.getUTCDate() + Number(days || 0));
  return manilaDateString(utc);
}

function minutesFromTime(value) {
  const [hour, minute] = String(value || "").split(":").map(Number);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  return hour * 60 + minute;
}

function formatTime12h(value) {
  const minutes = minutesFromTime(value);
  if (minutes == null) return String(value || "");
  const hour = Math.floor(minutes / 60);
  const minute = String(minutes % 60).padStart(2, "0");
  return `${hour % 12 || 12}:${minute} ${hour >= 12 ? "PM" : "AM"}`;
}

const WEEKDAY_KEYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

function manilaWeekdayIndex(dateStr) {
  return manilaNoonUtc(dateStr).getUTCDay();
}

module.exports = {
  MANILA_TZ,
  BOOKING_HORIZON_DAYS,
  WEEKDAY_KEYS,
  manilaDateString,
  manilaNowMinutes,
  addManilaDays,
  manilaWeekdayIndex,
  minutesFromTime,
  formatTime12h,
};
