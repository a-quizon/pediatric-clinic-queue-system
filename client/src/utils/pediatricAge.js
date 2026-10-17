/**
 * Pediatric age helpers. Birthdate is stored as date-only YYYY-MM-DD.
 * Age is always computed (never persisted as the source of truth).
 */
import { MANILA_TZ, manilaDateString } from "./manilaDate.js";

export const MAX_PEDIATRIC_AGE_YEARS = 18;
export const BIRTHDATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseDateParts(dateStr) {
  if (!BIRTHDATE_RE.test(String(dateStr || ""))) return null;
  const [y, m, d] = String(dateStr).split("-").map(Number);
  if (!y || !m || !d) return null;
  // Reject impossible calendar dates (e.g. 2023-02-30)
  const probe = new Date(Date.UTC(y, m - 1, d, 4, 0, 0));
  if (
    probe.getUTCFullYear() !== y ||
    probe.getUTCMonth() !== m - 1 ||
    probe.getUTCDate() !== d
  ) {
    return null;
  }
  return { year: y, month: m, day: d };
}

function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0, 4, 0, 0)).getUTCDate();
}

/** Clamp day into the target month (Feb 29 → Feb 28/29 as needed). */
function clampDay(year, month, day) {
  return Math.min(day, daysInMonth(year, month));
}

/**
 * @returns {{ years: number, months: number, days: number } | null}
 */
export function calculateAge(birthdate, asOf = manilaDateString()) {
  const birth = parseDateParts(birthdate);
  const asOfParts = parseDateParts(asOf);
  if (!birth || !asOfParts) return null;

  const birthKey = `${birth.year}-${String(birth.month).padStart(2, "0")}-${String(birth.day).padStart(2, "0")}`;
  const asOfKey = `${asOfParts.year}-${String(asOfParts.month).padStart(2, "0")}-${String(asOfParts.day).padStart(2, "0")}`;
  if (birthKey > asOfKey) return null;

  let years = asOfParts.year - birth.year;
  let months = asOfParts.month - birth.month;
  let days = asOfParts.day - birth.day;

  if (days < 0) {
    months -= 1;
    const prevMonth = asOfParts.month === 1 ? 12 : asOfParts.month - 1;
    const prevYear = asOfParts.month === 1 ? asOfParts.year - 1 : asOfParts.year;
    days += daysInMonth(prevYear, prevMonth);
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }

  return { years, months, days };
}

export function getBirthdateError(birthdate, asOf = manilaDateString()) {
  if (!birthdate) return "Birthdate is required.";
  if (!parseDateParts(birthdate)) return "Enter a valid birthdate.";
  if (birthdate > asOf) return "Birthdate cannot be in the future.";
  const age = calculateAge(birthdate, asOf);
  if (!age) return "Enter a valid birthdate.";
  if (age.years > MAX_PEDIATRIC_AGE_YEARS) {
    return `Pediatric patients must be ${MAX_PEDIATRIC_AGE_YEARS} years or younger.`;
  }
  if (age.years === MAX_PEDIATRIC_AGE_YEARS && (age.months > 0 || age.days > 0)) {
    return `Pediatric patients must be ${MAX_PEDIATRIC_AGE_YEARS} years or younger.`;
  }
  return "";
}

export function isValidBirthdate(birthdate, asOf = manilaDateString()) {
  return !getBirthdateError(birthdate, asOf);
}

/**
 * Staff-facing pediatric age string.
 * < 1 month → days; < 2 years → months; else years (+ months if > 0).
 */
export function formatPediatricAge(birthdate, asOf = manilaDateString()) {
  const age = calculateAge(birthdate, asOf);
  if (!age) return "";

  const totalMonths = age.years * 12 + age.months;
  if (totalMonths < 1) {
    const d = Math.max(age.days, 0);
    return d === 1 ? "1 day" : `${d} days`;
  }
  if (age.years < 2) {
    return totalMonths === 1 ? "1 month" : `${totalMonths} months`;
  }
  if (age.months === 0) {
    return age.years === 1 ? "1 year" : `${age.years} years`;
  }
  const yearPart = age.years === 1 ? "1 year" : `${age.years} years`;
  const monthPart = age.months === 1 ? "1 month" : `${age.months} months`;
  return `${yearPart}, ${monthPart}`;
}

/** Parent-facing long date, e.g. "March 5, 2019". */
export function formatBirthdateLong(birthdate) {
  const parts = parseDateParts(birthdate);
  if (!parts) return "";
  const utc = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 4, 0, 0));
  return new Intl.DateTimeFormat("en-US", {
    timeZone: MANILA_TZ,
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(utc);
}

/**
 * Role-shaped child view for UI.
 * parent → birthdate display only; secretary/doctor → age display only.
 */
export function presentChildForRole(child, role = "parent", asOf = manilaDateString()) {
  const base = {
    childId: child?.childId || child?.id || null,
    childName: child?.childName || "",
    sex: child?.sex || "",
  };
  const birthdate = child?.birthdate ? String(child.birthdate) : "";
  const legacyAge = child?.age != null && child.age !== "" ? String(child.age) : "";

  if (role === "parent") {
    return {
      ...base,
      birthdate,
      birthdateDisplay: birthdate ? formatBirthdateLong(birthdate) : "",
      needsBirthdate: !birthdate,
    };
  }

  let ageDisplay = "";
  if (birthdate) {
    ageDisplay = formatPediatricAge(birthdate, asOf);
  } else if (legacyAge) {
    ageDisplay = /^\d+$/.test(legacyAge) ? `${legacyAge} years` : legacyAge;
  }

  return {
    ...base,
    ageDisplay,
    hasLegacyAgeOnly: Boolean(!birthdate && legacyAge),
  };
}

export { clampDay };
