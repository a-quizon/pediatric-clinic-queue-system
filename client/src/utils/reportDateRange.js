import { addManilaDays, manilaDateString } from "./manilaDate.js";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const REPORT_PRESETS = [
  { id: "today", label: "Today" },
  { id: "last7", label: "Last 7 days" },
  { id: "last30", label: "Last 30 days" },
  { id: "thisMonth", label: "This month" },
  { id: "all", label: "All time" },
];

export const DEFAULT_REPORT_PRESET = "all";

/** Inclusive Manila-calendar range for a preset. "all" → { from: "", to: "" } (unbounded). */
export function presetRange(presetId, today = manilaDateString()) {
  switch (presetId) {
    case "today":
      return { from: today, to: today };
    case "last7":
      return { from: addManilaDays(today, -6), to: today };
    case "last30":
      return { from: addManilaDays(today, -29), to: today };
    case "thisMonth":
      return { from: `${today.slice(0, 7)}-01`, to: today };
    default:
      return { from: "", to: "" };
  }
}

export function isValidDateString(value) {
  return typeof value === "string" && DATE_RE.test(value);
}

/** Returns an error message, or null when the range is usable. Empty bounds are open-ended. */
export function validateRange({ from, to } = {}) {
  if (from && !isValidDateString(from)) return "From date is not a valid date.";
  if (to && !isValidDateString(to)) return "To date is not a valid date.";
  if (from && to && from > to) return "From date cannot be after To date.";
  return null;
}

/** Inclusive on both ends; YYYY-MM-DD strings compare lexically. */
export function isDateInRange(dateStr, { from, to } = {}) {
  if (!isValidDateString(dateStr)) return false;
  if (from && dateStr < from) return false;
  if (to && dateStr > to) return false;
  return true;
}

/** Epoch ms / ISO string → Manila calendar day (YYYY-MM-DD), or null. */
export function timestampToManilaDate(value) {
  if (value === null || value === undefined || value === "") return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return manilaDateString(date);
}

export function isTimestampInRange(value, range) {
  const day = timestampToManilaDate(value);
  return day ? isDateInRange(day, range) : false;
}

/** Number of calendar days covered by a bounded range, or Infinity when open-ended. */
export function rangeSpanDays({ from, to } = {}) {
  if (!from || !to) return Infinity;
  const ms = Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`);
  return Math.round(ms / 86400000) + 1;
}
