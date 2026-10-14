import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { countActiveClinicStaff, isActiveClinicStaff } from "../src/utils/staffCounts.js";
import { canCreateDoctor, findActiveDoctor as findActiveDoctorClient } from "../src/utils/doctorAccountPolicy.js";
import { AUDIT_ROLE_FILTER_OPTIONS, matchesAuditRoleFilter } from "../src/utils/auditLogFilters.js";
import {
  isDateInRange,
  isTimestampInRange,
  presetRange,
  rangeSpanDays,
  timestampToManilaDate,
  validateRange,
} from "../src/utils/reportDateRange.js";
import {
  ALL_BRANCHES,
  aggregateSessionMetrics,
  buildSessionRows,
  filterSessions,
  sortSessionsNewestFirst,
} from "../src/utils/reportSessions.js";

const require = createRequire(import.meta.url);
const { createDoctorAccount, LOCK_PATH } = require("../functions/createDoctorAccountRuntime.js");
const { claimPasswordResetSlot } = require("../functions/passwordResetLimitService.js");

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
  let pushSeq = 0;

  const ref = (path) => ({
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
    push() {
      pushSeq += 1;
      return ref(`${path}/log${pushSeq}`);
    },
  });

  return { root, ref };
}

function createFakeAdmin(initialDb, { existingEmails = [] } = {}) {
  const db = createTreeDb(initialDb);
  const authUsers = new Map(existingEmails.map((email, i) => [email, { uid: `existing${i}`, email }]));
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
        for (const [email, rec] of authUsers) if (rec.uid === uid) authUsers.delete(email);
      },
    }),
  };
  return { admin, db, authUsers };
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
      (err) => err.status === 409 && /being created/.test(err.message)
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

  it("builds inclusive presets", () => {
    assert.deepEqual(presetRange("today", today), { from: today, to: today });
    assert.deepEqual(presetRange("last7", today), { from: "2026-10-08", to: today });
    assert.deepEqual(presetRange("last30", today), { from: "2026-09-15", to: today });
    assert.deepEqual(presetRange("thisMonth", today), { from: "2026-10-01", to: today });
    assert.deepEqual(presetRange("all", today), { from: "", to: "" });
    assert.equal(rangeSpanDays(presetRange("last7", today)), 7);
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

describe("password reset claim blocks admin accounts", () => {
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

  it("still allows other roles and unknown emails", async () => {
    const ok = await claimPasswordResetSlot("known@plus.queue", deps("secretary"));
    assert.equal(ok.success, true);
    const unknown = await claimPasswordResetSlot("nobody@plus.queue", deps("parent"));
    assert.equal(unknown.success, true);
  });
});
