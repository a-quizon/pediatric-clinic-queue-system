import { describe, it } from "node:test";
import assert from "node:assert/strict";

const {
  normalizeAppOrigin,
  getAppOrigin,
  getPasswordResetActionSettings,
  NATIVE_APP_ORIGIN,
} = await import("../src/utils/appUrl.js");

const web = { isNativePlatform: () => false };
const native = { isNativePlatform: () => true };

describe("normalizeAppOrigin()", () => {
  it("strips trailing slashes and paths", () => {
    assert.equal(normalizeAppOrigin("https://plus-queue.web.app/"), "https://plus-queue.web.app");
    assert.equal(
      normalizeAppOrigin("  https://plus-queue.web.app/reset-password?x=1 "),
      "https://plus-queue.web.app"
    );
  });

  it("rejects plain http on non-local hosts", () => {
    assert.equal(normalizeAppOrigin("http://plus-queue.web.app"), null);
  });

  it("allows http for localhost", () => {
    assert.equal(normalizeAppOrigin("http://localhost:5173/"), "http://localhost:5173");
  });

  it("returns null for empty or invalid values", () => {
    assert.equal(normalizeAppOrigin(""), null);
    assert.equal(normalizeAppOrigin(undefined), null);
    assert.equal(normalizeAppOrigin("plus-queue.web.app"), null);
  });
});

describe("getAppOrigin()", () => {
  it("prefers VITE_APP_URL when valid", () => {
    assert.equal(
      getAppOrigin({
        env: { VITE_APP_URL: "https://plus-queue.web.app/" },
        cap: native,
        location: { origin: "http://localhost:5173" },
      }),
      "https://plus-queue.web.app"
    );
  });

  it("uses the hosted origin inside the native app", () => {
    assert.equal(
      getAppOrigin({ env: {}, cap: native, location: { origin: "https://localhost" } }),
      NATIVE_APP_ORIGIN
    );
  });

  it("falls back to the current page origin on web", () => {
    assert.equal(
      getAppOrigin({ env: { VITE_APP_URL: "" }, cap: web, location: { origin: "http://localhost:5173" } }),
      "http://localhost:5173"
    );
  });
});

describe("getPasswordResetActionSettings()", () => {
  it("builds the /reset-password continue URL", () => {
    assert.deepEqual(
      getPasswordResetActionSettings({
        handleCodeInApp: false,
        env: {},
        cap: web,
        location: { origin: "https://plus-queue.web.app" },
      }),
      { url: "https://plus-queue.web.app/reset-password", handleCodeInApp: false }
    );
  });
});
