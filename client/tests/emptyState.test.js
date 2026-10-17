import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

describe("EmptyState shared component", () => {
  it("exists and is used on admin empty surfaces", () => {
    const componentPath = path.join(root, "src/components/common/EmptyState.jsx");
    assert.ok(fs.existsSync(componentPath));
    const source = fs.readFileSync(componentPath, "utf8");
    assert.match(source, /nextStep/);
    assert.match(source, /actionLabel/);

    const consumers = [
      "src/pages/admin/Dashboard.jsx",
      "src/pages/admin/UserManagement.jsx",
      "src/pages/admin/BranchManagement.jsx",
      "src/pages/admin/AuditLogs.jsx",
      "src/pages/admin/SystemHealth.jsx",
      "src/components/admin/ClinicOverviewReports.jsx",
      "src/components/reports/SessionHistoryTable.jsx",
    ];
    for (const rel of consumers) {
      const text = fs.readFileSync(path.join(root, rel), "utf8");
      assert.match(text, /EmptyState/, `${rel} should import EmptyState`);
    }
  });
});
