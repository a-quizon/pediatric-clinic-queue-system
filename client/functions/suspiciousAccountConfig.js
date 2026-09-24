/**
 * Tunable thresholds for parent suspicious-account detection.
 * Keep in sync with client/src/utils/suspiciousAccountConfig.js
 */
const SUSPICIOUS_ACCOUNT_CONFIG = {
  CONSECUTIVE_NO_SHOW_THRESHOLD: 3,
  NO_SHOW_RATE_WINDOW_DAYS: 30,
  NO_SHOW_RATE_PERCENT: 60,
  NO_SHOW_RATE_MIN_RESERVATIONS: 4,
  BULK_ZERO_ATTENDANCE_MIN_DATES: 3,
  BULK_ZERO_ATTENDANCE_WINDOW_DAYS: 14,
};

const SUSPICIOUS_RULE_IDS = {
  CONSECUTIVE_NO_SHOWS: "consecutive_no_shows",
  NO_SHOW_RATE: "no_show_rate",
  BULK_ZERO_ATTENDANCE: "bulk_zero_attendance",
};

const SUSPICIOUS_FLAG_STATUS = {
  OPEN: "open",
  DISMISSED: "dismissed",
  DEACTIVATED: "deactivated",
};

const ATTENDED_STATUSES = [
  "checked_in",
  "with_doctor",
  "in_consultation",
  "consultation_completed",
  "completed",
];

const EXCUSED_STATUSES = ["cancelled", "cancelled_by_clinic"];

module.exports = {
  SUSPICIOUS_ACCOUNT_CONFIG,
  SUSPICIOUS_RULE_IDS,
  SUSPICIOUS_FLAG_STATUS,
  ATTENDED_STATUSES,
  EXCUSED_STATUSES,
};
