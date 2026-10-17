import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import {
  connectionLabelFromInfoConnected,
  smsStatusLabel,
  summarizeNotificationFailures,
} from "../src/utils/systemHealth.js";

const require = createRequire(import.meta.url);
const {
  inferSmsGatewayStatus,
  summarizeNotificationFailures: summarizeServer,
  connectionLabelFromInfoConnected: connectionServer,
} = require("../functions/systemHealthRuntime.js");

describe("inferSmsGatewayStatus", () => {
  it("maps success and failures", () => {
    assert.equal(inferSmsGatewayStatus({ success: true }), "ok");
    assert.equal(inferSmsGatewayStatus({ success: false, skipped: true, reason: "not_configured" }), "not_configured");
    assert.equal(inferSmsGatewayStatus({ success: false, reason: "network_error" }), "failing");
    assert.equal(inferSmsGatewayStatus({ success: false, error: "device offline" }), "failing");
    assert.equal(inferSmsGatewayStatus({ success: false, reason: "empty_message" }), "unknown");
  });
});

describe("summarizeNotificationFailures", () => {
  it("counts 24h and 7d windows", () => {
    const now = Date.UTC(2026, 0, 10, 12);
    const day = 24 * 60 * 60 * 1000;
    const map = {
      a: { at: now - 1000, error: "x" },
      b: { at: now - 2 * day, error: "y" },
      c: { at: now - 10 * day, error: "z" },
    };
    const summary = summarizeNotificationFailures(map, now);
    assert.equal(summary.count24h, 1);
    assert.equal(summary.count7d, 2);
    assert.equal(summary.recent[0].id, "a");
    assert.deepEqual(summarizeServer(map, now).count7d, 2);
  });
});

describe("connectionLabelFromInfoConnected", () => {
  it("covers online reconnecting offline", () => {
    assert.equal(connectionLabelFromInfoConnected(true), "Online");
    assert.equal(connectionLabelFromInfoConnected(false, { everConnected: true }), "Reconnecting");
    assert.equal(connectionLabelFromInfoConnected(false, { everConnected: false }), "Offline");
    assert.equal(connectionServer(null), "Unknown");
  });
});

describe("smsStatusLabel", () => {
  it("labels gateway snapshot", () => {
    assert.equal(smsStatusLabel(null), "Unknown");
    assert.equal(smsStatusLabel({ inferredStatus: "ok" }), "OK");
    assert.equal(smsStatusLabel({ inferredStatus: "failing" }), "Failing");
  });
});
