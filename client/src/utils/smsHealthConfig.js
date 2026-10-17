/**
 * SMS gateway health thresholds (UI mirror of client/functions/smsHealthConfig.js).
 */

export const DEGRADED_FAILURE_RATE_1H = 0.2;
export const DOWN_CONSECUTIVE_FAILURES = 5;
export const DOWN_NO_SUCCESS_WHILE_ATTEMPTING_MS = 2 * 60 * 60 * 1000;
export const STUCK_QUEUED_MS = 10 * 60 * 1000;

export const TERMINAL_SUCCESS = new Set(["sent", "delivered"]);
export const TERMINAL_STATUSES = new Set(["sent", "delivered", "failed"]);
