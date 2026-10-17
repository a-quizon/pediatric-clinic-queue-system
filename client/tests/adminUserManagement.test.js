import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import {
  assertAdminCanDirectResetStaffPassword,
  assertAdminCanUpdateUserProfile,
  auditDescriptionContainsSecret,
  buildStaffPasswordResetAuditDescription,
  canAdminEditUserProfile,
  isDirectPasswordResetRole,
} from "../src/utils/adminUserManagementPolicy.js";

const require = createRequire(import.meta.url);
const {
  generateTemporaryPassword,
  resetSecretaryPassword,
} = require("../functions/resetSecretaryPasswordRuntime.js");
const { updateUserAccount } = require("../functions/updateUserAccountRuntime.js");

function createFakeAdmin({ users = {}, authUsers = {} } = {}) {
  // Flat path store kept for existing assertions (store["users/sec1"]).
  const store = { ...users };
  const authState = { ...authUsers };
  const revoked = [];
  const passwordUpdates = [];

  const parts = (p) => String(p || "").split("/").filter(Boolean);
  const readPath = (p) => {
    if (Object.prototype.hasOwnProperty.call(store, p)) return store[p];
    // Build nested view under users/ for phoneLookup orderByChild
    if (p === "users") {
      const nested = {};
      for (const [key, val] of Object.entries(store)) {
        if (key.startsWith("users/")) nested[key.slice("users/".length)] = val;
      }
      return nested;
    }
    const segs = parts(p);
    if (segs[0] === "users" && segs.length === 2) return store[`users/${segs[1]}`];
    if (segs[0] === "phoneRegistry") {
      const key = segs.slice(1).join("/");
      return key ? store[`phoneRegistry/${key}`] : Object.fromEntries(
        Object.entries(store)
          .filter(([k]) => k.startsWith("phoneRegistry/"))
          .map(([k, v]) => [k.slice("phoneRegistry/".length), v])
      );
    }
    return store[p];
  };
  const writePath = (p, value) => {
    store[p] = value;
  };

  const admin = {
    database() {
      return {
        ref(path) {
          return {
            async once() {
              const val = readPath(path);
              return {
                exists: () => val !== undefined && val !== null,
                val: () => (val === undefined ? null : val),
                forEach: (fn) => {
                  if (!val || typeof val !== "object") return;
                  Object.entries(val).forEach(([key, row]) => {
                    fn({
                      key,
                      val: () => row,
                      exists: () => true,
                    });
                  });
                },
              };
            },
            async update(payload) {
              const current = readPath(path) || {};
              writePath(path, { ...current, ...payload });
            },
            async set(value) {
              writePath(path, value);
            },
            async remove() {
              delete store[path];
            },
            async transaction(fn) {
              const current = readPath(path);
              const next = fn(current == null ? null : structuredClone(current));
              if (next === undefined) {
                return {
                  committed: false,
                  snapshot: {
                    exists: () => readPath(path) != null,
                    val: () => readPath(path) ?? null,
                  },
                };
              }
              writePath(path, next);
              return {
                committed: true,
                snapshot: {
                  exists: () => true,
                  val: () => next,
                },
              };
            },
            orderByChild(field) {
              return {
                equalTo(candidate) {
                  return {
                    async once() {
                      const usersMap = readPath(path) || {};
                      const matches = {};
                      for (const [uid, user] of Object.entries(usersMap)) {
                        if (user && user[field] === candidate) matches[uid] = user;
                      }
                      const value = Object.keys(matches).length ? matches : null;
                      return {
                        exists: () => value != null,
                        val: () => value,
                        forEach: (fn) => {
                          if (!value) return;
                          Object.entries(value).forEach(([key, row]) => {
                            fn({ key, val: () => row });
                          });
                        },
                      };
                    },
                  };
                },
              };
            },
          };
        },
      };
    },
    auth() {
      return {
        async updateUser(uid, data) {
          if (!authState[uid] && !store[`users/${uid}`]) {
            const err = new Error("User not found");
            err.code = "auth/user-not-found";
            throw err;
          }
          passwordUpdates.push({ uid, password: data.password });
          authState[uid] = { ...(authState[uid] || {}), ...data };
        },
        async revokeRefreshTokens(uid) {
          revoked.push(uid);
        },
      };
    },
  };

  return { admin, store, revoked, passwordUpdates };
}

const ADMIN = { role: "admin", status: "active", name: "System Admin" };

describe("admin user management policy", () => {
  it("marks parent and admin profiles as not editable in Admin → Users", () => {
    assert.equal(canAdminEditUserProfile("parent"), false);
    assert.equal(canAdminEditUserProfile("admin"), false);
    assert.equal(canAdminEditUserProfile("secretary"), true);
    assert.equal(canAdminEditUserProfile("doctor"), true);
  });

  it("allows only admin callers to edit staff profiles", () => {
    assert.equal(
      assertAdminCanUpdateUserProfile({ callerRole: "admin", targetRole: "secretary", updates: { name: "Sec" } }).ok,
      true
    );
    for (const callerRole of ["doctor", "secretary", "parent", undefined]) {
      const result = assertAdminCanUpdateUserProfile({
        callerRole,
        targetRole: "secretary",
        updates: { name: "X" },
      });
      assert.equal(result.ok, false, String(callerRole));
      assert.equal(result.status, 403);
    }
  });

  it("rejects parent and admin targets even for admin callers", () => {
    for (const targetRole of ["parent", "admin"]) {
      const result = assertAdminCanUpdateUserProfile({
        callerRole: "admin",
        targetRole,
        updates: { name: "New Name" },
      });
      assert.equal(result.ok, false);
      assert.equal(result.status, 403);
    }
  });

  it("allows direct reset only for admin→secretary and admin→doctor", () => {
    const check = (callerRole, targetRole) =>
      assertAdminCanDirectResetStaffPassword({ callerRole, targetRole });
    assert.equal(check("admin", "secretary").ok, true);
    assert.equal(check("admin", "doctor").ok, true);
    assert.equal(check("admin", "parent").status, 403);
    assert.equal(check("admin", "admin").status, 403);
    assert.equal(check("doctor", "secretary").status, 403);
    assert.equal(check("secretary", "secretary").status, 403);
    assert.equal(check("parent", "secretary").status, 403);
  });

  it("sends reset emails only to parents", () => {
    assert.equal(isDirectPasswordResetRole("secretary"), true);
    assert.equal(isDirectPasswordResetRole("doctor"), true);
    assert.equal(isDirectPasswordResetRole("parent"), false);
    assert.equal(isDirectPasswordResetRole("admin"), false);
  });

  it("builds audit text without embedding a password", () => {
    const secret = "Tmp!Passw0rdABCD";
    const description = buildStaffPasswordResetAuditDescription("Ana Cruz", "secretary");
    assert.equal(description, "Admin reset password for secretary Ana Cruz");
    assert.equal(
      buildStaffPasswordResetAuditDescription("Dr. Reyes", "doctor"),
      "Admin reset password for doctor Dr. Reyes"
    );
    assert.equal(auditDescriptionContainsSecret(description, secret), false);
  });
});

describe("resetSecretaryPasswordRuntime (secretary and doctor targets)", () => {
  it("generates a strong temporary password without logging secrets in the return contract", () => {
    const password = generateTemporaryPassword(16);
    assert.equal(password.length, 16);
    assert.match(password, /[A-Z]/);
    assert.match(password, /[a-z]/);
    assert.match(password, /[0-9]/);
    assert.match(password, /[!@#$%&*?]/);
  });

  it("admin resets secretary password, forces change, and revokes sessions", async () => {
    const { admin, store, revoked, passwordUpdates } = createFakeAdmin({
      users: {
        "users/admin1": ADMIN,
        "users/sec1": { role: "secretary", status: "active", name: "Ana Cruz" },
      },
      authUsers: { sec1: { email: "ana@clinic.test" } },
    });

    const result = await resetSecretaryPassword({ admin, callerUid: "admin1", targetUid: "sec1" });

    assert.equal(result.success, true);
    assert.ok(result.temporaryPassword);
    assert.equal(passwordUpdates.length, 1);
    assert.equal(passwordUpdates[0].uid, "sec1");
    assert.equal(passwordUpdates[0].password, result.temporaryPassword);
    assert.deepEqual(revoked, ["sec1"]);
    assert.equal(store["users/sec1"].mustChangePassword, true);

    assert.equal(result.role, "secretary");
    const auditLine = buildStaffPasswordResetAuditDescription(result.staffName, result.role);
    assert.equal(auditDescriptionContainsSecret(auditLine, result.temporaryPassword), false);
  });

  it("admin resets doctor password the same way (temporary password, forced change)", async () => {
    const { admin, store, revoked, passwordUpdates } = createFakeAdmin({
      users: {
        "users/admin1": ADMIN,
        "users/doc1": { role: "doctor", status: "active", name: "Dr. Reyes" },
      },
      authUsers: { doc1: { email: "doc@clinic.test" } },
    });

    const result = await resetSecretaryPassword({ admin, callerUid: "admin1", targetUid: "doc1" });

    assert.equal(result.role, "doctor");
    assert.equal(result.staffName, "Dr. Reyes");
    assert.equal(passwordUpdates[0].uid, "doc1");
    assert.equal(passwordUpdates[0].password, result.temporaryPassword);
    assert.deepEqual(revoked, ["doc1"]);
    assert.equal(store["users/doc1"].mustChangePassword, true);
  });

  it("rejects parent and admin targets", async () => {
    const { admin, passwordUpdates } = createFakeAdmin({
      users: {
        "users/admin1": ADMIN,
        "users/admin2": ADMIN,
        "users/parent1": { role: "parent", status: "active", email: "p@test.com" },
      },
    });
    for (const targetUid of ["parent1", "admin2"]) {
      await assert.rejects(
        () => resetSecretaryPassword({ admin, callerUid: "admin1", targetUid }),
        (err) => err.status === 403,
        targetUid
      );
    }
    assert.equal(passwordUpdates.length, 0);
  });

  it("rejects doctor, secretary, inactive and deleted admin callers", async () => {
    const { admin, store, passwordUpdates } = createFakeAdmin({
      users: {
        "users/doctor1": { role: "doctor", status: "active" },
        "users/sec1": { role: "secretary", status: "active" },
        "users/sec2": { role: "secretary", status: "active" },
        "users/admin2": { ...ADMIN, status: "inactive" },
        "users/admin3": { ...ADMIN, isDeleted: true },
      },
    });
    for (const callerUid of ["doctor1", "sec1", "admin2", "admin3", "ghost"]) {
      await assert.rejects(
        () => resetSecretaryPassword({ admin, callerUid, targetUid: "sec2" }),
        (err) => err.status === 403,
        callerUid
      );
    }
    assert.equal(passwordUpdates.length, 0);
    assert.equal(store["users/sec2"].mustChangePassword, undefined);
  });
});

describe("updateUserAccountRuntime", () => {
  it("allows an admin to update secretary profile fields", async () => {
    const { admin, store } = createFakeAdmin({
      users: {
        "users/admin1": ADMIN,
        "users/sec1": { role: "secretary", status: "active", name: "Ana", assignedBranch: "Angeles" },
      },
    });

    const result = await updateUserAccount({
      admin,
      callerUid: "admin1",
      targetUid: "sec1",
      updates: { name: "Ana Updated", phone: "+639171234567", role: "admin" },
    });

    assert.equal(result.success, true);
    assert.equal(store["users/sec1"].name, "Ana Updated");
    assert.equal(store["users/sec1"].phone, "+639171234567");
    assert.equal(store["users/sec1"].role, "secretary", "role is never in the allowlist");
  });

  it("returns 403 for parent and admin targets", async () => {
    const { admin } = createFakeAdmin({
      users: {
        "users/admin1": ADMIN,
        "users/admin2": ADMIN,
        "users/parent1": { role: "parent", status: "active", name: "Parent" },
      },
    });
    for (const targetUid of ["parent1", "admin2"]) {
      await assert.rejects(
        () => updateUserAccount({ admin, callerUid: "admin1", targetUid, updates: { name: "Hacked" } }),
        (err) => err.status === 403
      );
    }
  });

  it("rejects doctor and secretary callers", async () => {
    const { admin, store } = createFakeAdmin({
      users: {
        "users/doctor1": { role: "doctor", status: "active" },
        "users/sec1": { role: "secretary", status: "active" },
        "users/sec2": { role: "secretary", status: "active", name: "Other" },
      },
    });
    for (const callerUid of ["doctor1", "sec1"]) {
      await assert.rejects(
        () => updateUserAccount({ admin, callerUid, targetUid: "sec2", updates: { name: "Nope" } }),
        (err) => err.status === 403
      );
    }
    assert.equal(store["users/sec2"].name, "Other");
  });
});

