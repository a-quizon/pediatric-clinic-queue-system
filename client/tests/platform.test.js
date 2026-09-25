import { describe, it } from "node:test";
import assert from "node:assert/strict";

const { isNativeApp, APK_DOWNLOAD_PATH, APP_DOWNLOAD_PAGE_PATH } = await import(
  "../src/utils/platform.js"
);

describe("isNativeApp()", () => {
  it("returns false in a plain browser / web Capacitor stub", () => {
    assert.equal(isNativeApp({ isNativePlatform: () => false }), false);
  });

  it("returns true in a simulated native Capacitor stub", () => {
    assert.equal(isNativeApp({ isNativePlatform: () => true }), true);
  });

  it("returns false when Capacitor is missing or throws", () => {
    assert.equal(isNativeApp(null), false);
    assert.equal(
      isNativeApp({
        isNativePlatform() {
          throw new Error("bridge unavailable");
        },
      }),
      false
    );
  });

  it("uses real @capacitor/core (web) when called with no stub", () => {
    assert.equal(isNativeApp(), false);
  });
});

describe("login download link targets", () => {
  it("points at the existing download page and staged APK path", () => {
    assert.equal(APP_DOWNLOAD_PAGE_PATH, "/download");
    assert.equal(APK_DOWNLOAD_PATH, "/downloads/pediatric-clinic.apk");
  });

  it("shows the download link only on web (not native)", () => {
    const shouldShowDownloadLink = (cap) => !isNativeApp(cap);
    assert.equal(shouldShowDownloadLink({ isNativePlatform: () => false }), true);
    assert.equal(shouldShowDownloadLink({ isNativePlatform: () => true }), false);
  });
});

describe("modal removal", () => {
  it("no longer ships install-prompt modal or persistence modules", async () => {
    await assert.rejects(
      () => import("../src/components/onboarding/InstallAppPrompt.jsx"),
      /Cannot find module|ERR_MODULE_NOT_FOUND/
    );
    await assert.rejects(
      () => import("../src/services/installPromptService.js"),
      /Cannot find module|ERR_MODULE_NOT_FOUND/
    );
  });
});
