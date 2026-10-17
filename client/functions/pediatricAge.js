/**
 * CJS mirror of client/src/utils/pediatricAge.js for Cloud Functions validation.
 */
const { manilaDateString } = require("./manilaDate");

const MAX_PEDIATRIC_AGE_YEARS = 18;
const BIRTHDATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseDateParts(dateStr) {
  if (!BIRTHDATE_RE.test(String(dateStr || ""))) return null;
  const [y, m, d] = String(dateStr).split("-").map(Number);
  if (!y || !m || !d) return null;
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

function calculateAge(birthdate, asOf = manilaDateString()) {
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

function calculateAgeInYears(birthdate, asOf = manilaDateString()) {
  const age = calculateAge(birthdate, asOf);
  return age ? age.years : null;
}

function getBirthdateError(birthdate, asOf = manilaDateString()) {
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

function isValidBirthdate(birthdate, asOf = manilaDateString()) {
  return !getBirthdateError(birthdate, asOf);
}

function getEnteredAgeError(raw) {
  if (raw == null || String(raw).trim() === "") return "Age is required.";
  const trimmed = String(raw).trim();
  if (/^-\d+$/.test(trimmed)) return "Age cannot be negative.";
  if (!/^\d+$/.test(trimmed)) return "Enter age as a whole number in years.";
  const n = Number(trimmed);
  if (!Number.isInteger(n) || n < 0) return "Age cannot be negative.";
  if (n > MAX_PEDIATRIC_AGE_YEARS) {
    return `Pediatric patients must be ${MAX_PEDIATRIC_AGE_YEARS} years or younger.`;
  }
  return "";
}

function formatPediatricAge(birthdate, asOf = manilaDateString()) {
  const years = calculateAgeInYears(birthdate, asOf);
  return years == null ? "" : String(years);
}

module.exports = {
  MAX_PEDIATRIC_AGE_YEARS,
  BIRTHDATE_RE,
  calculateAge,
  calculateAgeInYears,
  getBirthdateError,
  getEnteredAgeError,
  isValidBirthdate,
  formatPediatricAge,
};
