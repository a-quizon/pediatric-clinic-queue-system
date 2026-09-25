import { Capacitor } from "@capacitor/core";

/**
 * True when running inside a Capacitor native shell (installed Android APK).
 * False in ordinary browsers (desktop or mobile web).
 *
 * @param {{ isNativePlatform?: () => boolean } | null} [cap]
 *        Optional Capacitor-like object for tests; defaults to `@capacitor/core`.
 */
export function isNativeApp(cap = Capacitor) {
  try {
    return typeof cap?.isNativePlatform === "function" && cap.isNativePlatform() === true;
  } catch {
    return false;
  }
}

/** Stable Hosting path for the staged debug APK (see `npm run apk:stage`). */
export const APK_DOWNLOAD_PATH = "/downloads/pediatric-clinic.apk";

/** Static install guidance page (QR codes point here). */
export const APP_DOWNLOAD_PAGE_PATH = "/download";
