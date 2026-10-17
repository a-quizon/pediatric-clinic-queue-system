import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const clientRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const rules = JSON.parse(fs.readFileSync(path.join(clientRoot, "database.rules.json"), "utf8")).rules;

const ROLE = "root.child('users').child(auth.uid).child('role').val()";
const IS_ADMIN = `${ROLE} === 'admin'`;
const IS_DOCTOR = `${ROLE} === 'doctor'`;
const IS_SECRETARY = `${ROLE} === 'secretary'`;
const IS_ACTIVE = "root.child('users').child(auth.uid).child('status').val() === 'active'";

test("users list read is admin only", () => {
  const expr = rules.users[".read"];
  assert.match(expr, new RegExp(escape(IS_ADMIN)));
  assert.doesNotMatch(expr, new RegExp(escape(IS_DOCTOR)));
  assert.doesNotMatch(expr, new RegExp(escape(IS_SECRETARY)));
});

test("users/$uid read keeps self, admin, doctor and secretary", () => {
  const expr = rules.users.$uid[".read"];
  for (const part of ["auth.uid === $uid", IS_ADMIN, IS_DOCTOR, IS_SECRETARY]) {
    assert.ok(expr.includes(part), part);
  }
});

test("users/$uid writes by others are admin only and never on admin records", () => {
  const expr = rules.users.$uid[".write"];
  assert.ok(expr.includes(`(auth.uid === $uid || (${IS_ADMIN} && data.child('role').val() !== 'admin'))`));
  assert.ok(!expr.includes(IS_DOCTOR));
  assert.ok(!expr.includes(IS_SECRETARY));
});

const ADMIN_RECORD_GUARD =
  "(data.child('role').val() !== 'admin' || (newData.exists() && newData.child('role').val() === 'admin' && newData.child('isDeleted').val() === data.child('isDeleted').val() && (newData.child('status').val() === data.child('status').val() || (!data.child('status').exists() && newData.child('status').val() === 'active'))))";

test("admin records: no client (including the owner) can remove, demote, soft-delete, or deactivate them", () => {
  const demoRules = JSON.parse(fs.readFileSync(path.join(clientRoot, "database.demo.rules.json"), "utf8")).rules;
  for (const [label, set] of [["main", rules], ["demo", demoRules]]) {
    const expr = set.users.$uid[".write"];
    assert.ok(expr.endsWith(` && ${ADMIN_RECORD_GUARD})`), `${label}: guard is a top-level conjunct`);
  }
});

test("doctor status stays server-only", () => {
  assert.ok(rules.users.$uid.status[".validate"].includes("root.child('users').child($uid).child('role').val() !== 'doctor'"));
});

test("secretary role only on a brand-new record by an active admin; admin never settable", () => {
  const expr = rules.users.$uid.role[".validate"];
  assert.ok(expr.includes(`!root.child('users').child($uid).exists() && ${IS_ADMIN} && ${IS_ACTIVE} && newData.val() === 'secretary'`));
  assert.ok(!expr.includes(IS_DOCTOR));
  assert.ok(!expr.includes("newData.val() === 'admin'"));
  assert.ok(!expr.includes("newData.val() === 'doctor'"));
});

test("branch assignment and mustChangePassword are admin-only for others", () => {
  for (const key of ["assignedBranch", "assignedBranchId", "mustChangePassword"]) {
    const expr = rules.users.$uid[key][".validate"];
    assert.ok(expr.includes(IS_ADMIN), key);
    assert.ok(!expr.includes(IS_DOCTOR), key);
  }
  assert.ok(rules.users.$uid.mustChangePassword[".validate"].startsWith("auth.uid === $uid ||"));
});

test("branchConfigurations write is active admin only", () => {
  const expr = rules.branchConfigurations[".write"];
  assert.ok(expr.includes(IS_ADMIN) && expr.includes(IS_ACTIVE));
  assert.ok(!expr.includes(IS_DOCTOR) && !expr.includes(IS_SECRETARY));
});

test("admins may only relabel schedule branch fields, never write schedules otherwise", () => {
  const schedule = rules.schedules.$scheduleId;
  assert.ok(!schedule[".write"].includes(IS_ADMIN));
  for (const key of ["branch", "branchId"]) {
    const expr = schedule[key][".write"];
    assert.ok(expr.includes(IS_ADMIN) && expr.includes(IS_ACTIVE), key);
    assert.ok(expr.includes("root.child('schedules').child($scheduleId).exists()"), key);
    assert.ok(expr.includes("newData.isString()"), key);
  }
  assert.deepEqual(Object.keys(schedule).sort(), [".write", "branch", "branchId"]);
});

test("auditLogs read is admin only; write stays for admin and doctor", () => {
  assert.ok(rules.auditLogs[".read"].includes(IS_ADMIN));
  assert.ok(!rules.auditLogs[".read"].includes(IS_DOCTOR));
  assert.ok(rules.auditLogs[".write"].includes(IS_ADMIN));
  assert.ok(rules.auditLogs[".write"].includes(IS_DOCTOR));
});

test("branch queue/SMS settings are writable by doctor and branch secretary, not admin", () => {
  const expr = rules.systemConfiguration.$branchId[".write"];
  assert.ok(expr.includes(IS_DOCTOR) && expr.includes(IS_SECRETARY));
  assert.ok(!expr.includes(IS_ADMIN));
});

test("notifications to non-parent targets: only admin among staff", () => {
  const expr = rules.notifications.$uid[".write"];
  assert.ok(expr.includes(`${IS_ADMIN} && (!root.child('users').child($uid).exists()`));
  assert.ok(!expr.includes(IS_DOCTOR));
});

test("adminAlerts is readable and writable only by the owning admin", () => {
  const node = rules.adminAlerts.$uid;
  for (const key of [".read", ".write"]) {
    assert.ok(node[key].includes("auth.uid === $uid"), key);
    assert.ok(node[key].includes(IS_ADMIN), key);
  }
  assert.ok(node[".write"].includes(IS_ACTIVE));
});

test("reservations: admin may read (documented deviation) but never write", () => {
  assert.ok(rules.reservations[".read"].includes(IS_ADMIN));
  assert.ok(rules.reservations.$reservationId[".read"].includes(IS_ADMIN));
  assert.ok(!rules.reservations.$reservationId[".write"].includes(IS_ADMIN));
  assert.equal(rules.bookingLocks.$uid[".write"], false);
  assert.equal(rules.parentBookingCaps.$uid[".write"], false);
});

test("systemHealth is active-admin read only; rateLimits are server-only", () => {
  const demoRules = JSON.parse(fs.readFileSync(path.join(clientRoot, "database.demo.rules.json"), "utf8")).rules;
  for (const [label, set] of [["main", rules], ["demo", demoRules]]) {
    assert.ok(set.systemHealth[".read"].includes(IS_ADMIN), label);
    assert.ok(set.systemHealth[".read"].includes(IS_ACTIVE), label);
    assert.equal(set.systemHealth[".write"], false, label);
    assert.equal(set.rateLimits[".read"], false, label);
    assert.equal(set.rateLimits[".write"], false, label);
  }
});

function escape(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
