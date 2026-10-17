import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import {
  RESEND_FLOW,
  getRemainingSeconds,
  startCooldown,
  syncFromRetryAfter,
  clearCooldown,
  getCooldownExpiry,
} from "../src/utils/resendCooldown.js";
import { RESEND_COOLDOWN_SECONDS } from "../src/utils/constants.js";

const require = createRequire(import.meta.url);
const {
  claimPasswordResetSlot,
  RESEND_COOLDOWN_MS: RESET_COOLDOWN_MS,
} = require("../functions/passwordResetLimitService.js");
const {
  claimEmailVerificationSlot,
  RESEND_COOLDOWN_MS: VERIFY_COOLDOWN_MS,
} = require("../functions/emailVerificationLimitService.js");
const {
  RESEND_COOLDOWN_MS,
  evaluateResendCooldown,
} = require("../functions/resendCooldown.js");

const tick = () => new Promise((resolve) => setImmediate(resolve));

function createTreeDb(initial = {}) {
  const root = structuredClone(initial);
  const segs = (path) => String(path).split("/").filter(Boolean);
  const read = (path) => segs(path).reduce((node, key) => (node == null ? undefined : node[key]), root);
  const write = (path, value) => {
    const keys = segs(path);
    let node = root;
    for (const key of keys.slice(0, -1)) {
      if (node[key] == null || typeof node[key] !== "object") node[key] = {};
      node = node[key];
    }
    const last = keys[keys.length - 1];
    if (value === null || value === undefined) delete node[last];
    else node[last] = structuredClone(value);
  };
  const snap = (val, key) => ({
    key,
    exists: () => val !== undefined && val !== null,
    val: () => (val === undefined ? null : structuredClone(val)),
  });

  const ref = (path = "") => ({
    key: segs(path).pop(),
    async once() {
      await tick();
      return snap(read(path));
    },
    async set(value) {
      await tick();
      write(path, value);
    },
    async transaction(update) {
      await tick();
      const next = update(read(path) ?? null);
      if (next === undefined) return { committed: false, snapshot: snap(read(path)) };
      write(path, next);
      return { committed: true, snapshot: snap(read(path)) };
    },
  });

  return { root, ref };
}

describe("shared RESEND_COOLDOWN is 30 seconds", () => {
  it("exports 30s on client and server mirrors", () => {
    assert.equal(RESEND_COOLDOWN_SECONDS, 30);
    assert.equal(RESEND_COOLDOWN_MS, 30_000);
    assert.equal(RESET_COOLDOWN_MS, 30_000);
    assert.equal(VERIFY_COOLDOWN_MS, 30_000);
  });
});

describe("OTP / shared resend cooldown evaluation", () => {
  const t0 = 1_700_000_000_000;

  it("rejects a request before 30s with retryAfterSeconds", () => {
    const check = evaluateResendCooldown(t0, t0 + 10_000);
    assert.equal(check.allowed, false);
    assert.equal(check.retryAfterSeconds, 20);
  });

  it("allows a request after 30s", () => {
    const check = evaluateResendCooldown(t0, t0 + 30_000);
    assert.equal(check.allowed, true);
    assert.equal(check.retryAfterSeconds, 0);
  });
});

describe("password reset claim cooldown", () => {
  function deps(role = "parent", nowMs) {
    let clock = nowMs;
    const db = createTreeDb({
      users: { u1: { role } },
    });
    return {
      db,
      now: () => clock,
      advance(ms) {
        clock += ms;
      },
      auth: {
        async getUserByEmail(email) {
          if (email === "parent@plus.queue") return { uid: "u1" };
          const err = new Error("nf");
          err.code = "auth/user-not-found";
          throw err;
        },
      },
    };
  }

  it("rejects a second claim within 30s without consuming another daily slot", async () => {
    const d = deps("parent", 1_700_000_000_000);
    const first = await claimPasswordResetSlot("parent@plus.queue", d);
    assert.equal(first.success, true);
    assert.equal(first.remaining, 4);

    await assert.rejects(
      claimPasswordResetSlot("parent@plus.queue", d),
      (err) =>
        err.code === "rate_limited" &&
        err.limitKind === "cooldown" &&
        err.retryAfterSeconds > 0 &&
        err.retryAfterSeconds <= 30
    );

    const stored = d.db.root.passwordResetLimits["parent@plus_queue"];
    assert.equal(stored.count, 1);
  });

  it("allows a claim after 30s", async () => {
    const d = deps("parent", 1_700_000_000_000);
    await claimPasswordResetSlot("parent@plus.queue", d);
    d.advance(30_000);
    const second = await claimPasswordResetSlot("parent@plus.queue", d);
    assert.equal(second.success, true);
    assert.equal(second.remaining, 3);
  });

  it("still allows unknown emails (no enumeration) and applies cooldown by email key", async () => {
    const d = deps("parent", 1_700_000_000_000);
    const unknown = await claimPasswordResetSlot("nobody@plus.queue", d);
    assert.equal(unknown.success, true);
    await assert.rejects(
      claimPasswordResetSlot("nobody@plus.queue", d),
      (err) => err.code === "rate_limited" && err.retryAfterSeconds > 0
    );
  });

  it("keeps OTP / reset / verification cooldowns independent (different stores)", async () => {
    const d = deps("parent", 1_700_000_000_000);
    await claimPasswordResetSlot("parent@plus.queue", d);
    const verifyDb = createTreeDb({});
    const verifyOk = await claimEmailVerificationSlot("u1", {
      db: verifyDb,
      now: () => 1_700_000_000_000,
    });
    assert.equal(verifyOk.success, true);
  });
});

describe("email verification claim cooldown", () => {
  it("rejects before 30s and succeeds after", async () => {
    const db = createTreeDb({});
    let now = 1_700_000_000_000;
    const deps = { db, now: () => now };

    const first = await claimEmailVerificationSlot("uid-abc", deps);
    assert.equal(first.success, true);

    await assert.rejects(
      claimEmailVerificationSlot("uid-abc", deps),
      (err) => err.code === "rate_limited" && err.retryAfterSeconds > 0
    );

    now += 30_000;
    const second = await claimEmailVerificationSlot("uid-abc", deps);
    assert.equal(second.success, true);
  });
});

describe("frontend resendCooldown persistence", () => {
  const memory = new Map();

  beforeEach(() => {
    memory.clear();
    globalThis.localStorage = {
      getItem: (k) => (memory.has(k) ? memory.get(k) : null),
      setItem: (k, v) => memory.set(k, String(v)),
      removeItem: (k) => memory.delete(k),
    };
  });

  afterEach(() => {
    delete globalThis.localStorage;
  });

  it("persists expiry so remaining time survives a reload", () => {
    const now = 1_700_000_000_000;
    startCooldown(RESEND_FLOW.OTP, "+639171234567", 30, now);
    const left = getRemainingSeconds(RESEND_FLOW.OTP, "+639171234567", now + 6_000);
    assert.equal(left, 24);
    assert.ok(getCooldownExpiry(RESEND_FLOW.OTP, "+639171234567") > now);
  });

  it("reaches 0 after expiry", () => {
    const now = 1_700_000_000_000;
    startCooldown(RESEND_FLOW.PASSWORD_RESET, "a@b.com", 30, now);
    assert.equal(getRemainingSeconds(RESEND_FLOW.PASSWORD_RESET, "a@b.com", now + 30_000), 0);
  });

  it("syncFromRetryAfter updates stored expiry from server remaining time", () => {
    const now = 1_700_000_000_000;
    syncFromRetryAfter(RESEND_FLOW.EMAIL_VERIFICATION, "uid1", 18, now);
    assert.equal(getRemainingSeconds(RESEND_FLOW.EMAIL_VERIFICATION, "uid1", now), 18);
    assert.equal(getRemainingSeconds(RESEND_FLOW.EMAIL_VERIFICATION, "uid1", now + 5_000), 13);
  });

  it("keeps flow keys independent", () => {
    const now = 1_700_000_000_000;
    startCooldown(RESEND_FLOW.OTP, "same-id", 30, now);
    assert.equal(getRemainingSeconds(RESEND_FLOW.PASSWORD_RESET, "same-id", now), 0);
    clearCooldown(RESEND_FLOW.OTP, "same-id");
    assert.equal(getRemainingSeconds(RESEND_FLOW.OTP, "same-id", now), 0);
  });
});
