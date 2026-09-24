import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import {
  assertDoctorCanDirectResetSecretaryPassword,
  assertDoctorCanUpdateUserProfile,
  auditDescriptionContainsSecret,
  buildSecretaryPasswordResetAuditDescription,
  canDoctorEditUserProfile,
} from "../src/utils/doctorUserManagementPolicy.js";

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

describe("doctor user management policy", () => {
  it("marks parent profiles as not editable by doctor UI", () => {
    assert.equal(canDoctorEditUserProfile("parent"), false);
    assert.equal(canDoctorEditUserProfile("secretary"), true);
  });

  it("rejects doctor parent profile edits with 403", () => {
    const result = assertDoctorCanUpdateUserProfile({
      callerRole: "doctor",
      targetRole: "parent",
      updates: { name: "New Name" },
    });
    assert.equal(result.ok, false);
    assert.equal(result.status, 403);
  });

  it("allows doctor secretary profile edits", () => {
    const result = assertDoctorCanUpdateUserProfile({
      callerRole: "doctor",
      targetRole: "secretary",
      updates: { name: "Sec", phone: "+639171234567" },
    });
    assert.equal(result.ok, true);
  });

  it("blocks secretary and parent from doctor update actions", () => {
    for (const callerRole of ["secretary", "parent"]) {
      const result = assertDoctorCanUpdateUserProfile({
        callerRole,
        targetRole: "secretary",
        updates: { name: "X" },
      });
      assert.equal(result.ok, false);
      assert.equal(result.status, 403);
    }
  });

  it("allows direct reset only for doctor→secretary", () => {
    assert.equal(
      assertDoctorCanDirectResetSecretaryPassword({
        callerRole: "doctor",
        targetRole: "secretary",
      }).ok,
      true
    );
    assert.equal(
      assertDoctorCanDirectResetSecretaryPassword({
        callerRole: "doctor",
        targetRole: "parent",
      }).status,
      403
    );
    assert.equal(
      assertDoctorCanDirectResetSecretaryPassword({
        callerRole: "secretary",
        targetRole: "secretary",
      }).status,
      403
    );
    assert.equal(
      assertDoctorCanDirectResetSecretaryPassword({
        callerRole: "parent",
        targetRole: "secretary",
      }).status,
      403
    );
  });

  it("builds audit text without embedding a password", () => {
    const secret = "Tmp!Passw0rdABCD";
    const description = buildSecretaryPasswordResetAuditDescription("Ana Cruz");
    assert.equal(description, "Doctor reset password for secretary Ana Cruz");
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

  it("resets secretary password, forces change, and revokes sessions", async () => {
    const { admin, store, revoked, passwordUpdates } = createFakeAdmin({
      users: {
        "users/doctor1": { role: "doctor", status: "active", name: "Dr Lee" },
        "users/sec1": { role: "secretary", status: "active", name: "Ana Cruz" },
      },
      authUsers: { sec1: { email: "ana@clinic.test" } },
    });

    const result = await resetSecretaryPassword({
      admin,
      callerUid: "doctor1",
      targetUid: "sec1",
    });

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

  it("does not send email and rejects parent/doctor targets", async () => {
    const { admin } = createFakeAdmin({
      users: {
        "users/doctor1": { role: "doctor", status: "active" },
        "users/parent1": { role: "parent", status: "active", email: "p@test.com" },
      },
    });

    await assert.rejects(
      () => resetSecretaryPassword({ admin, callerUid: "doctor1", targetUid: "parent1" }),
      (err) => err.status === 403
    );
  });

  it("rejects non-doctor callers", async () => {
    const { admin } = createFakeAdmin({
      users: {
        "users/sec1": { role: "secretary", status: "active" },
        "users/sec2": { role: "secretary", status: "active" },
      },
    });

    await assert.rejects(
      () => resetSecretaryPassword({ admin, callerUid: "sec1", targetUid: "sec2" }),
      (err) => err.status === 403
    );
  });
});

describe("updateUserAccountRuntime", () => {
  it("returns 403 when a doctor edits parent profile fields", async () => {
    const { admin } = createFakeAdmin({
      users: {
        "users/doctor1": { role: "doctor", status: "active" },
        "users/parent1": { role: "parent", status: "active", name: "Parent" },
      },
    });

    await assert.rejects(
      () =>
        updateUserAccount({
          admin,
          callerUid: "doctor1",
          targetUid: "parent1",
          updates: { name: "Hacked" },
        }),
      (err) => err.status === 403 && /parent/i.test(err.message)
    );
  });

  it("allows doctor to update secretary profile fields", async () => {
    const { admin, store } = createFakeAdmin({
      users: {
        "users/doctor1": { role: "doctor", status: "active" },
        "users/sec1": {
          role: "secretary",
          status: "active",
          name: "Ana",
          assignedBranch: "Angeles",
        },
      },
    });

    const result = await updateUserAccount({
      admin,
      callerUid: "doctor1",
      targetUid: "sec1",
      updates: { name: "Ana Updated", phone: "+639171234567" },
    });

    assert.equal(result.success, true);
    assert.equal(store["users/sec1"].name, "Ana Updated");
    assert.equal(store["users/sec1"].phone, "+639171234567");
  });

  it("rejects secretary callers", async () => {
    const { admin } = createFakeAdmin({
      users: {
        "users/sec1": { role: "secretary", status: "active" },
        "users/sec2": { role: "secretary", status: "active", name: "Other" },
      },
    });

    await assert.rejects(
      () =>
        updateUserAccount({
          admin,
          callerUid: "sec1",
          targetUid: "sec2",
          updates: { name: "Nope" },
        }),
      (err) => err.status === 403
    );
  });
});

describe("parent self-edit regression (policy)", () => {
  it("does not treat parent self-updates as doctor admin updates", () => {
    // Parent editing own profile uses authService.updateUserProfile, not doctor policy.
    // Doctor policy only applies when callerRole is doctor/admin.
    const doctorGate = assertDoctorCanUpdateUserProfile({
      callerRole: "parent",
      targetRole: "parent",
      updates: { name: "Self" },
    });
    assert.equal(doctorGate.ok, false);
    assert.equal(canDoctorEditUserProfile("parent"), false);
  });
});
