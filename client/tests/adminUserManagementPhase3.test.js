import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  USER_ROLE_FILTER_OPTIONS,
  isListedUser,
  matchesUserRoleFilter,
  parseUserRoleParam,
} from "../src/utils/userListFilters.js";
import { getUserRowActions } from "../src/utils/adminUserManagementPolicy.js";

const USERS = [
  { id: "a1", role: "admin", status: "active" },
  { id: "d1", role: "doctor", status: "active" },
  { id: "s1", role: "secretary", status: "active" },
  { id: "p1", role: "parent", status: "active" },
];

describe("Admin → Users role filter", () => {
  it("offers an Admin option alongside the existing roles", () => {
    assert.deepEqual(
      USER_ROLE_FILTER_OPTIONS.map((o) => o.value),
      ["all", "staff", "admin", "doctor", "secretary", "parent"]
    );
    assert.ok(USER_ROLE_FILTER_OPTIONS.some((o) => o.value === "admin" && o.label === "Admin"));
  });

  it("matches admins exactly and keeps Staff to doctor and secretary", () => {
    const ids = (filter) => USERS.filter((u) => matchesUserRoleFilter(u, filter)).map((u) => u.id);
    assert.deepEqual(ids("admin"), ["a1"]);
    assert.deepEqual(ids("staff"), ["d1", "s1"]);
    assert.deepEqual(ids("all"), ["a1", "d1", "s1", "p1"]);
    assert.deepEqual(ids("parent"), ["p1"]);
  });

  it("reads ?role=admin from the URL and ignores unknown values", () => {
    assert.equal(parseUserRoleParam("admin"), "admin");
    assert.equal(parseUserRoleParam("staff"), "staff");
    assert.equal(parseUserRoleParam("all"), null);
    assert.equal(parseUserRoleParam("superuser"), null);
    assert.equal(parseUserRoleParam(null), null);
  });

  it("lists admin accounts but not soft-deleted users or the legacy admin node", () => {
    assert.equal(isListedUser({ id: "a1", role: "admin" }), true);
    assert.equal(isListedUser({ id: "x", role: "secretary", isDeleted: true }), false);
    assert.equal(isListedUser({ id: "admin" }), false);
  });
});

describe("Admin → Users row actions match what the server allows", () => {
  const actions = (target, currentUid = "a1") => getUserRowActions({ target, currentUid });
  const NONE = { canEdit: false, canResetPassword: false, canToggleStatus: false, canDelete: false };

  it("offers nothing on the signed-in admin's own row", () => {
    assert.deepEqual(actions({ id: "a1", role: "admin", status: "active" }), NONE);
  });

  it("offers nothing on other admin accounts", () => {
    assert.deepEqual(actions({ id: "a2", role: "admin", status: "active" }), NONE);
  });

  it("offers nothing on the caller's own row even if the role field is missing", () => {
    assert.deepEqual(actions({ id: "a1" }), NONE);
  });

  it("lets the admin edit, reset, deactivate, and delete a secretary", () => {
    assert.deepEqual(actions({ id: "s1", role: "secretary" }), {
      canEdit: true,
      canResetPassword: true,
      canToggleStatus: true,
      canDelete: true,
    });
  });

  it("lets the admin manage and delete a doctor", () => {
    assert.deepEqual(actions({ id: "d1", role: "doctor" }), {
      canEdit: true,
      canResetPassword: true,
      canToggleStatus: true,
      canDelete: true,
    });
  });

  it("parents are view-only but can be reset by email, deactivated, or deleted", () => {
    assert.deepEqual(actions({ id: "p1", role: "parent" }), {
      canEdit: false,
      canResetPassword: true,
      canToggleStatus: true,
      canDelete: true,
    });
  });
});
