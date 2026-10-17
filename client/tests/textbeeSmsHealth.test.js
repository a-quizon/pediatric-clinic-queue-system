import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import crypto from "node:crypto";
import {
  computeSmsServiceStatus,
  explainSmsManagerResultCode,
} from "../src/utils/systemHealth.js";

const require = createRequire(import.meta.url);
const {
  computeSmsServiceStatus: computeServer,
  canTransitionSmsStatus,
  mapTextBeeStatusToOurs,
  applySmsDeliveryUpdate,
  maskPhoneE164,
} = require("../functions/systemHealthRuntime.js");
const {
  verifyWebhookSignature,
  statusFromWebhookEvent,
  handleTextBeeWebhookPayload,
} = require("../functions/textbeeWebhookRuntime.js");
const { explainSmsManagerResultCode: explainServer } = require("../functions/smsManagerResultCodes.js");
const {
  DEGRADED_FAILURE_RATE_1H,
  DOWN_CONSECUTIVE_FAILURES,
  STUCK_QUEUED_MS,
} = require("../functions/smsHealthConfig.js");

function memoryDb(seed = {}) {
  const store = structuredClone(seed);
  function ref(path) {
    const parts = String(path).split("/").filter(Boolean);
    return {
      push() {
        const key = `push_${Math.random().toString(36).slice(2, 10)}`;
        return {
          key,
          async set(val) {
            let cur = store;
            for (let i = 0; i < parts.length; i++) {
              cur[parts[i]] = cur[parts[i]] || {};
              cur = cur[parts[i]];
            }
            cur[key] = val;
          },
        };
      },
      async once() {
        let cur = store;
        for (const p of parts) {
          if (cur == null) break;
          cur = cur[p];
        }
        const value = cur == null ? null : structuredClone(cur);
        return {
          exists: () => value != null && value !== undefined,
          val: () => value,
          forEach(cb) {
            if (!value || typeof value !== "object") return;
            Object.entries(value).forEach(([key, childVal]) => {
              cb({ key, val: () => childVal });
            });
          },
        };
      },
      async set(val) {
        let cur = store;
        for (let i = 0; i < parts.length - 1; i++) {
          cur[parts[i]] = cur[parts[i]] || {};
          cur = cur[parts[i]];
        }
        cur[parts[parts.length - 1]] = val;
      },
      async update(patch) {
        let cur = store;
        for (const p of parts) {
          cur[p] = cur[p] || {};
          cur = cur[p];
        }
        Object.assign(cur, patch);
      },
      async remove() {
        let cur = store;
        for (let i = 0; i < parts.length - 1; i++) {
          if (!cur[parts[i]]) return;
          cur = cur[parts[i]];
        }
        delete cur[parts[parts.length - 1]];
      },
      limitToLast() {
        return {
          async once() {
            let cur = store;
            for (const p of parts) {
              if (cur == null) break;
              cur = cur[p];
            }
            return {
              exists: () => cur != null,
              val: () => (cur == null ? null : structuredClone(cur)),
            };
          },
        };
      },
      transaction: async () => ({ committed: true, snapshot: { val: () => null } }),
    };
  }
  return {
    ref(path) {
      if (!path || path === "/") {
        return {
          async update(multi) {
            for (const [fullPath, value] of Object.entries(multi)) {
              const parts = fullPath.split("/").filter(Boolean);
              let cur = store;
              for (let i = 0; i < parts.length - 1; i++) {
                cur[parts[i]] = cur[parts[i]] || {};
                cur = cur[parts[i]];
              }
              cur[parts[parts.length - 1]] = value;
            }
          },
        };
      }
      return ref(path);
    },
    _store: store,
  };
}

describe("explainSmsManagerResultCode", () => {
  it("maps code 32 RESULT_NO_DEFAULT_SMS_APP as gateway config", () => {
    const explained = explainSmsManagerResultCode(32);
    assert.equal(explained.code, "32");
    assert.equal(explained.name, "RESULT_NO_DEFAULT_SMS_APP");
    assert.equal(explained.known, true);
    assert.equal(explained.isGatewayConfig, true);
    assert.match(explained.explanation, /default SMS app/i);
    assert.deepEqual(explainServer("32").name, explained.name);
  });

  it("maps common Android codes", () => {
    assert.equal(explainSmsManagerResultCode(1).name, "RESULT_ERROR_GENERIC_FAILURE");
    assert.equal(explainSmsManagerResultCode(2).name, "RESULT_ERROR_RADIO_OFF");
    assert.equal(explainSmsManagerResultCode(3).name, "RESULT_ERROR_NULL_PDU");
    assert.equal(explainSmsManagerResultCode(4).name, "RESULT_ERROR_NO_SERVICE");
    assert.equal(explainSmsManagerResultCode(5).name, "RESULT_ERROR_LIMIT_EXCEEDED");
  });

  it("handles unknown codes without throwing", () => {
    const explained = explainSmsManagerResultCode(9999);
    assert.equal(explained.known, false);
    assert.equal(explained.code, "9999");
    assert.match(explained.explanation, /Unrecognized/);
  });
});

describe("computeSmsServiceStatus thresholds", () => {
  const now = Date.UTC(2026, 9, 17, 12);

  it("stays healthy with a single failure (not Down)", () => {
    const messages = [
      { id: "a", status: "failed", createdAt: now - 1000, updatedAt: now - 1000 },
      { id: "b", status: "sent", createdAt: now - 2000, updatedAt: now - 2000 },
      { id: "c", status: "sent", createdAt: now - 3000, updatedAt: now - 3000 },
      { id: "d", status: "sent", createdAt: now - 4000, updatedAt: now - 4000 },
      { id: "e", status: "sent", createdAt: now - 5000, updatedAt: now - 5000 },
    ];
    // 1 fail / 5 terminal in 1h = 20% — not greater than 20%
    const summary = computeSmsServiceStatus(messages, now);
    assert.equal(summary.serviceStatus, "healthy");
    assert.equal(computeServer(messages, now).serviceStatus, "healthy");
  });

  it("marks Degraded when 1h failure rate exceeds 20%", () => {
    const messages = [
      { id: "a", status: "failed", createdAt: now - 1000, updatedAt: now - 1000 },
      { id: "b", status: "sent", createdAt: now - 2000, updatedAt: now - 2000 },
      { id: "c", status: "sent", createdAt: now - 3000, updatedAt: now - 3000 },
    ];
    // 1/3 ≈ 33% > 20%
    const summary = computeSmsServiceStatus(messages, now);
    assert.ok(summary.failureRate1h > DEGRADED_FAILURE_RATE_1H);
    assert.equal(summary.serviceStatus, "degraded");
  });

  it("marks Down when last N terminal attempts all failed", () => {
    const messages = Array.from({ length: DOWN_CONSECUTIVE_FAILURES }, (_, i) => ({
      id: `f${i}`,
      status: "failed",
      createdAt: now - i * 1000,
      updatedAt: now - i * 1000,
    }));
    assert.equal(computeSmsServiceStatus(messages, now).serviceStatus, "down");
  });

  it("marks Degraded when queued messages are stuck", () => {
    const messages = [
      {
        id: "q1",
        status: "queued",
        createdAt: now - STUCK_QUEUED_MS - 1000,
        updatedAt: now - STUCK_QUEUED_MS - 1000,
      },
    ];
    assert.equal(computeSmsServiceStatus(messages, now).serviceStatus, "degraded");
    assert.equal(computeSmsServiceStatus(messages, now).stuckCount, 1);
  });
});

describe("webhook signature and failed event", () => {
  const secret = "a-long-random-secret-of-20-chars-or-more";

  it("verifies HMAC-SHA256 hex signature over raw body", () => {
    const body = '{"smsId":"x","webhookEvent":"MESSAGE_FAILED"}';
    const signature = crypto.createHmac("sha256", secret).update(body).digest("hex");
    assert.equal(verifyWebhookSignature(body, signature, secret), true);
    assert.equal(verifyWebhookSignature(body, "deadbeef", secret), false);
  });

  it("maps MESSAGE_FAILED to failed status", () => {
    assert.equal(statusFromWebhookEvent("MESSAGE_FAILED", "failed"), "failed");
    assert.equal(statusFromWebhookEvent("MESSAGE_SENT", "sent"), "sent");
    assert.equal(mapTextBeeStatusToOurs("pending"), "queued");
  });

  it("applies a failed webhook event and ignores duplicates", async () => {
    const db = memoryDb({
      systemHealth: {
        smsMessages: {
          rec1: {
            id: "rec1",
            status: "queued",
            textbeeBatchId: "batch1",
            messageType: "SLOT_RESERVED",
            maskedRecipient: "+639***4567",
            createdAt: Date.now() - 1000,
            updatedAt: Date.now() - 1000,
          },
        },
        smsByBatchId: { batch1: "rec1" },
        smsGateway: {},
      },
      users: {
        admin1: { role: "admin", status: "active" },
      },
    });

    const payload = {
      smsId: "sms1",
      smsBatchId: "batch1",
      webhookEvent: "MESSAGE_FAILED",
      status: "failed",
      recipient: "+639171234567",
      errorCode: "32",
      errorMessage: "No default SMS app",
      idempotencyKey: "idem-1",
      failedAt: new Date().toISOString(),
    };

    const first = await handleTextBeeWebhookPayload(payload, { db });
    assert.equal(first.applied, true);
    assert.equal(first.deliveryStatus, "failed");
    assert.equal(db._store.systemHealth.smsMessages.rec1.status, "failed");
    assert.equal(db._store.systemHealth.smsMessages.rec1.errorCode, "32");

    const second = await handleTextBeeWebhookPayload(payload, { db });
    assert.equal(second.applied, false);
    assert.equal(second.reason, "duplicate");
  });
});

describe("status transitions and masking", () => {
  it("does not move from failed back to sent", () => {
    assert.equal(canTransitionSmsStatus("failed", "sent"), false);
    assert.equal(canTransitionSmsStatus("queued", "failed"), true);
    assert.equal(canTransitionSmsStatus("sent", "delivered"), true);
  });

  it("masks phone numbers", () => {
    assert.equal(maskPhoneE164("+639171234567"), "+639***4567");
  });

  it("applySmsDeliveryUpdate is idempotent by key", async () => {
    const db = memoryDb({
      systemHealth: {
        smsMessages: {
          rec1: {
            id: "rec1",
            status: "queued",
            textbeeBatchId: "b1",
            createdAt: 1,
            updatedAt: 1,
          },
        },
        smsByBatchId: { b1: "rec1" },
        smsGateway: {},
      },
      users: {},
    });
    const first = await applySmsDeliveryUpdate(
      {
        status: "sent",
        smsBatchId: "b1",
        smsId: "s1",
        idempotencyKey: "k1",
      },
      { db }
    );
    assert.equal(first.applied, true);
    const dup = await applySmsDeliveryUpdate(
      {
        status: "sent",
        smsBatchId: "b1",
        smsId: "s1",
        idempotencyKey: "k1",
      },
      { db }
    );
    assert.equal(dup.applied, false);
    assert.equal(dup.reason, "duplicate");
  });
});
