import { useState, useEffect } from "react";
import { useSearchParams, useNavigate, useOutletContext } from "react-router-dom";
import { Users, AlertCircle, Activity, CheckCircle, XCircle, Inbox, BarChart3, Building2 } from "lucide-react";
import { useReportsData } from "../../hooks/useReportsData";
import { useReportFilters } from "../../hooks/useReportFilters";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart as RePieChart, Pie, Cell, Legend } from 'recharts';
import { PqSpinner } from "../../components/parent/pqUi";
import { useTourSample } from "../../hooks/useTourPreview";
import { TourSampleDoctorReports } from "../../components/onboarding/DoctorTourSampleViews";
import ClinicOverviewReports from "../../components/admin/ClinicOverviewReports";
import ReservationsByDate from "../../components/doctor/ReservationsByDate";
import SessionReservationsDrawer from "../../components/doctor/SessionReservationsDrawer";
import ReportDateRangeFilter from "../../components/reports/ReportDateRangeFilter";
import BranchChipFilter from "../../components/reports/BranchChipFilter";
import SessionHistoryTable from "../../components/reports/SessionHistoryTable";
import { aggregateSessionMetrics } from "../../utils/reportSessions";
import { goBackOr } from "../../utils/navigationRoots";

const MD_QUERY = "(min-width: 768px)";

const CHART_INK = "#16344a";
const CHART_MUTED = "#5a7a88";
const CHART_LINE = "#2f6fdb";
const CHART_GRID = "rgba(22, 52, 74, 0.1)";

function formatClinicDate(dateStr) {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function reportsFallbackPath(searchParams) {
  return searchParams.get("tab") === "overview"
    ? "/doctor/reports?tab=overview"
    : "/doctor/reports";
}

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia(MD_QUERY).matches : true
  );

  useEffect(() => {
    const media = window.matchMedia(MD_QUERY);
    const onChange = (event) => setIsDesktop(event.matches);
    media.addEventListener("change", onChange);
    setIsDesktop(media.matches);
    return () => media.removeEventListener("change", onChange);
  }, []);

  return isDesktop;
}

function ClinicSessionsReports({ filters }) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { setHeaderOverride } = useOutletContext() || {};
  const isDesktop = useIsDesktop();
  const sessionId = searchParams.get("session");

  const { loading, error, dataset, unfilteredDataset } = useReportsData({
    branch: filters.branch,
    range: filters.activeRange,
  });

  const selectedSession =
    (unfilteredDataset || []).find((s) => s.id === sessionId) ||
    (dataset || []).find((s) => s.id === sessionId) ||
    null;

  const closeSession = () => {
    goBackOr(navigate, reportsFallbackPath(searchParams));
  };

  const openSession = (id) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("session", id);
      return next;
    });
  };

  const sessionTitle = selectedSession?.clinicDate
    ? `Reservations on ${formatClinicDate(selectedSession.clinicDate)}`
    : "Reservations";

  const sessionSubtitle = selectedSession
    ? [selectedSession.branch, selectedSession.openingTime && selectedSession.closingTime
        ? `${selectedSession.openingTime} - ${selectedSession.closingTime}`
        : null]
        .filter(Boolean)
        .join(" · ")
    : null;

  useEffect(() => {
    if (typeof setHeaderOverride !== "function") return undefined;

    if (!sessionId || isDesktop) {
      setHeaderOverride(null);
      return undefined;
    }

    setHeaderOverride({
      title: sessionTitle,
      subtitle: sessionSubtitle,
      showBack: true,
      onBack: () => goBackOr(navigate, reportsFallbackPath(searchParams)),
    });

    return undefined;
  }, [
    sessionId,
    isDesktop,
    sessionTitle,
    sessionSubtitle,
    setHeaderOverride,
    navigate,
    searchParams,
  ]);

  useEffect(() => {
    if (typeof setHeaderOverride !== "function") return undefined;
    return () => setHeaderOverride(null);
  }, [setHeaderOverride]);

  if (sessionId && !isDesktop) {
    return (
      <div className="flex flex-col h-[calc(100dvh-8rem)] max-h-[calc(100dvh-8rem)] -mx-1">
        <div className="pq-glass flex flex-col flex-1 min-h-0 overflow-hidden">
          <ReservationsByDate scheduleId={sessionId} />
        </div>
      </div>
    );
  }

  if (error) return <div className="pq-error-text text-center py-10 text-base">Failed to load reports data.</div>;

  const aggregated = aggregateSessionMetrics(dataset);
  const completionRate = aggregated.completionRate;

  const trendDataMap = dataset.reduce((acc, curr) => {
    const date = curr.clinicDate;
    if (!acc[date]) {
      acc[date] = { date, reservations: 0 };
    }
    acc[date].reservations += curr.metrics.totalReservations;
    return acc;
  }, {});

  const trendData = Object.values(trendDataMap).sort((a, b) => new Date(a.date) - new Date(b.date));

  const outcomeData = [
    { name: 'Checked Up', value: aggregated.checkedUp, color: '#0f7a5a' },
    { name: 'Cancelled', value: aggregated.cancelled, color: '#b4232c' },
    { name: 'Forfeited', value: aggregated.forfeited, color: '#9a5b12' },
  ].filter(item => item.value > 0);

  const tooltipStyle = {
    borderRadius: "0.95rem",
    border: "1px solid rgba(22, 52, 74, 0.1)",
    background: "color-mix(in srgb, #ffffff 92%, #e4f3f4)",
    color: CHART_INK,
    boxShadow: "0 12px 28px -14px rgba(22, 52, 74, 0.28)",
  };

  return (
    <div className="space-y-6 pb-6 relative">
      {loading ? (
        <div className="pq-glass p-10">
          <PqSpinner label="Loading reports" />
        </div>
      ) : dataset.length === 0 ? (
        <div className="pq-glass p-12 text-center">
          <div className="mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4" style={{ background: "color-mix(in srgb, #ffffff 55%, transparent)", color: "var(--pq-ink-faint)" }}>
            <Inbox className="w-8 h-8" aria-hidden="true" />
          </div>
          <h3 className="text-lg font-extrabold tracking-tight mb-1">
            {unfilteredDataset && unfilteredDataset.length === 0
              ? "No completed clinic sessions yet"
              : "No reports available for these filters"}
          </h3>
          <p className="pq-muted text-sm max-w-sm mx-auto">
            {unfilteredDataset && unfilteredDataset.length === 0
              ? "Complete a clinic session to start viewing analytics and historical reports."
              : filters.rangeError
                ? "Fix the date range above to see results."
                : "Try adjusting your branch or date range to see more results."}
          </p>
        </div>
      ) : (
        <>
          <div className="pq-glass p-5">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              <div className="pq-stat pq-stat-info col-span-2 md:col-span-1">
                <span className="pq-stat-label flex items-center gap-1"><Users className="w-3.5 h-3.5" aria-hidden="true" /> Total</span>
                <span className="pq-stat-value">{aggregated.totalReservations}</span>
              </div>
              <div className="pq-stat pq-stat-live">
                <span className="pq-stat-label flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5" aria-hidden="true" /> Checked Up</span>
                <span className="pq-stat-value">{aggregated.checkedUp}</span>
              </div>
              <div className="pq-stat" style={{ background: "var(--pq-alert-wash)", borderColor: "color-mix(in srgb, var(--pq-alert) 22%, white)" }}>
                <span className="pq-stat-label flex items-center gap-1" style={{ color: "var(--pq-alert)" }}><XCircle className="w-3.5 h-3.5" aria-hidden="true" /> Cancelled</span>
                <span className="pq-stat-value" style={{ color: "var(--pq-alert)" }}>{aggregated.cancelled}</span>
              </div>
              <div className="pq-stat pq-stat-wait">
                <span className="pq-stat-label flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" aria-hidden="true" /> Forfeited</span>
                <span className="pq-stat-value">{aggregated.forfeited}</span>
              </div>
              <div className="pq-stat col-span-1 md:col-span-2 lg:col-span-1">
                <span className="pq-stat-label flex items-center gap-1"><Activity className="w-3.5 h-3.5" aria-hidden="true" /> Completion</span>
                <span className="pq-stat-value">{completionRate}%</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="pq-glass p-6">
              <h3 className="text-lg font-extrabold tracking-tight mb-6">Reservation Trend</h3>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={CHART_GRID} />
                    <XAxis
                      dataKey="date"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: CHART_MUTED, fontSize: 12, fontFamily: "Lexend, Segoe UI, sans-serif" }}
                      dy={10}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: CHART_MUTED, fontSize: 12, fontFamily: "Lexend, Segoe UI, sans-serif" }}
                      allowDecimals={false}
                    />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      labelStyle={{ fontWeight: 800, color: CHART_INK, marginBottom: 4 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="reservations"
                      name="Reservations"
                      stroke={CHART_LINE}
                      strokeWidth={3}
                      dot={{ r: 4, strokeWidth: 2, fill: "#fff", stroke: CHART_LINE }}
                      activeDot={{ r: 6, strokeWidth: 0, fill: CHART_LINE }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="pq-glass p-6">
              <h3 className="text-lg font-extrabold tracking-tight mb-6">Outcome Distribution</h3>
              <div className="h-72 w-full">
                {outcomeData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <RePieChart>
                      <Pie
                        data={outcomeData}
                        cx="50%"
                        cy="50%"
                        innerRadius={70}
                        outerRadius={95}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {outcomeData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={tooltipStyle}
                      />
                      <Legend
                        verticalAlign="bottom"
                        height={36}
                        iconType="circle"
                      />
                    </RePieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full pq-faint">
                    No outcome data to display
                  </div>
                )}
              </div>
            </div>
          </div>

          <SessionHistoryTable
            key={`${filters.branch}|${filters.range.from}|${filters.range.to}`}
            sessions={dataset}
            onOpenSession={openSession}
          />
        </>
      )}

      {isDesktop && (
        <SessionReservationsDrawer
          open={Boolean(sessionId)}
          onClose={closeSession}
          scheduleId={sessionId}
          title={sessionTitle}
          subtitle={sessionSubtitle}
        />
      )}
    </div>
  );
}

export default function Reports() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") === "overview" ? "overview" : "sessions";
  const sessionId = searchParams.get("session");
  const isDesktop = useIsDesktop();
  const filters = useReportFilters();

  const setTab = (tab) => {
    if (tab === "overview") {
      setSearchParams({ tab: "overview" }, { replace: true });
    } else {
      setSearchParams({}, { replace: true });
    }
  };

  const showReportsSample = useTourSample(["doctor-reports-filters", "doctor-reports-history"]);
  const showMobileSession = Boolean(sessionId) && !isDesktop && activeTab === "sessions";

  if (showReportsSample) {
    return <TourSampleDoctorReports />;
  }

  if (showMobileSession) {
    return <ClinicSessionsReports filters={filters} />;
  }

  return (
    <div className="space-y-4">
      <div className="pq-tablist" role="tablist" aria-label="Reports views">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "sessions"}
          className="pq-tab"
          onClick={() => setTab("sessions")}
        >
          <BarChart3 className="w-4 h-4" aria-hidden="true" />
          Clinic Sessions
        </button>
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
      </div>

      <ReportDateRangeFilter filters={filters} idPrefix="doctor-reports">
        {activeTab === "sessions" ? (
          <BranchChipFilter value={filters.branch} onChange={filters.setBranch} />
        ) : null}
      </ReportDateRangeFilter>

      {activeTab === "overview" ? (
        <ClinicOverviewReports range={filters.activeRange} />
      ) : (
        <ClinicSessionsReports filters={filters} />
      )}
    </div>
  );
}
