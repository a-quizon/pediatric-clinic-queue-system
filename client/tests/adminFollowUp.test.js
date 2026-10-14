import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { countActiveClinicStaff, isActiveClinicStaff } from "../src/utils/staffCounts.js";
import {
  canCreateDoctor,
  canReactivateDoctor,
  findActiveDoctor as findActiveDoctorClient,
} from "../src/utils/doctorAccountPolicy.js";
import { AUDIT_ROLE_FILTER_OPTIONS, matchesAuditRoleFilter } from "../src/utils/auditLogFilters.js";
import {
  CUSTOM_PRESET,
  DEFAULT_REPORT_PRESET,
  REPORT_PRESETS,
  editRange,
  isDateInRange,
  isTimestampInRange,
  presetRange,
  rangeSpanDays,
  selectPreset,
  timestampToManilaDate,
  validateRange,
} from "../src/utils/reportDateRange.js";
import {
  ALL_BRANCHES,
  aggregateSessionMetrics,
  buildSessionRows,
  filterSessions,
  sessionPanelLabels,
  sortSessionsNewestFirst,
} from "../src/utils/reportSessions.js";
import { isRowActivationKey, sessionRowProps } from "../src/utils/sessionRowInteraction.js";

const require = createRequire(import.meta.url);
const { createDoctorAccount, LOCK_PATH } = require("../functions/createDoctorAccountRuntime.js");
const { setDoctorAccountStatus } = require("../functions/doctorStatusRuntime.js");
const { deleteUserAccount } = require("../functions/deleteUserAccountRuntime.js");
const { claimPasswordResetSlot } = require("../functions/passwordResetLimitService.js");
const {
  evaluateAndFlagParent,
  listActiveAdminIds,
} = require("../functions/suspiciousAccountRuntime.js");

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
    forEach: (fn) => {
      if (!val || typeof val !== "object") return;
      Object.entries(val).forEach(([childKey, child]) => fn(snap(child, childKey)));
    },
  });
  let pushSeq = 0;

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
    async update(values) {
      await tick();
      for (const [key, value] of Object.entries(values)) write(`${path}/${key}`, value);
    },
    async transaction(update) {
      await tick();
      const next = update(read(path) ?? null);
      if (next === undefined) return { committed: false, snapshot: snap(read(path)) };
      write(path, next);
      return { committed: true, snapshot: snap(read(path)) };
    },
    push() {
      pushSeq += 1;
      return ref(`${path}/log${pushSeq}`);
    },
    orderByChild: (field) => ({
      equalTo: (value) => ({
        async once() {
          await tick();
          const rows = Object.entries(read(path) || {}).filter(([, row]) => row && row[field] === value);
          const matched = rows.length ? Object.fromEntries(rows) : null;
          return {
            ...snap(matched),
            forEach: (fn) => rows.forEach(([key, row]) => fn(snap(row, key))),
          };
        },
      }),
    }),
  });

  return { root, ref };
}

function createFakeAdmin(initialDb, { existingEmails = [] } = {}) {
  const db = createTreeDb(initialDb);
  const authUsers = new Map(existingEmails.map((email, i) => [email, { uid: `existing${i}`, email }]));
  const revoked = [];
  const deletedAuthUids = [];
  let seq = 0;
  const admin = {
    database: () => ({ ref: db.ref }),
    auth: () => ({
      async createUser({ email, displayName }) {
        await tick();
        if (authUsers.has(email)) {
          const err = new Error("exists");
          err.code = "auth/email-already-exists";
          throw err;
        }
        seq += 1;
        const record = { uid: `newDoctor${seq}`, email, displayName };
        authUsers.set(email, record);
        return record;
      },
      async deleteUser(uid) {
        deletedAuthUids.push(uid);
        for (const [email, rec] of authUsers) if (rec.uid === uid) authUsers.delete(email);
      },
      async revokeRefreshTokens(uid) {
        revoked.push(uid);
      },
    }),
  };
  return { admin, db, authUsers, revoked, deletedAuthUids };
}

const ADMIN = { uid: "admin1", name: "System Admin", role: "admin", status: "active" };
const validPayload = {
  name: "Dr. New",
  email: "newdoc@plus.queue",
  phone: "+639171234567",
  password: "a-strong-pass-123",
};

describe("active staff count (dashboard)", () => {
  it("counts only active doctors and secretaries", () => {
    const users = [
      { role: "doctor", status: "active" },
      { role: "secretary", status: "active" },
      { role: "secretary", status: "active" },
      { role: "admin", status: "active" },
      { role: "admin", status: "active" },
      { role: "parent", status: "active" },
      { role: "secretary", status: "inactive" },
      { role: "doctor", status: "active", isDeleted: true },
      { status: "active" },
    ];
    assert.equal(countActiveClinicStaff(users), 3);
  });

  it("treats missing users and roles safely", () => {
    assert.equal(countActiveClinicStaff(null), 0);
    assert.equal(isActiveClinicStaff(undefined), false);
    assert.equal(isActiveClinicStaff({ role: "admin", status: "active" }), false);
  });
});

describe("one-active-doctor rule", () => {
  it("client policy blocks creation while an active doctor exists", () => {
    assert.equal(canCreateDoctor([{ role: "doctor", status: "active" }]), false);
    assert.equal(canCreateDoctor({ a: { role: "doctor", status: "inactive" } }), true);
    assert.equal(canCreateDoctor([{ role: "doctor", status: "active", isDeleted: true }]), true);
    assert.equal(findActiveDoctorClient([]), null);
  });

  it("creates a doctor with the expected shape and an admin audit entry", async () => {
    const { admin, db } = createFakeAdmin({ users: { admin1: ADMIN } });
    const result = await createDoctorAccount({ admin, callerUid: "admin1", payload: validPayload, now: () => 1000 });
    assert.equal(result.success, true);
    const profile = db.root.users[result.uid];
    assert.equal(profile.role, "doctor");
    assert.equal(profile.status, "active");
    assert.equal(profile.phone, "+639171234567");
    assert.equal("assignedBranch" in profile, false);
    const audit = Object.values(db.root.auditLogs);
    assert.equal(audit.length, 1);
    assert.equal(audit[0].actorRole, "admin");
    assert.equal(audit[0].action, "USER_CREATED");
    assert.equal(audit[0].targetId, result.uid);
    assert.equal(db.root.systemLocks?.doctorProvisioning, undefined, "lock released");
  });

  it("rejects with 409 when an active doctor already exists", async () => {
    const { admin, authUsers } = createFakeAdmin({
      users: { admin1: ADMIN, doc1: { role: "doctor", status: "active" } },
    });
    await assert.rejects(
      createDoctorAccount({ admin, callerUid: "admin1", payload: validPayload }),
      (err) => err.status === 409
    );
    assert.equal(authUsers.size, 0);
  });

  it("ignores deactivated or archived doctors", async () => {
    const { admin } = createFakeAdmin({
      users: {
        admin1: ADMIN,
        old1: { role: "doctor", status: "inactive" },
        old2: { role: "doctor", status: "active", isDeleted: true },
      },
    });
    const result = await createDoctorAccount({ admin, callerUid: "admin1", payload: validPayload });
    assert.equal(result.success, true);
  });

  it("rejects non-admin callers with 403", async () => {
    const { admin } = createFakeAdmin({
      users: { doc1: { role: "doctor", status: "inactive" }, sec1: { role: "secretary", status: "active" } },
    });
    await assert.rejects(
      createDoctorAccount({ admin, callerUid: "sec1", payload: validPayload }),
      (err) => err.status === 403
    );
  });

  it("rejects while another provisioning lock is held", async () => {
    const { admin } = createFakeAdmin({
      users: { admin1: ADMIN },
      systemLocks: { doctorProvisioning: { token: "other", by: "admin2", expiresAt: Date.now() + 60000 } },
    });
    await assert.rejects(
      createDoctorAccount({ admin, callerUid: "admin1", payload: validPayload }),
      (err) => err.status === 409 && /in progress/.test(err.message)
    );
    assert.ok(LOCK_PATH);
  });

  it("allows only one doctor when two admins race", async () => {
    const { admin, db } = createFakeAdmin({
      users: { admin1: ADMIN, admin2: { ...ADMIN, uid: "admin2" } },
    });
    const results = await Promise.allSettled([
      createDoctorAccount({ admin, callerUid: "admin1", payload: validPayload }),
      createDoctorAccount({ admin, callerUid: "admin2", payload: { ...validPayload, email: "other@plus.queue" } }),
    ]);
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    assert.equal(results.find((r) => r.status === "rejected").reason.status, 409);
    const doctors = Object.values(db.root.users).filter((u) => u.role === "doctor" && u.status === "active");
    assert.equal(doctors.length, 1);
  });

  it("maps duplicate email to 409 and keeps no partial profile", async () => {
    const { admin, db } = createFakeAdmin({ users: { admin1: ADMIN } }, { existingEmails: [validPayload.email] });
    await assert.rejects(
      createDoctorAccount({ admin, callerUid: "admin1", payload: validPayload }),
      (err) => err.status === 409
    );
    assert.equal(Object.values(db.root.users).some((u) => u.role === "doctor"), false);
  });

  it("validates input with 400", async () => {
    const { admin } = createFakeAdmin({ users: { admin1: ADMIN } });
    await assert.rejects(
      createDoctorAccount({ admin, callerUid: "admin1", payload: { ...validPayload, password: "short" } }),
      (err) => err.status === 400
    );
  });
});

describe("doctor deactivate / reactivate (admin only)", () => {
  const liveConsultation = {
    schedules: { s1: { queueStatus: "active", status: "open" } },
    reservations: { r1: { scheduleId: "s1", status: "with_doctor" } },
  };

  it("client policy blocks reactivation while another doctor is active", () => {
    const users = [
      { id: "d1", role: "doctor", status: "active" },
      { id: "d2", role: "doctor", status: "inactive" },
    ];
    assert.equal(canReactivateDoctor(users, "d2"), false);
    assert.equal(canReactivateDoctor(users, "d1"), true);
    assert.equal(canReactivateDoctor([{ id: "d2", role: "doctor", status: "inactive" }], "d2"), true);
  });

  it("deactivates, revokes sessions, and audits as admin", async () => {
    const { admin, db, revoked } = createFakeAdmin({
      users: { admin1: ADMIN, doc1: { role: "doctor", status: "active", name: "Dr. A", email: "a@x" } },
    });
    await setDoctorAccountStatus({ admin, callerUid: "admin1", targetUid: "doc1", status: "inactive", now: () => 5 });
    assert.equal(db.root.users.doc1.status, "inactive");
    assert.equal(db.root.users.doc1.deactivationSource, "admin");
    assert.deepEqual(revoked, ["doc1"]);
    const [audit] = Object.values(db.root.auditLogs);
    assert.equal(audit.action, "USER_DEACTIVATED");
    assert.equal(audit.actorRole, "admin");
    assert.equal(audit.metadata.targetName, "Dr. A");
  });

  it("refuses to deactivate during a live consultation", async () => {
    const { admin, db } = createFakeAdmin({
      users: { admin1: ADMIN, doc1: { role: "doctor", status: "active" } },
      ...liveConsultation,
    });
    await assert.rejects(
      setDoctorAccountStatus({ admin, callerUid: "admin1", targetUid: "doc1", status: "inactive" }),
      (err) => err.status === 409
    );
    assert.equal(db.root.users.doc1.status, "active");
  });

  it("ignores consultations on sessions that already ended", async () => {
    const { admin } = createFakeAdmin({
      users: { admin1: ADMIN, doc1: { role: "doctor", status: "active" } },
      schedules: { s1: { queueStatus: "ended" } },
      reservations: { r1: { scheduleId: "s1", status: "with_doctor" } },
    });
    const res = await setDoctorAccountStatus({ admin, callerUid: "admin1", targetUid: "doc1", status: "inactive" });
    assert.equal(res.success, true);
  });

  it("rejects non-admin callers (including the doctor and inactive admins)", async () => {
    const { admin } = createFakeAdmin({
      users: {
        doc1: { role: "doctor", status: "active" },
        sec1: { role: "secretary", status: "active" },
        admin2: { ...ADMIN, status: "inactive" },
      },
    });
    for (const callerUid of ["doc1", "sec1", "admin2", null]) {
      await assert.rejects(
        setDoctorAccountStatus({ admin, callerUid, targetUid: "doc1", status: "inactive" }),
        (err) => err.status === 403 || err.status === 401
      );
    }
  });

  it("rejects non-doctor targets and self-changes", async () => {
    const { admin } = createFakeAdmin({
      users: { admin1: ADMIN, sec1: { role: "secretary", status: "active" } },
    });
    await assert.rejects(
      setDoctorAccountStatus({ admin, callerUid: "admin1", targetUid: "sec1", status: "inactive" }),
      (err) => err.status === 400
    );
    await assert.rejects(
      setDoctorAccountStatus({ admin, callerUid: "admin1", targetUid: "admin1", status: "inactive" }),
      (err) => err.status === 400
    );
  });

  it("reactivates when no other doctor is active and audits it", async () => {
    const { admin, db } = createFakeAdmin({
      users: { admin1: ADMIN, doc1: { role: "doctor", status: "inactive", deactivationSource: "admin" } },
    });
    await setDoctorAccountStatus({ admin, callerUid: "admin1", targetUid: "doc1", status: "active" });
    assert.equal(db.root.users.doc1.status, "active");
    assert.equal("deactivationSource" in db.root.users.doc1, false);
    assert.equal(Object.values(db.root.auditLogs)[0].action, "USER_ACTIVATED");
    assert.equal(db.root.systemLocks?.doctorProvisioning, undefined, "lock released");
  });

  it("rejects reactivation with 409 while another doctor is active", async () => {
    const { admin, db } = createFakeAdmin({
      users: {
        admin1: ADMIN,
        doc1: { role: "doctor", status: "active" },
        doc2: { role: "doctor", status: "inactive" },
      },
    });
    await assert.rejects(
      setDoctorAccountStatus({ admin, callerUid: "admin1", targetUid: "doc2", status: "active" }),
      (err) => err.status === 409 && /Deactivate the current doctor first/.test(err.message)
    );
    assert.equal(db.root.users.doc2.status, "inactive");
  });

  it("allows only one of two concurrent reactivations", async () => {
    const { admin, db } = createFakeAdmin({
      users: {
        admin1: ADMIN,
        doc1: { role: "doctor", status: "inactive" },
        doc2: { role: "doctor", status: "inactive" },
      },
    });
    const results = await Promise.allSettled([
      setDoctorAccountStatus({ admin, callerUid: "admin1", targetUid: "doc1", status: "active" }),
      setDoctorAccountStatus({ admin, callerUid: "admin1", targetUid: "doc2", status: "active" }),
    ]);
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    const active = Object.values(db.root.users).filter((u) => u.role === "doctor" && u.status === "active");
    assert.equal(active.length, 1);
  });

  it("blocks creation while a reactivated doctor is active", async () => {
    const { admin } = createFakeAdmin({
      users: { admin1: ADMIN, doc1: { role: "doctor", status: "inactive" } },
    });
    await setDoctorAccountStatus({ admin, callerUid: "admin1", targetUid: "doc1", status: "active" });
    await assert.rejects(
      createDoctorAccount({ admin, callerUid: "admin1", payload: validPayload }),
      (err) => err.status === 409
    );
  });
});

describe("doctor delete (admin only)", () => {
  const seed = (extra = {}) => ({
    users: {
      admin1: ADMIN,
      doc1: { role: "doctor", status: "inactive", name: "Dr. Gone", email: "gone@x" },
    },
    notifications: { doc1: { n1: { title: "x" } } },
    doctorAlerts: { doc1: { a1: { type: "suspicious" } } },
    schedules: { old: { doctorId: "doc1", queueStatus: "ended" } },
    auditLogs: { old: { actorUid: "doc1", actorName: "Dr. Gone", actorRole: "doctor" } },
    ...extra,
  });

  it("removes Auth user and profile, keeps history, audits with a snapshot", async () => {
    const { admin, db, deletedAuthUids } = createFakeAdmin(seed());
    const res = await deleteUserAccount({ admin, callerUid: "admin1", targetUid: "doc1" });
    assert.equal(res.success, true);
    assert.deepEqual(deletedAuthUids, ["doc1"]);
    assert.equal(db.root.users.doc1, undefined);
    assert.equal(db.root.notifications?.doc1, undefined);
    assert.ok(db.root.doctorAlerts.doc1, "doctor alerts kept as history");
    assert.equal(db.root.schedules.old.doctorId, "doc1", "past sessions untouched");
    assert.equal(db.root.auditLogs.old.actorName, "Dr. Gone", "old audit snapshot untouched");
    const entry = Object.values(db.root.auditLogs).find((l) => l.action === "USER_DELETED");
    assert.equal(entry.actorRole, "admin");
    assert.equal(entry.metadata.targetName, "Dr. Gone");
    assert.equal(entry.metadata.targetEmail, "gone@x");
  });

  it("can delete an active doctor when nobody is in consultation", async () => {
    const data = seed();
    data.users.doc1.status = "active";
    const { admin, db } = createFakeAdmin(data);
    await deleteUserAccount({ admin, callerUid: "admin1", targetUid: "doc1" });
    assert.equal(db.root.users.doc1, undefined);
    assert.equal(canCreateDoctor(db.root.users), true, "a new doctor can now be created");
  });

  it("refuses during a live consultation", async () => {
    const { admin, db, deletedAuthUids } = createFakeAdmin(
      seed({
        schedules: { s1: { queueStatus: "active" } },
        reservations: { r1: { scheduleId: "s1", status: "in_consultation" } },
      })
    );
    await assert.rejects(
      deleteUserAccount({ admin, callerUid: "admin1", targetUid: "doc1" }),
      (err) => err.status === 409
    );
    assert.ok(db.root.users.doc1);
    assert.deepEqual(deletedAuthUids, []);
  });

  it("only an active admin can delete a doctor", async () => {
    const data = seed();
    data.users.doc2 = { role: "doctor", status: "active" };
    data.users.admin2 = { ...ADMIN, status: "inactive" };
    const { admin, db } = createFakeAdmin(data);
    for (const callerUid of ["doc2", "admin2"]) {
      await assert.rejects(
        deleteUserAccount({ admin, callerUid, targetUid: "doc1" }),
        (err) => err.status === 403
      );
    }
    assert.ok(db.root.users.doc1);
  });

  it("never deletes admins or the caller", async () => {
    const { admin } = createFakeAdmin({ users: { admin1: ADMIN, admin2: { ...ADMIN } } });
    await assert.rejects(deleteUserAccount({ admin, callerUid: "admin1", targetUid: "admin1" }), (e) => e.status === 400);
    await assert.rejects(deleteUserAccount({ admin, callerUid: "admin1", targetUid: "admin2" }), (e) => e.status === 400);
  });

  it("only an active admin can delete secretary or parent accounts", async () => {
    const data = {
      users: {
        admin1: ADMIN,
        doc1: { role: "doctor", status: "active" },
        sec1: { role: "secretary", status: "active" },
        sec2: { role: "secretary", status: "active" },
        par1: { role: "parent", status: "active" },
        admin2: { ...ADMIN, status: "inactive" },
        admin3: { ...ADMIN, isDeleted: true },
      },
    };
    const { admin, db, deletedAuthUids } = createFakeAdmin(data);
    for (const callerUid of ["doc1", "sec1", "admin2", "admin3", "ghost"]) {
      for (const targetUid of ["sec2", "par1"]) {
        await assert.rejects(
          deleteUserAccount({ admin, callerUid, targetUid }),
          (err) => err.status === 403,
          `${callerUid} -> ${targetUid}`
        );
      }
    }
    assert.deepEqual(deletedAuthUids, []);
    await deleteUserAccount({ admin, callerUid: "admin1", targetUid: "sec2" });
    await deleteUserAccount({ admin, callerUid: "admin1", targetUid: "par1" });
    assert.equal(db.root.users.sec2, undefined);
    assert.equal(db.root.users.par1, undefined);
  });

  it("checks the caller before looking at the target", async () => {
    const { admin } = createFakeAdmin({ users: { admin1: ADMIN, doc1: { role: "doctor", status: "active" } } });
    await assert.rejects(deleteUserAccount({ admin, callerUid: "doc1", targetUid: "nobody" }), (e) => e.status === 403);
    const res = await deleteUserAccount({ admin, callerUid: "admin1", targetUid: "nobody" });
    assert.equal(res.success, true);
  });

  it("succeeds when the Auth user is already gone", async () => {
    const { admin, db } = createFakeAdmin(seed());
    const auth = admin.auth;
    admin.auth = () => ({
      ...auth(),
      async deleteUser() {
        const err = new Error("nf");
        err.code = "auth/user-not-found";
        throw err;
      },
    });
    await deleteUserAccount({ admin, callerUid: "admin1", targetUid: "doc1" });
    assert.equal(db.root.users.doc1, undefined);
  });
});

describe("session history row click", () => {
  it("opens the session on click, Enter, and Space", () => {
    const opened = [];
    const props = sessionRowProps("s1", (id) => opened.push(id), "View reservations");
    assert.equal(props.role, "button");
    assert.equal(props.tabIndex, 0);
    props.onClick();
    let prevented = 0;
    props.onKeyDown({ key: "Enter", preventDefault: () => (prevented += 1) });
    props.onKeyDown({ key: " ", preventDefault: () => (prevented += 1) });
    props.onKeyDown({ key: "Tab", preventDefault: () => (prevented += 1) });
    assert.deepEqual(opened, ["s1", "s1", "s1"]);
    assert.equal(prevented, 2, "Tab still moves focus");
  });

  it("is plain text when no handler is given", () => {
    assert.deepEqual(sessionRowProps("s1", undefined, "x"), {});
    assert.equal(isRowActivationKey({ key: "Escape" }), false);
  });

  it("labels the panel with the Manila date, branch, and hours", () => {
    const { title, subtitle } = sessionPanelLabels({
      clinicDate: "2026-10-14",
      branch: "Angeles",
      openingTime: "08:00",
      closingTime: "12:00",
    });
    assert.match(title, /^Reservations on .*October 14, 2026/);
    assert.equal(subtitle, "Angeles · 08:00 - 12:00");
    assert.deepEqual(sessionPanelLabels(null), { title: "Reservations", subtitle: null });
  });
});

describe("audit log role filter", () => {
  const logs = [
    { id: 1, actorRole: "admin" },
    { id: 2, actorRole: "doctor" },
    { id: 3, actorRole: "secretary" },
    { id: 4, actorRole: "system" },
    { id: 5 },
  ];

  it("offers an Admin option", () => {
    assert.ok(AUDIT_ROLE_FILTER_OPTIONS.some((o) => o.value === "admin" && o.label === "Admin"));
  });

  it("filters admin entries exactly and keeps legacy entries under All", () => {
    assert.deepEqual(logs.filter((l) => matchesAuditRoleFilter(l, "admin")).map((l) => l.id), [1]);
    assert.deepEqual(logs.filter((l) => matchesAuditRoleFilter(l, "doctor")).map((l) => l.id), [2]);
    assert.equal(logs.filter((l) => matchesAuditRoleFilter(l, "all")).length, logs.length);
  });
});

describe("report date range (Asia/Manila)", () => {
  const today = "2026-10-14";

  it("offers exactly All Time, Today, This Week, This Month, This Year (All Time default)", () => {
    assert.deepEqual(
      REPORT_PRESETS.map((p) => p.label),
      ["All Time", "Today", "This Week", "This Month", "This Year"]
    );
    assert.equal(DEFAULT_REPORT_PRESET, "all");
  });

  it("builds inclusive calendar presets (weeks run Sunday to Saturday)", () => {
    // 2026-10-14 is a Wednesday.
    assert.deepEqual(presetRange("all", today), { from: "", to: "" });
    assert.deepEqual(presetRange("today", today), { from: today, to: today });
    assert.deepEqual(presetRange("week", today), { from: "2026-10-11", to: "2026-10-17" });
    assert.deepEqual(presetRange("month", today), { from: "2026-10-01", to: "2026-10-31" });
    assert.deepEqual(presetRange("year", today), { from: "2026-01-01", to: "2026-12-31" });
    assert.equal(rangeSpanDays(presetRange("week", today)), 7);
  });

  it("handles week, month, and year edges", () => {
    assert.deepEqual(presetRange("week", "2026-10-11"), { from: "2026-10-11", to: "2026-10-17" });
    assert.deepEqual(presetRange("week", "2026-10-17"), { from: "2026-10-11", to: "2026-10-17" });
    assert.deepEqual(presetRange("week", "2027-01-01"), { from: "2026-12-27", to: "2027-01-02" });
    assert.deepEqual(presetRange("month", "2028-02-10"), { from: "2028-02-01", to: "2028-02-29" });
    assert.deepEqual(presetRange("month", "2026-02-10"), { from: "2026-02-01", to: "2026-02-28" });
    assert.deepEqual(presetRange("year", "2026-12-31"), { from: "2026-01-01", to: "2026-12-31" });
  });

  it("selecting a preset fills From/To; editing a date clears the preset", () => {
    const picked = selectPreset("month", today);
    assert.equal(picked.preset, "month");
    assert.deepEqual(picked.range, { from: "2026-10-01", to: "2026-10-31" });
    const edited = editRange(picked.range, { to: "2026-10-20" });
    assert.equal(edited.preset, CUSTOM_PRESET);
    assert.deepEqual(edited.range, { from: "2026-10-01", to: "2026-10-20" });
    assert.deepEqual(selectPreset("all", today), { preset: "all", range: { from: "", to: "" } });
  });

  it("This Week includes a timestamp just after Sunday midnight Manila, not just before", () => {
    const range = presetRange("week", today);
    // Sunday 2026-10-11 00:00 Manila = 2026-10-10T16:00Z
    assert.equal(isTimestampInRange(Date.parse("2026-10-10T16:00:00Z"), range), true);
    assert.equal(isTimestampInRange(Date.parse("2026-10-10T15:59:59Z"), range), false);
    // Saturday 2026-10-17 23:59 Manila = 2026-10-17T15:59Z
    assert.equal(isTimestampInRange(Date.parse("2026-10-17T15:59:59Z"), range), true);
    assert.equal(isTimestampInRange(Date.parse("2026-10-17T16:00:00Z"), range), false);
  });

  it("rejects From after To", () => {
    assert.match(validateRange({ from: "2026-10-15", to: "2026-10-14" }), /cannot be after/);
    assert.equal(validateRange({ from: "2026-10-14", to: "2026-10-14" }), null);
    assert.equal(validateRange({ from: "", to: "" }), null);
  });

  it("is inclusive on both ends and open when unbounded", () => {
    const range = { from: "2026-10-01", to: "2026-10-14" };
    assert.equal(isDateInRange("2026-10-01", range), true);
    assert.equal(isDateInRange("2026-10-14", range), true);
    assert.equal(isDateInRange("2026-09-30", range), false);
    assert.equal(isDateInRange("2026-10-15", range), false);
    assert.equal(isDateInRange("2020-01-01", { from: "", to: "" }), true);
    assert.equal(isDateInRange(undefined, range), false);
  });

  it("uses Manila day boundaries for timestamps", () => {
    // 2026-10-13T16:30Z is 00:30 on Oct 14 in Manila (UTC+8)
    assert.equal(timestampToManilaDate(Date.parse("2026-10-13T16:30:00Z")), "2026-10-14");
    assert.equal(timestampToManilaDate(Date.parse("2026-10-13T15:59:59Z")), "2026-10-13");
    const range = { from: "2026-10-14", to: "2026-10-14" };
    assert.equal(isTimestampInRange(Date.parse("2026-10-13T16:30:00Z"), range), true);
    assert.equal(isTimestampInRange(Date.parse("2026-10-13T15:59:59Z"), range), false);
  });
});

describe("report sessions", () => {
  const schedules = [
    { id: "s1", clinicDate: "2026-10-01", branch: "Angeles", status: "completed", openingTime: "08:00" },
    { id: "s2", clinicDate: "2026-10-10", branch: "Magalang", queueStatus: "ended", openingTime: "09:00" },
    { id: "s3", clinicDate: "2026-10-12", branch: "Angeles", status: "open" },
    { id: "s4", clinicDate: "2026-10-10", branch: "Angeles", queueStatus: "completed", openingTime: "13:00" },
  ];
  const reservations = [
    { scheduleId: "s1", status: "completed" },
    { scheduleId: "s1", status: "cancelled" },
    { scheduleId: "s2", status: "forfeited" },
    { scheduleId: "s2", status: "consultation_completed" },
    { scheduleId: "s3", status: "completed" },
  ];
  const rows = buildSessionRows(schedules, reservations);

  it("keeps only completed sessions with per-session metrics", () => {
    assert.deepEqual(rows.map((r) => r.id), ["s1", "s2", "s4"]);
    assert.equal(rows[0].metrics.totalReservations, 2);
    assert.equal(rows[0].metrics.completionRate, 50);
  });

  it("filters by branch (All default) and inclusive range; totals follow", () => {
    assert.equal(filterSessions(rows).length, 3);
    assert.equal(filterSessions(rows, { branch: ALL_BRANCHES, range: { from: "2026-10-10", to: "2026-10-10" } }).length, 2);
    const angeles = filterSessions(rows, { branch: "Angeles", range: { from: "2026-10-01", to: "2026-10-31" } });
    assert.deepEqual(angeles.map((r) => r.id), ["s1", "s4"]);
    const totals = aggregateSessionMetrics(filterSessions(rows, { range: { from: "2026-10-02", to: "" } }));
    assert.equal(totals.totalReservations, 2);
    assert.equal(totals.forfeited, 1);
  });

  it("sorts newest first", () => {
    assert.deepEqual(sortSessionsNewestFirst(rows).map((r) => r.id), ["s2", "s4", "s1"]);
  });
});

describe("password reset emails are for parents only", () => {
  const deps = (role) => {
    const db = createTreeDb({ users: { u1: { role } } });
    return {
      db: { ref: db.ref },
      auth: {
        async getUserByEmail(email) {
          if (email === "known@plus.queue") return { uid: "u1" };
          const err = new Error("nf");
          err.code = "auth/user-not-found";
          throw err;
        },
      },
    };
  };

  it("refuses admin emails with auth_denied", async () => {
    await assert.rejects(claimPasswordResetSlot("known@plus.queue", deps("admin")), (err) => err.code === "auth_denied");
  });

  it("refuses doctor and secretary emails and points them to the System Admin", async () => {
    for (const role of ["doctor", "secretary"]) {
      await assert.rejects(
        claimPasswordResetSlot("known@plus.queue", deps(role)),
        (err) => err.code === "auth_denied" && /System Admin/.test(err.message),
        role
      );
    }
  });

  it("allows parent and unknown emails", async () => {
    const ok = await claimPasswordResetSlot("known@plus.queue", deps("parent"));
    assert.equal(ok.success, true);
    const unknown = await claimPasswordResetSlot("nobody@plus.queue", deps("parent"));
    assert.equal(unknown.success, true);
  });

  it("Express and Cloud Functions refuse the same roles", () => {
    const serverSrc = fs.readFileSync(
      path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../server/services/passwordResetLimitService.js"),
      "utf8"
    );
    assert.match(serverSrc, /role && role !== "parent"/);
    assert.match(serverSrc, /STAFF_RESET_BLOCKED_MESSAGE/);
  });
});

describe("Express admin routes mirror the Cloud Functions runtimes", () => {
  const serverDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../server");
  const adminRoute = fs.readFileSync(path.join(serverDir, "routes/admin.js"), "utf8");

  it("delegates every user-management route to the shared runtime", () => {
    for (const runtime of [
      "deleteUserAccountRuntime",
      "updateUserAccountRuntime",
      "resetSecretaryPasswordRuntime",
      "createDoctorAccountRuntime",
      "doctorStatusRuntime",
    ]) {
      assert.match(adminRoute, new RegExp(`client/functions/${runtime}`), runtime);
    }
  });

  it("has no role logic of its own that could drift from the runtimes", () => {
    assert.doesNotMatch(adminRoute, /role\s*[!=]==/);
  });

  it("clinical Express routes do not treat admin as staff", () => {
    for (const file of ["routes/push.js", "routes/reservations.js"]) {
      const source = fs.readFileSync(path.join(serverDir, file), "utf8");
      const staff = source.match(/STAFF_ROLES = new Set\(\[([^\]]*)\]\)/);
      assert.ok(staff, file);
      assert.doesNotMatch(staff[1], /admin/, file);
    }
  });
});

describe("suspicious-account alerts go to active admins only", () => {
  const today = "2026-10-15";
  const noShows = {
    r1: { parentId: "p1", status: "forfeited", clinicDate: "2026-10-01", createdAt: 1 },
    r2: { parentId: "p1", status: "forfeited", clinicDate: "2026-10-05", createdAt: 2 },
    r3: { parentId: "p1", status: "expired", clinicDate: "2026-10-09", createdAt: 3 },
  };
  const seed = () => ({
    users: {
      p1: { role: "parent", status: "active", name: "Pat Parent" },
      admin1: { role: "admin", status: "active" },
      admin2: { role: "admin", status: "inactive" },
      admin3: { role: "admin", status: "active", isDeleted: true },
      doctor1: { role: "doctor", status: "active" },
    },
    reservations: noShows,
  });

  it("lists only active, non-deleted admins", async () => {
    const db = createTreeDb(seed());
    assert.deepEqual(await listActiveAdminIds({ ref: db.ref }), ["admin1"]);
  });

  it("writes adminAlerts and pushes with an /admin/audit-logs link; doctors get nothing", async () => {
    const db = createTreeDb(seed());
    const pushes = [];
    const result = await evaluateAndFlagParent("p1", {
      db: { ref: db.ref },
      todayManila: today,
      sendPush: async (uid, notification) => {
        pushes.push({ uid, notification });
        return { sent: 1 };
      },
    });

    assert.equal(result.flagged, true);
    assert.deepEqual(pushes.map((p) => p.uid), ["admin1"]);
    assert.equal(pushes[0].notification.url, `/admin/audit-logs?highlight=${result.auditLogId}`);
    const alerts = Object.values(db.root.adminAlerts.admin1);
    assert.equal(alerts.length, 1);
    assert.equal(alerts[0].type, "SUSPICIOUS_ACCOUNT");
    assert.equal(alerts[0].url, `/admin/audit-logs?highlight=${result.auditLogId}`);
    assert.equal(db.root.adminAlerts.admin2, undefined);
    assert.equal(db.root.doctorAlerts, undefined);
    assert.equal(db.root.users.p1.suspiciousFlag.status, "open");
  });

  it("flags and alerts once when two evaluators race", async () => {
    const db = createTreeDb(seed());
    const pushes = [];
    const options = {
      db: { ref: db.ref },
      todayManila: today,
      sendPush: async (uid) => {
        pushes.push(uid);
        return { sent: 1 };
      },
    };
    const results = await Promise.all([
      evaluateAndFlagParent("p1", options),
      evaluateAndFlagParent("p1", options),
    ]);

    assert.equal(results.filter((r) => r.flagged).length, 1);
    assert.equal(pushes.length, 1);
    assert.equal(Object.keys(db.root.auditLogs).length, 1);
    assert.equal(Object.keys(db.root.adminAlerts.admin1).length, 1);
  });
});
