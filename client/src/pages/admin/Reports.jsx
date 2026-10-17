import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { AlertCircle, Building2, History } from "lucide-react";
import ClinicOverviewReports from "../../components/admin/ClinicOverviewReports";
import ReportDateRangeFilter from "../../components/reports/ReportDateRangeFilter";
import BranchChipFilter from "../../components/reports/BranchChipFilter";
import SessionHistoryTable from "../../components/reports/SessionHistoryTable";
import SessionReservationsDrawer from "../../components/reports/SessionReservationsDrawer";
import { sessionPanelLabels } from "../../utils/reportSessions";
import { PqSpinner } from "../../components/parent/pqUi";
import EmptyState from "../../components/common/EmptyState";
import { useReportFilters } from "../../hooks/useReportFilters";
import { useReportsData } from "../../hooks/useReportsData";

/** Read-only for the admin: rows open the same reservations panel the doctor uses, with no actions. */
function AdminSessionHistory({ filters }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const sessionId = searchParams.get("session");
  const { loading, error, dataset, unfilteredDataset } = useReportsData({
    branch: filters.branch,
    range: filters.activeRange,
  });
  const selectedSession = (unfilteredDataset || []).find((s) => s.id === sessionId) || null;
  const { title, subtitle } = sessionPanelLabels(selectedSession);

  const setSession = useCallback(
    (id) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (id) next.set("session", id);
          else next.delete("session");
          return next;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );
  const closeSession = useCallback(() => setSession(null), [setSession]);

  if (error) {
    return (
      <div className="pq-glass p-12 text-center">
        <AlertCircle className="w-12 h-12 mx-auto mb-3" style={{ color: "var(--pq-alert)" }} aria-hidden="true" />
        <p className="font-extrabold tracking-tight">Failed to load session history.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="pq-glass p-10">
        <PqSpinner label="Loading session history" />
      </div>
    );
  }

  return (
    <>
      <SessionHistoryTable
        key={`${filters.branch}|${filters.range.from}|${filters.range.to}`}
        sessions={dataset}
        onOpenSession={setSession}
        emptyMessage={
          filters.rangeError
            ? "Fix the date range above to see results."
            : "No completed clinic sessions match the selected filters. Widen the date range or choose All branches."
        }
      />
      <SessionReservationsDrawer
        open={Boolean(sessionId)}
        onClose={closeSession}
        scheduleId={sessionId}
        title={title}
        subtitle={subtitle}
      />
    </>
  );
}

export default function Reports() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") === "sessions" ? "sessions" : "overview";
  const filters = useReportFilters();

  const setTab = (tab) => {
    setSearchParams(tab === "sessions" ? { tab: "sessions" } : {}, { replace: true });
  };

  return (
    <div className="space-y-4 pb-6">
      <div className="pq-tablist" role="tablist" aria-label="Reports views">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "overview"}
          className="pq-tab"
          onClick={() => setTab("overview")}
        >
          <Building2 className="w-4 h-4" aria-hidden="true" />
          Clinic Overview
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "sessions"}
          className="pq-tab"
          onClick={() => setTab("sessions")}
        >
          <History className="w-4 h-4" aria-hidden="true" />
          Session History
        </button>
      </div>

      <ReportDateRangeFilter filters={filters} idPrefix="admin-reports">
        {activeTab === "sessions" ? (
          <BranchChipFilter value={filters.branch} onChange={filters.setBranch} />
        ) : null}
      </ReportDateRangeFilter>

      {activeTab === "sessions" ? (
        <AdminSessionHistory filters={filters} />
      ) : (
        <ClinicOverviewReports range={filters.activeRange} />
      )}
    </div>
  );
}
