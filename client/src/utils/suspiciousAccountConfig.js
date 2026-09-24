/**
 * Tunable thresholds for parent suspicious-account detection.
 * Adjust here (and mirror in client/functions/suspiciousAccountConfig.js) without touching rule logic.
 */
export const SUSPICIOUS_ACCOUNT_CONFIG = {
  /** Rule A: last N past reservations were all no-shows. */
  CONSECUTIVE_NO_SHOW_THRESHOLD: 3,
  /** Rule B: rolling window length in Manila calendar days. */
  NO_SHOW_RATE_WINDOW_DAYS: 30,
  /** Rule B: no-show rate percent threshold (exclusive lower bound via >=). */
  NO_SHOW_RATE_PERCENT: 60,
  /** Rule B: minimum past reservations in the window before rate applies. */
  NO_SHOW_RATE_MIN_RESERVATIONS: 4,
  /** Rule C: minimum distinct past clinic dates with zero attendance. */
  BULK_ZERO_ATTENDANCE_MIN_DATES: 3,
  /** Rule C: look-back window in Manila calendar days. */
  BULK_ZERO_ATTENDANCE_WINDOW_DAYS: 14,
};

export const SUSPICIOUS_RULE_IDS = {
  CONSECUTIVE_NO_SHOWS: "consecutive_no_shows",
  NO_SHOW_RATE: "no_show_rate",
  BULK_ZERO_ATTENDANCE: "bulk_zero_attendance",
};

export const SUSPICIOUS_FLAG_STATUS = {
  OPEN: "open",
  DISMISSED: "dismissed",
  DEACTIVATED: "deactivated",
};

export const ATTENDED_STATUSES = [
  "checked_in",
  "with_doctor",
  "in_consultation",
  "consultation_completed",
  "completed",
];

export const EXCUSED_STATUSES = ["cancelled", "cancelled_by_clinic"];
