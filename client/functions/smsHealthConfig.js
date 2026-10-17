/**
 * SMS gateway health thresholds (single source for Functions / Express).
 * Mirror labels in client/src/utils/smsHealthConfig.js for the admin UI.
 */

const DEGRADED_FAILURE_RATE_1H = 0.2;
const DOWN_CONSECUTIVE_FAILURES = 5;
const DOWN_NO_SUCCESS_WHILE_ATTEMPTING_MS = 2 * 60 * 60 * 1000;
const STUCK_QUEUED_MS = 10 * 60 * 1000;
const SMS_MESSAGE_CAP = 200;
const SMS_WEBHOOK_KEY_CAP = 500;

/** Monotonic status order for TextBee delivery tracking. */
const SMS_STATUS_RANK = {
  queued: 0,
  sent: 1,
  delivered: 2,
  failed: 2,
};

const TERMINAL_SUCCESS = new Set(["sent", "delivered"]);
const TERMINAL_STATUSES = new Set(["sent", "delivered", "failed"]);

module.exports = {
  DEGRADED_FAILURE_RATE_1H,
  DOWN_CONSECUTIVE_FAILURES,
  DOWN_NO_SUCCESS_WHILE_ATTEMPTING_MS,
  STUCK_QUEUED_MS,
  SMS_MESSAGE_CAP,
  SMS_WEBHOOK_KEY_CAP,
  SMS_STATUS_RANK,
  TERMINAL_SUCCESS,
  TERMINAL_STATUSES,
};
