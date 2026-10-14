import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import {
  assertAdminCanDirectResetSecretaryPassword,
  assertAdminCanUpdateUserProfile,
  auditDescriptionContainsSecret,
  buildSecretaryPasswordResetAuditDescription,
  canAdminEditUserProfile,
} from "../src/utils/adminUserManagementPolicy.js";

const require = createRequire(import.meta.url);
const {
  generateTemporaryPassword,
  resetSecretaryPassword,
} = require("../functions/resetSecretaryPasswordRuntime.js");
const { updateUserAccount } = require("../functions/updateUserAccountRuntime.js");

function createFakeAdmin({ users = {}, authUsers = {} } = {}) {
  const store = { ...users };
  const authState = { ...authUsers };
  const revoked = [];
  const passwordUpdates = [];

  const admin = {
    database() {
      return {
        ref(path) {
          return {
            async once() {
              const val = store[path];
              return {
                exists: () => val !== undefined && val !== null,
                val: () => val ?? null,
              };
            },
            async update(payload) {
              const current = store[path] || {};
              store[path] = { ...current, ...payload };
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

  it("allows direct reset only for admin→secretary", () => {
    const check = (callerRole, targetRole) =>
      assertAdminCanDirectResetSecretaryPassword({ callerRole, targetRole });
    assert.equal(check("admin", "secretary").ok, true);
    assert.equal(check("admin", "parent").status, 403);
    assert.equal(check("doctor", "secretary").status, 403);
    assert.equal(check("secretary", "secretary").status, 403);
    assert.equal(check("parent", "secretary").status, 403);
  });

  it("builds audit text without embedding a password", () => {
    const secret = "Tmp!Passw0rdABCD";
    const description = buildSecretaryPasswordResetAuditDescription("Ana Cruz");
    assert.equal(description, "Admin reset password for secretary Ana Cruz");
    assert.equal(auditDescriptionContainsSecret(description, secret), false);
  });
});

describe("resetSecretaryPasswordRuntime", () => {
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

    const auditLine = buildSecretaryPasswordResetAuditDescription(result.secretaryName);
    assert.equal(auditDescriptionContainsSecret(auditLine, result.temporaryPassword), false);
  });

  it("rejects parent targets", async () => {
    const { admin } = createFakeAdmin({
      users: {
        "users/admin1": ADMIN,
        "users/parent1": { role: "parent", status: "active", email: "p@test.com" },
      },
    });
    await assert.rejects(
      () => resetSecretaryPassword({ admin, callerUid: "admin1", targetUid: "parent1" }),
      (err) => err.status === 403
    );
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

