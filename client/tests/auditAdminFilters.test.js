import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  ADMIN_AUDIT_EXCLUDED_ACTIONS,
  AUDIT_ACTION_FILTER_OPTIONS,
  AUDIT_ACTION_GROUP_DEFS,
  filterAdminAuditLogs,
  getAuditActionGroup,
  isAdminVisibleAuditLog,
  matchesAuditActionFilter,
  matchesAuditCategoryFilter,
  matchesAuditRoleFilter,
  normalizeAuditAction,
} from "../src/utils/auditLogFilters.js";

const MIXED_LOGS = [
  { id: "a", action: "USER_CREATED", category: "user_management", actorRole: "admin", description: "Created nurse", actorName: "Ada" },
  { id: "b", action: "PATIENT_PENALIZED", category: "queue_intervention", actorRole: "secretary", description: "Penalized Queue #1", actorName: "Sam" },
  { id: "c", action: "PATIENT_FORFEITED", category: "queue_intervention", actorRole: "secretary", description: "Forfeited Queue #2", actorName: "Sam" },
  { id: "d", action: "WALK_IN_CREATED", category: "queue_intervention", actorRole: "secretary", description: "Created walk-in", actorName: "Sam" },
  { id: "e", action: "patient_penalized", category: "queue_intervention", actorRole: "secretary", description: "legacy case penalty", actorName: "Sam" },
  { id: "f", action: "MANUAL_CODE_FAILED", category: "queue_operations", actorRole: "secretary", description: "Failed code", actorName: "Sam" },
  { id: "g", action: "QUEUE_STARTED", category: "queue_operations", actorRole: "doctor", description: "Started queue", actorName: "Lee" },
  { id: "h", action: "SCHEDULE_PUBLISHED", category: "schedule_management", actorRole: "doctor", description: "Published day", actorName: "Lee" },
  { id: "i", action: "SMS_SERVICE_STATUS_CHANGED", category: "system_management", actorRole: "system", description: "SMS down", actorName: "System" },
  { id: "j", action: "SOME_FUTURE_ACTION", category: "system_management", actorRole: "admin", description: "Unknown event", actorName: "Ada" },
  { id: "k", action: "BRANCH_DELETED", category: "branch_management", actorRole: "admin", description: "Removed west", actorName: "Ada" },
];

function applyAdminViewFilters(logs, { category = "all", role = "all", action = "all", search = "" } = {}) {
  const term = search.toLowerCase();
  return filterAdminAuditLogs(logs).filter((log) => {
    const matchesSearch =
      !term ||
      (log.actorName && log.actorName.toLowerCase().includes(term)) ||
      (log.description && log.description.toLowerCase().includes(term));
    return (
      matchesSearch &&
      matchesAuditCategoryFilter(log, category) &&
      matchesAuditRoleFilter(log, role) &&
      matchesAuditActionFilter(log, action)
    );
  });
}

describe("admin audit exclusion list", () => {
  it("excludes penalize, forfeit, and walk-in (including legacy case)", () => {
    assert.deepEqual(
      [...ADMIN_AUDIT_EXCLUDED_ACTIONS].sort(),
      ["PATIENT_FORFEITED", "PATIENT_PENALIZED", "WALK_IN_CREATED"]
    );

    for (const action of ["PATIENT_PENALIZED", "PATIENT_FORFEITED", "WALK_IN_CREATED", "patient_penalized"]) {
      assert.equal(isAdminVisibleAuditLog({ action }), false, action);
    }

    const visible = filterAdminAuditLogs(MIXED_LOGS);
    assert.deepEqual(
      visible.map((l) => l.id),
      ["a", "f", "g", "h", "i", "j", "k"]
    );
    assert.equal(visible.some((l) => /penaliz|forfeit|walk-?in/i.test(l.description)), false);
  });

  it("keeps excluded actions out of counts when combined with other filters", () => {
    const all = applyAdminViewFilters(MIXED_LOGS);
    assert.equal(all.length, 7);

    const bySearch = applyAdminViewFilters(MIXED_LOGS, { search: "penalized" });
    assert.deepEqual(bySearch.map((l) => l.id), []);

    const byCategory = applyAdminViewFilters(MIXED_LOGS, { category: "queue_intervention" });
    assert.deepEqual(byCategory.map((l) => l.id), []);
  });
});

describe("audit action groups", () => {
  it("exposes grouped filter options with All Actions default", () => {
    assert.equal(AUDIT_ACTION_FILTER_OPTIONS[0].value, "all");
    assert.equal(AUDIT_ACTION_FILTER_OPTIONS[0].label, "All Actions");
    assert.deepEqual(
      AUDIT_ACTION_FILTER_OPTIONS.slice(1).map((o) => o.value),
      AUDIT_ACTION_GROUP_DEFS.map((g) => g.key)
    );
    for (const opt of AUDIT_ACTION_FILTER_OPTIONS.slice(1)) {
      assert.match(opt.label, /^[A-Z][a-z]+$/);
    }
  });

  it("maps each known raw action into its group", () => {
    assert.equal(getAuditActionGroup("USER_CREATED"), "create");
    assert.equal(getAuditActionGroup("BRANCH_CREATED"), "create");
    assert.equal(getAuditActionGroup("QUEUE_RULES_UPDATED"), "update");
    assert.equal(getAuditActionGroup("USER_DELETED"), "delete");
    assert.equal(getAuditActionGroup("SCHEDULE_RANGE_PUBLISHED"), "publish");
    assert.equal(getAuditActionGroup("QUEUE_PAUSED"), "queue");
    assert.equal(getAuditActionGroup("MANUAL_CODE_LOCKED"), "security");
    assert.equal(getAuditActionGroup("SMS_SERVICE_STATUS_CHANGED"), "system");
  });

  it("normalizes case/spacing and puts unmapped actions under Other", () => {
    assert.equal(normalizeAuditAction(" manual-code failed "), "MANUAL_CODE_FAILED");
    assert.equal(getAuditActionGroup("manual code failed"), "security");
    assert.equal(getAuditActionGroup("SOME_FUTURE_ACTION"), "other");
    assert.equal(getAuditActionGroup("PATIENT_PENALIZED"), null);
  });

  it("filters by group for all matching raw actions", () => {
    const visible = filterAdminAuditLogs(MIXED_LOGS);
    assert.deepEqual(
      visible.filter((l) => matchesAuditActionFilter(l, "create")).map((l) => l.id),
      ["a"]
    );
    assert.deepEqual(
      visible.filter((l) => matchesAuditActionFilter(l, "queue")).map((l) => l.id),
      ["g"]
    );
    assert.deepEqual(
      visible.filter((l) => matchesAuditActionFilter(l, "security")).map((l) => l.id),
      ["f"]
    );
    assert.deepEqual(
      visible.filter((l) => matchesAuditActionFilter(l, "publish")).map((l) => l.id),
      ["h"]
    );
    assert.deepEqual(
      visible.filter((l) => matchesAuditActionFilter(l, "system")).map((l) => l.id),
      ["i"]
    );
    assert.deepEqual(
      visible.filter((l) => matchesAuditActionFilter(l, "other")).map((l) => l.id),
      ["j"]
    );
    assert.deepEqual(
      visible.filter((l) => matchesAuditActionFilter(l, "delete")).map((l) => l.id),
      ["k"]
    );
  });

  it("combines action group with category, role, and search", () => {
    const rows = applyAdminViewFilters(MIXED_LOGS, {
      action: "system",
      category: "system_management",
      role: "system",
      search: "sms",
    });
    assert.deepEqual(rows.map((l) => l.id), ["i"]);

    const createAdmin = applyAdminViewFilters(MIXED_LOGS, {
      action: "create",
      role: "admin",
      category: "user_management",
    });
    assert.deepEqual(createAdmin.map((l) => l.id), ["a"]);
  });
});
