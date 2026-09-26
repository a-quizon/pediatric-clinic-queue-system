import React, { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Users, AlertCircle, Activity, CheckCircle, XCircle, MapPin, Inbox, ChevronLeft, ChevronRight, RefreshCcw, BarChart3, Building2 } from "lucide-react";
import { useReportsData } from "../../hooks/useReportsData";
import { getBranchConfigurations } from "../../services/branchConfigurationService";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart as RePieChart, Pie, Cell, Legend } from 'recharts';
import { PqSpinner } from "../../components/parent/pqUi";
import { useTourSample } from "../../hooks/useTourPreview";
import { TourSampleDoctorReports } from "../../components/onboarding/DoctorTourSampleViews";
import ClinicOverviewReports from "../../components/admin/ClinicOverviewReports";
import ReservationsByDate from "../../components/doctor/ReservationsByDate";
import SessionReservationsDrawer from "../../components/doctor/SessionReservationsDrawer";
import { goBackOr } from "../../utils/navigationRoots";

const DATE_RANGES = ["Today", "This Week", "This Month", "This Year"];
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

function ClinicSessionsReports() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const isDesktop = useIsDesktop();
  const sessionId = searchParams.get("session");

  const { loading, error, dataset, unfilteredDataset, filters } = useReportsData();
  const { branch, setBranch, dateRange, setDateRange } = filters;
  const [branches, setBranches] = useState([]);

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    getBranchConfigurations().then(setBranches);
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [dataset]);

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

  if (sessionId && !isDesktop) {
    return (
      <div className="flex flex-col min-h-[calc(100dvh-8rem)] -mx-1">
        <div
          className="pq-glass flex flex-col flex-1 min-h-0 overflow-hidden"
        >
          <div
            className="p-4 flex items-center gap-3 shrink-0"
            style={{ borderBottom: "1px solid var(--pq-glass-line)" }}
          >
            <button
              type="button"
              className="pq-icon-btn shrink-0"
              aria-label="Back to Session History"
              onClick={closeSession}
            >
              <ChevronLeft className="w-5 h-5" aria-hidden="true" />
            </button>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-extrabold tracking-tight leading-snug truncate">
                {sessionTitle}
              </h2>
              {sessionSubtitle ? (
                <p className="text-xs pq-muted font-medium mt-0.5 truncate">
                  {sessionSubtitle}
                </p>
              ) : null}
            </div>
          </div>
          <ReservationsByDate scheduleId={sessionId} />
        </div>
      </div>
    );
  }

  if (error) return <div className="pq-error-text text-center py-10 text-base">Failed to load reports data.</div>;

  const aggregated = dataset.reduce((acc, curr) => {
    acc.totalReservations += curr.metrics.totalReservations;
    acc.checkedUp += curr.metrics.checkedUp;
    acc.cancelled += curr.metrics.cancelled;
    acc.forfeited += curr.metrics.forfeited;
    return acc;
  }, {
    totalReservations: 0,
    checkedUp: 0,
    cancelled: 0,
    forfeited: 0,
  });

  const completionRate = aggregated.totalReservations > 0
    ? ((aggregated.checkedUp / aggregated.totalReservations) * 100).toFixed(0)
    : 0;

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

  const sortedDataset = [...dataset].sort((a, b) => {
    const dateA = new Date(a.clinicDate).getTime();
    const dateB = new Date(b.clinicDate).getTime();
    if (dateA !== dateB) return dateB - dateA;
    return (a.openingTime || '').localeCompare(b.openingTime || '');
  });

  const totalPages = Math.ceil(sortedDataset.length / itemsPerPage);
  const paginatedDataset = sortedDataset.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleResetFilters = () => {
    setBranch("All Branches");
    setDateRange("This Year");
  };

  const isFiltered = branch !== "All Branches" || dateRange !== "This Year";

  const tooltipStyle = {
    borderRadius: "0.95rem",
    border: "1px solid rgba(22, 52, 74, 0.1)",
    background: "color-mix(in srgb, #ffffff 92%, #e4f3f4)",
    color: CHART_INK,
    boxShadow: "0 12px 28px -14px rgba(22, 52, 74, 0.28)",
  };

  return (
    <div className="space-y-6 pb-6 relative">
      <div className="pq-filter-bar p-4 sm:p-5">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
          <div className="flex flex-col min-w-0">
            <span className="pq-label mb-1">Showing</span>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-extrabold tracking-tight">{branch}</span>
              <span className="pq-faint" aria-hidden="true">•</span>
              <span className="font-extrabold tracking-tight">{dateRange}</span>
              {isFiltered && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="pq-btn-ghost min-h-[44px] text-sm"
                  aria-label="Reset filters"
                >
                  <RefreshCcw className="w-4 h-4" aria-hidden="true" /> Reset
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
            <div className="relative min-w-[180px] flex-1 lg:flex-none">
              <div className="pq-field-icon">
                <MapPin className="w-4 h-4" aria-hidden="true" />
              </div>
              <select
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                className="pq-input pl-10 appearance-none cursor-pointer"
                aria-label="Filter by Branch"
              >
                <option value="All Branches">All Branches</option>
                {branches.map(b => (
                  <option key={b.id} value={b.name}>{b.name}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 sm:pb-0" role="group" aria-label="Filter by Date Range">
              {DATE_RANGES.map((range) => (
                <button
                  key={range}
                  type="button"
                  onClick={() => setDateRange(range)}
                  className={dateRange === range ? "pq-btn-primary flex-shrink-0" : "pq-btn-secondary flex-shrink-0"}
                  aria-pressed={dateRange === range}
                >
                  {range}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

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

          <div className="pq-glass overflow-hidden">
            <div className="p-6 flex justify-between items-center" style={{ borderBottom: "1px solid var(--pq-glass-line)" }}>
              <h3 className="text-lg font-extrabold tracking-tight">Session History</h3>
            </div>
            {paginatedDataset.length === 0 ? (
              <div className="p-8 text-center pq-muted text-sm">
                No completed clinic sessions match the selected filters.
              </div>
            ) : (
              <>
                <div className="hidden md:block overflow-x-auto">
                  <table className="pq-table">
                    <thead>
                      <tr>
                        <th>Clinic Date</th>
                        <th>Branch</th>
                        <th className="text-center">Total</th>
                        <th className="text-center">Checked Up</th>
                        <th className="text-center">Cancelled</th>
                        <th className="text-center">Forfeited</th>
                        <th className="text-center">Completion</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedDataset.map((session) => (
                        <tr
                          key={session.id}
                          role="button"
                          tabIndex={0}
                          className="pq-table-row-action"
                          aria-label={`View reservations on ${formatClinicDate(session.clinicDate)}`}
                          onClick={() => openSession(session.id)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              openSession(session.id);
                            }
                          }}
                        >
                          <td className="whitespace-nowrap">
                            {formatClinicDate(session.clinicDate)}
                            <div className="text-xs pq-muted font-medium mt-0.5">
                              {session.openingTime} - {session.closingTime}
                            </div>
                          </td>
                          <td className="whitespace-nowrap pq-muted">{session.branch}</td>
                          <td className="text-center">{session.metrics.totalReservations}</td>
                          <td className="text-center" style={{ color: "var(--pq-live)" }}>{session.metrics.checkedUp}</td>
                          <td className="text-center" style={{ color: "var(--pq-alert)" }}>{session.metrics.cancelled}</td>
                          <td className="text-center" style={{ color: "var(--pq-wait)" }}>{session.metrics.forfeited}</td>
                          <td className="text-center font-extrabold" style={{ color: "var(--pq-mark-blue-deep)" }}>{(session.metrics.completionRate || 0).toFixed(1)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="block md:hidden">
                  {paginatedDataset.map((session) => (
                    <button
                      key={session.id}
                      type="button"
                      className="w-full text-left p-4 space-y-3"
                      style={{ borderTop: "1px solid var(--pq-glass-line)" }}
                      aria-label={`View reservations on ${formatClinicDate(session.clinicDate)}`}
                      onClick={() => openSession(session.id)}
                    >
                      <div className="flex justify-between items-start gap-3">
                        <div>
                          <div className="font-extrabold tracking-tight">{formatClinicDate(session.clinicDate)}</div>
                          <div className="text-xs pq-muted">{session.openingTime} - {session.closingTime}</div>
                        </div>
                        <div className="pq-chip pq-chip-info">{session.branch}</div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm pq-row" style={{ display: "grid", minHeight: 0 }}>
                        <div className="flex flex-col">
                          <span className="pq-faint text-xs">Total</span>
                          <span className="font-semibold">{session.metrics.totalReservations}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="pq-faint text-xs">Completion</span>
                          <span className="font-extrabold" style={{ color: "var(--pq-mark-blue-deep)" }}>{(session.metrics.completionRate || 0).toFixed(1)}%</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="pq-faint text-xs">Checked Up</span>
                          <span className="font-semibold" style={{ color: "var(--pq-live)" }}>{session.metrics.checkedUp}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="pq-faint text-xs">Cancelled/Forfeited</span>
                          <span className="font-semibold">
                            <span style={{ color: "var(--pq-alert)" }}>{session.metrics.cancelled}</span> / <span style={{ color: "var(--pq-wait)" }}>{session.metrics.forfeited}</span>
                          </span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}

            {totalPages > 1 && (
              <div className="p-4 flex items-center justify-between" style={{ borderTop: "1px solid var(--pq-glass-line)" }}>
                <span className="text-sm pq-muted">
                  Showing <span className="font-semibold" style={{ color: "var(--pq-ink)" }}>{(currentPage - 1) * itemsPerPage + 1}</span> to <span className="font-semibold" style={{ color: "var(--pq-ink)" }}>{Math.min(currentPage * itemsPerPage, sortedDataset.length)}</span> of <span className="font-semibold" style={{ color: "var(--pq-ink)" }}>{sortedDataset.length}</span> sessions
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="pq-icon-btn"
                    aria-label="Previous page"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="pq-icon-btn"
                    aria-label="Next page"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}
          </div>
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
    return <ClinicSessionsReports />;
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

      {activeTab === "overview" ? <ClinicOverviewReports /> : <ClinicSessionsReports />}
    </div>
  );
}
