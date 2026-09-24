import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildSuspiciousDoctorPushPayload,
  resolveNotificationClickUrl,
  parseHighlightParam,
  TEST_IDS,
} from "./helpers/suspiciousFixtures.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe("Suspicious account notification — push payload contract", () => {
  it("builds exactly one doctor push payload with title, body, and highlight deep link", () => {
    const auditLogId = "audit_log_abc123";
    const payload = buildSuspiciousDoctorPushPayload({
      parentName: "Parent A NoShow",
      parentId: TEST_IDS.parentA,
      auditLogId,
    });

    assert.equal(payload.title, "Suspicious account detected");
    assert.equal(payload.body, "Suspicious account detected: Parent A NoShow");
    assert.equal(payload.type, "SUSPICIOUS_ACCOUNT");
    assert.equal(
      payload.url,
      `/doctor/audit-logs?highlight=${encodeURIComponent(auditLogId)}`
    );
    assert.match(payload.dedupeKey, new RegExp(`suspicious_${TEST_IDS.parentA}_${auditLogId}`));
  });

  it("falls back to Audit Logs root URL when audit log id is missing", () => {
    const payload = buildSuspiciousDoctorPushPayload({
      parentName: "Parent A NoShow",
      parentId: TEST_IDS.parentA,
      auditLogId: null,
    });
    assert.equal(payload.url, "/doctor/audit-logs");
  });

  it("Cloud Function notifyDoctors uses the same title/body/url contract", () => {
    const runtimePath = path.join(
      __dirname,
      "../functions/suspiciousAccountRuntime.js"
    );
    const source = fs.readFileSync(runtimePath, "utf8");
    assert.match(source, /title = "Suspicious account detected"/);
    assert.match(source, /Suspicious account detected: \$\{parentName\}/);
    assert.match(source, /\/doctor\/audit-logs\?highlight=/);
    assert.match(source, /type: "SUSPICIOUS_ACCOUNT"/);
    assert.match(source, /doctorAlerts\/\$\{doctorId\}/);
  });

  it("sendPushToDoctor rejects non-doctor roles (parent/secretary never receive)", () => {
    const pushPath = path.join(__dirname, "../functions/pushRuntime.js");
    const source = fs.readFileSync(pushPath, "utf8");
    assert.match(source, /async function sendPushToDoctor/);
    assert.match(source, /user\.role !== "doctor" && user\.role !== "admin"/);
    assert.match(source, /reason: "not_doctor"/);
  });

  it("evaluateAndFlagParent still writes audit before notify, and catches notify failures", () => {
    const runtimePath = path.join(
      __dirname,
      "../functions/suspiciousAccountRuntime.js"
    );
    const source = fs.readFileSync(runtimePath, "utf8");
    const auditIdx = source.indexOf("writeSystemAuditLog");
    const notifyIdx = source.indexOf("notifyDoctors");
    assert.ok(auditIdx > 0 && notifyIdx > auditIdx, "audit must be written before notify");
    assert.match(source, /catch \(err\) \{\s*console\.error\("evaluateAndFlagParent: notifyDoctors failed"/);
  });

  it("sendPushToDoctor prunes 404/410 subscriptions without throwing", () => {
    const pushPath = path.join(__dirname, "../functions/pushRuntime.js");
    const source = fs.readFileSync(pushPath, "utf8");
    // Within sendPushToDoctor region after the function declaration
    const start = source.indexOf("async function sendPushToDoctor");
    const region = source.slice(start, start + 2500);
    assert.match(region, /statusCode === 404 \|\| err\.statusCode === 410/);
    assert.match(region, /gone\[key\] = null/);
  });
});

describe("Suspicious account notification — click-through / highlight", () => {
  it("notificationclick resolves relative deep link against origin", () => {
    const href = resolveNotificationClickUrl(
      "/doctor/audit-logs?highlight=audit_log_abc123",
      "https://clinic.example.test"
    );
    assert.equal(
      href,
      "https://clinic.example.test/doctor/audit-logs?highlight=audit_log_abc123"
    );
  });

  it("Audit Logs page reads highlight query param without throwing on missing id", () => {
    assert.equal(parseHighlightParam("?highlight=audit_log_abc123"), "audit_log_abc123");
    assert.equal(parseHighlightParam("?tab=reports"), null);
    assert.equal(parseHighlightParam(""), null);

    const auditPage = fs.readFileSync(
      path.join(__dirname, "../src/pages/admin/AuditLogs.jsx"),
      "utf8"
    );
    assert.match(auditPage, /searchParams\.get\("highlight"\)/);
    assert.match(auditPage, /scrollIntoView/);
    // Missing highlight id: page still renders filtered logs; no throw path required
    assert.match(auditPage, /if \(!highlightId \|\| !logs\.length\) return/);
  });

  it("service worker notificationclick uses data.url (deep link)", () => {
    const sw = fs.readFileSync(path.join(__dirname, "../public/sw.js"), "utf8");
    assert.match(sw, /notificationclick/);
    assert.match(sw, /event\.notification\?\.data\?\.url/);
    assert.match(sw, /openOrFocusWindow/);
  });
});

describe("Suspicious account actions — safety contracts in source", () => {
  it("Audit Logs requires confirmation before deactivate and does not auto-deactivate on flag", () => {
    const auditPage = fs.readFileSync(
      path.join(__dirname, "../src/pages/admin/AuditLogs.jsx"),
      "utf8"
    );
    assert.match(auditPage, /ConfirmationModal/);
    assert.match(auditPage, /Deactivate Account/);
    assert.match(auditPage, /Dismiss \/ Mark as Reviewed/);
    assert.match(auditPage, /deactivateSuspiciousAccount/);
    assert.match(auditPage, /dismissSuspiciousAccount/);

    const runtime = fs.readFileSync(
      path.join(__dirname, "../functions/suspiciousAccountRuntime.js"),
      "utf8"
    );
    assert.doesNotMatch(runtime, /status:\s*"inactive"/);
    assert.match(runtime, /Never auto-deactivate|suspiciousFlag/i);
  });

  it("dismiss and deactivate services write audit actions", () => {
    const service = fs.readFileSync(
      path.join(__dirname, "../src/services/suspiciousAccountService.js"),
      "utf8"
    );
    assert.match(service, /SUSPICIOUS_ACCOUNT_DISMISSED/);
    assert.match(service, /toggleUserStatus/);
    assert.match(service, /Authentication required/);
  });

  it("doctor Audit Logs role filter no longer offers Admin", () => {
    const auditPage = fs.readFileSync(
      path.join(__dirname, "../src/pages/admin/AuditLogs.jsx"),
      "utf8"
    );
    assert.doesNotMatch(auditPage, /<option value="admin">Admin<\/option>/);
    assert.match(auditPage, /<option value="doctor">Doctor<\/option>/);
    assert.match(auditPage, /<option value="secretary">Secretary<\/option>/);
  });

  it("Audit Logs route is doctor/admin RoleRoute only (parents/secretaries blocked)", () => {
    const routes = fs.readFileSync(
      path.join(__dirname, "../src/routes/AppRoutes.jsx"),
      "utf8"
    );
    assert.match(
      routes,
      /RoleRoute allowedRoles=\{\["doctor", "admin"\]\}/
    );
    assert.match(routes, /path="audit-logs"/);
  });
});

describe("Suspicious account notification — role recipients", () => {
  it("listActiveDoctorIds only includes doctor/admin active users in runtime", () => {
    const runtime = fs.readFileSync(
      path.join(__dirname, "../functions/suspiciousAccountRuntime.js"),
      "utf8"
    );
    assert.match(
      runtime,
      /user\.role === "doctor" \|\| user\.role === "admin"/
    );
    assert.match(runtime, /user\.status !== "inactive"/);
  });
});
