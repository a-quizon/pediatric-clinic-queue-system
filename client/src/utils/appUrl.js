import { isNativeApp } from "./platform.js";

/** Public web origin used when the app runs inside the Capacitor WebView. */
export const NATIVE_APP_ORIGIN = "https://plus-queue.web.app";

export const RESET_PASSWORD_PATH = "/reset-password";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1"]);

/**
 * Reduce a configured URL to a bare origin (no path, no trailing slash).
 * Returns null for empty or invalid values, and for plain http on non-local hosts.
 */
export function normalizeAppOrigin(raw) {
  const value = String(raw ?? "").trim();
  if (!value) return null;
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    return null;
  }
  if (parsed.protocol === "https:") return parsed.origin;
  if (parsed.protocol === "http:" && LOCAL_HOSTS.has(parsed.hostname)) return parsed.origin;
  return null;
}

/**
 * Origin that Firebase email links (continue URLs) should point at.
 * Must be listed under Firebase Auth > Settings > Authorized domains.
 */
export function getAppOrigin({ env = import.meta.env || {}, cap, location } = {}) {
  const configured = normalizeAppOrigin(env.VITE_APP_URL);
  if (configured) return configured;
  if (isNativeApp(cap)) return NATIVE_APP_ORIGIN;
  const loc = location ?? (typeof window !== "undefined" ? window.location : null);
  return loc?.origin || NATIVE_APP_ORIGIN;
}

export function getPasswordResetActionSettings({ handleCodeInApp = true, ...options } = {}) {
  return {
    url: `${getAppOrigin(options)}${RESET_PASSWORD_PATH}`,
    handleCodeInApp,
  };
}
