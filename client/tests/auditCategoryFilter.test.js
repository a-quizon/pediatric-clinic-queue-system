import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  AUDIT_CATEGORIES,
  AUDIT_CATEGORY_DEFS,
  AUDIT_CATEGORY_LABELS,
} from "../src/utils/auditCategories.js";
import {
  AUDIT_CATEGORY_FILTER_OPTIONS,
  formatAuditCategoryLabel,
  matchesAuditActionFilter,
  matchesAuditCategoryFilter,
  matchesAuditRoleFilter,
  normalizeAuditCategory,
} from "../src/utils/auditLogFilters.js";

const SAMPLE_LOGS = [
  { id: 1, category: "user_management", actorRole: "admin", action: "USER_CREATED", description: "Created nurse account", actorName: "Ada Admin" },
  { id: 2, category: "branch_management", actorRole: "admin", action: "BRANCH_CREATED", description: "Opened east branch", actorName: "Ada Admin" },
  { id: 3, category: "schedule_management", actorRole: "doctor", action: "SCHEDULE_PUBLISHED", description: "Published Monday", actorName: "Dr. Lee" },
  { id: 4, category: "queue_operations", actorRole: "doctor", action: "QUEUE_STARTED", description: "Started morning queue", actorName: "Dr. Lee" },
  { id: 5, category: "queue_intervention", actorRole: "secretary", action: "WALK_IN_CREATED", description: "Walk-in for Ana", actorName: "Sec Sam" },
  { id: 6, category: "system_management", actorRole: "admin", action: "QUEUE_RULES_UPDATED", description: "Updated grace period", actorName: "Ada Admin" },
  { id: 7, category: "SYSTEM_MANAGEMENT", actorRole: "system", action: "SMS_SERVICE_STATUS_CHANGED", description: "SMS service is Down", actorName: "System" },
];

function applyFilters(logs, { category = "all", role = "all", action = "all", search = "" } = {}) {
  const term = search.toLowerCase();
  return logs.filter((log) => {
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

describe("audit category source of truth", () => {
  it("exposes stable keys and title-case labels for every category", () => {
    assert.deepEqual(
      AUDIT_CATEGORY_DEFS.map((d) => d.key),
      [
        "user_management",
        "branch_management",
        "schedule_management",
        "queue_operations",
        "queue_intervention",
        "system_management",
      ]
    );
    for (const { key, label } of AUDIT_CATEGORY_DEFS) {
      assert.equal(AUDIT_CATEGORIES[key.toUpperCase()], key);
      assert.equal(AUDIT_CATEGORY_LABELS[key], label);
      assert.match(label, /^[A-Z][a-z]+( [A-Z][a-z]+)*$/);
    }
  });

  it("builds dropdown options from the same defs", () => {
    assert.deepEqual(
      AUDIT_CATEGORY_FILTER_OPTIONS,
      AUDIT_CATEGORY_DEFS.map(({ key, label }) => ({ value: key, label }))
    );
  });
});

describe("normalizeAuditCategory", () => {
  it("lowercases and trims stored values", () => {
    assert.equal(normalizeAuditCategory("SYSTEM_MANAGEMENT"), "system_management");
    assert.equal(normalizeAuditCategory("  system_management  "), "system_management");
    assert.equal(normalizeAuditCategory(""), "");
    assert.equal(normalizeAuditCategory(null), "");
  });
});

describe("matchesAuditCategoryFilter", () => {
  it("returns every entry for all / empty filter", () => {
    assert.equal(SAMPLE_LOGS.filter((l) => matchesAuditCategoryFilter(l, "all")).length, SAMPLE_LOGS.length);
    assert.equal(SAMPLE_LOGS.filter((l) => matchesAuditCategoryFilter(l, "")).length, SAMPLE_LOGS.length);
  });

  it("filters each canonical category to only matching entries", () => {
    for (const { key } of AUDIT_CATEGORY_DEFS) {
      const ids = SAMPLE_LOGS.filter((l) => matchesAuditCategoryFilter(l, key)).map((l) => l.id);
      const expected = SAMPLE_LOGS
        .filter((l) => normalizeAuditCategory(l.category) === key)
        .map((l) => l.id);
      assert.deepEqual(ids, expected, `category ${key}`);
    }
  });

  it("matches System Management for both new and legacy stored formats", () => {
    const ids = SAMPLE_LOGS
      .filter((l) => matchesAuditCategoryFilter(l, AUDIT_CATEGORIES.SYSTEM_MANAGEMENT))
      .map((l) => l.id);
    assert.deepEqual(ids, [6, 7]);
  });
});

describe("formatAuditCategoryLabel", () => {
  it("shows title-case labels for canonical and legacy keys", () => {
    assert.equal(formatAuditCategoryLabel("system_management"), "System Management");
    assert.equal(formatAuditCategoryLabel("SYSTEM_MANAGEMENT"), "System Management");
    for (const { key, label } of AUDIT_CATEGORY_DEFS) {
      assert.equal(formatAuditCategoryLabel(key), label);
    }
  });

  it("falls back for unknown categories and empty values", () => {
    assert.equal(formatAuditCategoryLabel(""), "System");
    assert.equal(formatAuditCategoryLabel(null), "System");
    assert.equal(formatAuditCategoryLabel("custom_event_type"), "Custom Event Type");
  });
});

describe("category filter with other filters", () => {
  it("combines category with role, action, and search", () => {
    const systemOnly = applyFilters(SAMPLE_LOGS, {
      category: "system_management",
      role: "system",
      search: "sms",
    });
    assert.deepEqual(systemOnly.map((l) => l.id), [7]);

    const adminRules = applyFilters(SAMPLE_LOGS, {
      category: "system_management",
      role: "admin",
      action: "QUEUE_RULES_UPDATED",
    });
    assert.deepEqual(adminRules.map((l) => l.id), [6]);

    const walkIn = applyFilters(SAMPLE_LOGS, {
      category: "queue_intervention",
      role: "secretary",
      search: "ana",
    });
    assert.deepEqual(walkIn.map((l) => l.id), [5]);
  });
});
