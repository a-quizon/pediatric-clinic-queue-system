import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  formatLastUpdatedManila,
  settleWithMinDuration,
} from "../src/utils/systemHealth.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const systemHealthPage = fs.readFileSync(
  path.join(__dirname, "../src/pages/admin/SystemHealth.jsx"),
  "utf8"
);

describe("SystemHealth refresh UX wiring", () => {
  it("shows loading label, aria-busy, toast, and last-updated Manila formatting", () => {
    assert.match(systemHealthPage, /aria-busy=\{refreshing\}/);
    assert.match(systemHealthPage, /Refreshing…/);
    assert.match(systemHealthPage, /disabled=\{refreshing\}/);
    assert.match(systemHealthPage, /toast\.success\("System Health updated"\)/);
    assert.match(systemHealthPage, /toast\.error/);
    assert.match(systemHealthPage, /formatLastUpdatedManila/);
    assert.match(systemHealthPage, /Last updated:/);
    assert.match(systemHealthPage, /settleWithMinDuration/);
    assert.match(systemHealthPage, /refreshingRef\.current/);
    assert.match(systemHealthPage, /opacity-60/);
    assert.match(systemHealthPage, /setRefreshError/);
    assert.match(systemHealthPage, /resetSmsPage/);
    assert.match(systemHealthPage, /resetNotifPage/);
  });

  it("keeps prior data visible on refresh failure (loadError only when no health)", () => {
    assert.match(systemHealthPage, /if \(loadError && !health\)/);
    assert.match(systemHealthPage, /Previous data is still shown/);
  });
});

describe("formatLastUpdatedManila", () => {
  it("returns null when timestamp is missing", () => {
    assert.equal(formatLastUpdatedManila(null), null);
    assert.equal(formatLastUpdatedManila(undefined), null);
    assert.equal(formatLastUpdatedManila(0), null);
  });

  it("formats a timestamp in Asia/Manila and changes when the instant changes", () => {
    const a = Date.UTC(2026, 5, 15, 4, 30, 0); // 12:30 PM Manila (UTC+8)
    const b = Date.UTC(2026, 5, 15, 4, 31, 5);
    const labelA = formatLastUpdatedManila(a);
    const labelB = formatLastUpdatedManila(b);
    assert.ok(typeof labelA === "string" && labelA.length > 0);
    assert.ok(typeof labelB === "string" && labelB.length > 0);
    assert.notEqual(labelA, labelB);
    // Manila afternoon on that date
    assert.match(labelA, /Jun/);
    assert.match(labelA, /15/);
    assert.match(labelA, /2026/);
  });
});

describe("settleWithMinDuration", () => {
  it("waits at least minMs for a fast success without delaying the work start", async () => {
    let startedAt = 0;
    const work = (async () => {
      startedAt = Date.now();
      return "ok";
    })();
    const before = Date.now();
    const result = await settleWithMinDuration(work, 80);
    const elapsed = Date.now() - before;
    assert.equal(result, "ok");
    assert.ok(startedAt - before < 40, "work should start immediately");
    assert.ok(elapsed >= 75, `expected ~80ms UI wait, got ${elapsed}ms`);
  });

  it("does not add extra wait when work already exceeds minMs", async () => {
    const work = new Promise((resolve) => setTimeout(() => resolve("slow"), 90));
    const before = Date.now();
    const result = await settleWithMinDuration(work, 40);
    const elapsed = Date.now() - before;
    assert.equal(result, "slow");
    assert.ok(elapsed >= 85);
    assert.ok(elapsed < 200, `should not pad much beyond work duration, got ${elapsed}ms`);
  });

  it("preserves rejection after the minimum UI duration", async () => {
    const work = Promise.reject(new Error("refresh failed"));
    // Prevent unhandled rejection if settle delays after catch path
    work.catch(() => {});
    const before = Date.now();
    await assert.rejects(
      () => settleWithMinDuration(work, 60),
      /refresh failed/
    );
    const elapsed = Date.now() - before;
    assert.ok(elapsed >= 55, `expected min duration on error, got ${elapsed}ms`);
  });
});
