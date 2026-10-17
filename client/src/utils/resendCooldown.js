import { RESEND_COOLDOWN_SECONDS } from "./constants.js";

export const RESEND_FLOW = {
  OTP: "otp",
  EMAIL_VERIFICATION: "email_verification",
  PASSWORD_RESET: "password_reset",
};

const STORAGE_PREFIX = "resendCooldown";

function getStorage() {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}

function storageKey(flow, identity) {
  const id = String(identity || "")
    .trim()
    .toLowerCase()
    .replace(/[.#$\[\]]/g, "_");
  return `${STORAGE_PREFIX}:${flow}:${id}`;
}

function readExpiry(flow, identity) {
  const storage = getStorage();
  if (!identity || !storage) return 0;
  try {
    const raw = storage.getItem(storageKey(flow, identity));
    const expiry = Number(raw) || 0;
    return expiry > 0 ? expiry : 0;
  } catch {
    return 0;
  }
}

function writeExpiry(flow, identity, expiryMs) {
  const storage = getStorage();
  if (!identity || !storage) return;
  try {
    if (!expiryMs || expiryMs <= 0) {
      storage.removeItem(storageKey(flow, identity));
      return;
    }
    storage.setItem(storageKey(flow, identity), String(expiryMs));
  } catch {
    // ignore quota / private mode
  }
}

/** Remaining cooldown seconds for a flow+identity (0 if none / expired). */
export function getRemainingSeconds(flow, identity, nowMs = Date.now()) {
  const expiry = readExpiry(flow, identity);
  if (!expiry) return 0;
  const left = Math.ceil((expiry - nowMs) / 1000);
  if (left <= 0) {
    writeExpiry(flow, identity, 0);
    return 0;
  }
  return left;
}

/** Start a full cooldown window (default RESEND_COOLDOWN_SECONDS). */
export function startCooldown(flow, identity, seconds = RESEND_COOLDOWN_SECONDS, nowMs = Date.now()) {
  const sec = Math.max(0, Number(seconds) || 0);
  if (!identity || sec <= 0) {
    clearCooldown(flow, identity);
    return 0;
  }
  writeExpiry(flow, identity, nowMs + sec * 1000);
  return sec;
}

/** Sync local countdown from a server 429 retryAfterSeconds value. */
export function syncFromRetryAfter(flow, identity, retryAfterSeconds, nowMs = Date.now()) {
  const sec = Math.max(0, Math.ceil(Number(retryAfterSeconds) || 0));
  if (!identity || sec <= 0) {
    clearCooldown(flow, identity);
    return 0;
  }
  writeExpiry(flow, identity, nowMs + sec * 1000);
  return sec;
}

export function clearCooldown(flow, identity) {
  writeExpiry(flow, identity, 0);
}

export function getCooldownExpiry(flow, identity) {
  return readExpiry(flow, identity);
}
