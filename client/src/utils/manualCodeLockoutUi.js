/**
 * Client helpers for secretary manual reservation-code lockout UI.
 * Server remains the source of truth; sessionStorage only survives a page refresh
 * until the next validate-code call re-syncs from the API.
 */

export const MANUAL_CODE_LOCKOUT_TOAST_ID = "manual-code-lockout";
export const MANUAL_CODE_LOCKOUT_TOAST_MS = 6000;

function storageKey(uid) {
  return `manualCodeLockout:${uid || "anon"}`;
}

/**
 * @param {string} uid
 * @param {{ lockedUntil: number, message?: string }} payload
 */
export function saveManualCodeLockout(uid, payload) {
  if (typeof sessionStorage === "undefined") return;
  const lockedUntil = Number(payload?.lockedUntil) || 0;
  if (!lockedUntil) return;
  try {
    sessionStorage.setItem(
      storageKey(uid),
      JSON.stringify({
        lockedUntil,
        message: payload.message || null,
      })
    );
  } catch {
    /* ignore quota / private mode */
  }
}

/**
 * @param {string} uid
 * @param {number} [nowMs]
 * @returns {{ lockedUntil: number, message: string|null }|null}
 */
export function loadManualCodeLockout(uid, nowMs = Date.now()) {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(storageKey(uid));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const lockedUntil = Number(parsed?.lockedUntil) || 0;
    if (lockedUntil <= nowMs) {
      sessionStorage.removeItem(storageKey(uid));
      return null;
    }
    return {
      lockedUntil,
      message: parsed?.message || null,
    };
  } catch {
    return null;
  }
}

/**
 * @param {string} uid
 */
export function clearManualCodeLockout(uid) {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.removeItem(storageKey(uid));
  } catch {
    /* ignore */
  }
}

/**
 * @param {number} lockedUntil
 * @param {number} [nowMs]
 * @returns {string} e.g. "4:32"
 */
export function formatLockCountdown(lockedUntil, nowMs = Date.now()) {
  const remainingMs = Math.max(0, Number(lockedUntil) - nowMs);
  const totalSec = Math.ceil(remainingMs / 1000);
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
