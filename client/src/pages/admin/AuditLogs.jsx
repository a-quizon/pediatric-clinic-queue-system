import React, { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { FileText, Activity as ActivityIcon, Search, Filter, Shield, Stethoscope, UserCog, User, MapPin, Clock, ArrowDownToLine, AlertCircle, Calendar, Users, Inbox } from "lucide-react";
import { ref, query, limitToLast } from "firebase/database";
import { database } from "../../firebase/database";
import { subscribeOnValue } from "../../firebase/rtdbSubscribe";
import { AUDIT_CATEGORIES } from "../../services/auditService";
import { useAdminReportsData } from "../../hooks/useAdminReportsData";
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { PqSpinner } from "../../components/parent/pqUi";

const CHART_INK = "#16344a";
const CHART_MUTED = "#5a7a88";
const CHART_LINE = "#2f6fdb";
const CHART_GRID = "rgba(22, 52, 74, 0.1)";
const OUTCOME_COLORS = {
  "Checked Up": "#0f7a5a",
  Cancelled: "#b4232c",
  Forfeited: "#9a5b12",
};

const tooltipStyle = {
  borderRadius: "0.95rem",
  border: "1px solid rgba(22, 52, 74, 0.1)",
  background: "color-mix(in srgb, #ffffff 92%, #e4f3f4)",
  color: CHART_INK,
  boxShadow: "0 12px 28px -14px rgba(22, 52, 74, 0.28)",
};

const formatDateTime = (timestamp) => {
  if (!timestamp) return "Unknown";
  const d = new Date(timestamp);
  return new Intl.DateTimeFormat("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit", hour12: true
  }).format(d);
};

const roleChip = (role) => {
  if (role === "doctor") return "pq-chip pq-chip-info";
  if (role === "secretary") return "pq-chip pq-chip-wait";
  if (role === "admin") return "pq-chip pq-chip-info";
  return "pq-chip";
};

const AdminReports = () => {
  const { loading, error, metrics, filters } = useAdminReportsData();
  const { dateRange, setDateRange } = filters;

  if (error) {
    return (
      <div className="pq-glass p-12 text-center md:flex-1">
        <AlertCircle className="w-12 h-12 mx-auto mb-3" style={{ color: "var(--pq-alert)" }} aria-hidden="true" />
        <p className="font-extrabold tracking-tight">Failed to load reports data.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="pq-glass p-10 min-h-[400px] md:flex-1">
        <PqSpinner label="Loading reports" />
      </div>
    );
  }

  const { kpis, adoptionData, branchData, outcomeData, hasData } = metrics;

  return (
    <div className="space-y-6 md:flex-1 overflow-y-auto">
      <div className="pq-filter-bar p-4 sm:p-5 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="text-lg font-extrabold tracking-tight flex items-center gap-2 leading-none">
            <Calendar className="w-5 h-5" style={{ color: "var(--pq-mark-blue)" }} aria-hidden="true" />
            System Analytics
          </h2>
        </div>

        <div className="relative min-w-[180px]">
          <div className="pq-field-icon">
            <Calendar className="w-4 h-4" aria-hidden="true" />
          </div>
          <label htmlFor="reports-date-range" className="sr-only">Date range</label>
          <select
            id="reports-date-range"
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="pq-input pl-10 appearance-none cursor-pointer"
          >
            <option value="This Month">This Month</option>
            <option value="Last 3 Months">Last 3 Months</option>
            <option value="This Year">This Year</option>
            <option value="All Time">All Time</option>
          </select>
        </div>
      </div>

      {!hasData ? (
        <div className="pq-glass p-12 text-center md:flex-1 flex flex-col items-center justify-center min-h-[300px]">
          <div
            className="mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4"
            style={{ background: "color-mix(in srgb, #ffffff 55%, transparent)", color: "var(--pq-ink-faint)" }}
          >
            <Inbox className="w-8 h-8" aria-hidden="true" />
          </div>
          <h3 className="text-lg font-extrabold tracking-tight mb-1">No Activity Found</h3>
          <p className="pq-muted text-sm max-w-sm mx-auto">
            There is no system activity for the selected date range. Try expanding your search.
          </p>
        </div>
      ) : (
        <>
          <div className="pq-glass p-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="pq-stat pq-stat-info">
                <span className="pq-stat-label flex items-center gap-1">
                  <Users className="w-3.5 h-3.5" aria-hidden="true" /> Registered Parents
                </span>
                <span className="pq-stat-value">{kpis.totalParents}</span>
              </div>

              <div className="pq-stat">
                <span className="pq-stat-label flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" aria-hidden="true" /> Completed Sessions
                </span>
                <span className="pq-stat-value">{kpis.totalSessions}</span>
              </div>

              <div className="pq-stat pq-stat-live">
                <span className="pq-stat-label flex items-center gap-1">
                  <ActivityIcon className="w-3.5 h-3.5" aria-hidden="true" /> Total Reservations
                </span>
                <span className="pq-stat-value">{kpis.totalReservations}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="pq-glass p-6 lg:col-span-2">
              <h3 className="text-lg font-extrabold tracking-tight mb-6">Parent Adoption Trend</h3>
              <div className="h-72 w-full">
                {adoptionData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={adoptionData} margin={{ top: 5, right: 0, bottom: 5, left: -20 }}>
                      <defs>
                        <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={CHART_LINE} stopOpacity={0.3} />
                          <stop offset="95%" stopColor={CHART_LINE} stopOpacity={0} />
                        </linearGradient>
                      </defs>
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
                      <Area
                        type="monotone"
                        dataKey="users"
                        name="New Users"
                        stroke={CHART_LINE}
                        strokeWidth={3}
                        fillOpacity={1}
                        fill="url(#colorUsers)"
                        activeDot={{ r: 6, strokeWidth: 0 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full pq-faint">
                    No adoption data in this period
                  </div>
                )}
              </div>
            </div>

            <div className="pq-glass p-6">
              <h3 className="text-lg font-extrabold tracking-tight mb-6">Reservations by Branch</h3>
              <div className="h-72 w-full">
                {branchData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={branchData} margin={{ top: 5, right: 0, bottom: 5, left: -20 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={CHART_GRID} />
                      <XAxis
                        dataKey="branch"
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
                        cursor={{ fill: "color-mix(in srgb, #ffffff 55%, transparent)" }}
                      />
                      <Bar dataKey="reservations" name="Reservations" fill={CHART_LINE} radius={[8, 8, 0, 0]} maxBarSize={60} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full pq-faint">
                    No branch data in this period
                  </div>
                )}
              </div>
            </div>

            <div className="pq-glass p-6">
              <h3 className="text-lg font-extrabold tracking-tight mb-6">Global Outcomes</h3>
              <div className="h-72 w-full">
                {outcomeData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
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
                          <Cell key={`cell-${index}`} fill={OUTCOME_COLORS[entry.name] || entry.color} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle} />
                      <Legend
                        verticalAlign="bottom"
                        height={36}
                        iconType="circle"
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full pq-faint">
                    No outcome data to display
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default function AuditLogs() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(() => (
    searchParams.get("tab") === "reports" ? "reports" : "audit"
  ));

  const setTab = (tab) => {
    setActiveTab(tab);
    if (tab === "reports") {
      setSearchParams({ tab: "reports" }, { replace: true });
    } else {
      setSearchParams({}, { replace: true });
    }
  };

  const auditTabRef = useRef(null);
  const reportsTabRef = useRef(null);

  const focusTab = (tab) => {
    requestAnimationFrame(() => {
      (tab === "reports" ? reportsTabRef : auditTabRef).current?.focus();
    });
  };

  const onTabKeyDown = (event) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    let next = activeTab;
    if (event.key === "Home") next = "audit";
    else if (event.key === "End") next = "reports";
    else next = activeTab === "audit" ? "reports" : "audit";
    setTab(next);
    focusTab(next);
  };

  useEffect(() => {
    setActiveTab(searchParams.get("tab") === "reports" ? "reports" : "audit");
  }, [searchParams]);

  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [logLimit, setLogLimit] = useState(100);
  const [hasMoreLogs, setHasMoreLogs] = useState(true);
  const [error, setError] = useState(null);

  const [categoryFilter, setCategoryFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 15;

  useEffect(() => {
    if (activeTab !== "audit") return;

    setLoading(true);
    setError(null);
    const auditRef = ref(database, "auditLogs");
    const q = query(auditRef, limitToLast(logLimit));

    const unsubscribe = subscribeOnValue(q, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const logsList = Object.keys(data).map((key) => ({
          id: key,
          ...data[key]
        }));

        logsList.sort((a, b) => b.timestamp - a.timestamp);

        setLogs(logsList);
        setHasMoreLogs(logsList.length === logLimit);
      } else {
        setLogs([]);
        setHasMoreLogs(false);
      }
      setLoading(false);
    }, (err) => {
      console.error("Failed to load audit logs", err);
      setError("Failed to load audit logs. Please try again later.");
      setLoading(false);
    });

    return () => unsubscribe();
  }, [activeTab, logLimit]);

  const filteredLogs = logs.filter((log) => {
    const term = searchQuery.toLowerCase();
    const matchesSearch = (log.actorName && log.actorName.toLowerCase().includes(term)) ||
                          (log.description && log.description.toLowerCase().includes(term));
    const matchesCategory = categoryFilter === "all" || log.category === categoryFilter;
    const matchesRole = roleFilter === "all" || log.actorRole === roleFilter;

    return matchesSearch && matchesCategory && matchesRole;
  });

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, categoryFilter, roleFilter, logs.length]);

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / ITEMS_PER_PAGE));
  const paginatedLogs = filteredLogs.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const getRoleIcon = (role) => {
    switch (role) {
      case "doctor": return <Stethoscope className="w-4 h-4" aria-hidden="true" />;
      case "secretary": return <UserCog className="w-4 h-4" aria-hidden="true" />;
      case "admin": return <Shield className="w-4 h-4" aria-hidden="true" />;
      default: return <User className="w-4 h-4" aria-hidden="true" />;
    }
  };

  const formatCategory = (categoryStr) => {
    if (!categoryStr) return "System";
    return categoryStr.split("_").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
  };

  return (
    <div className="space-y-6 pb-8 md:h-[calc(100vh-140px)] md:flex md:flex-col">
      <div className="pq-tablist" role="tablist" aria-label="Audit logs views">
        <button
          type="button"
          role="tab"
          id="activity-tab-audit"
          aria-controls="activity-panel-audit"
          aria-selected={activeTab === "audit"}
          tabIndex={activeTab === "audit" ? 0 : -1}
          ref={auditTabRef}
          className="pq-tab"
          onClick={() => setTab("audit")}
          onKeyDown={onTabKeyDown}
        >
          <ActivityIcon className="w-4 h-4" aria-hidden="true" />
          Audit Logs
        </button>
        <button
          type="button"
          role="tab"
          id="activity-tab-reports"
          aria-controls="activity-panel-reports"
          aria-selected={activeTab === "reports"}
          tabIndex={activeTab === "reports" ? 0 : -1}
          ref={reportsTabRef}
          className="pq-tab"
          onClick={() => setTab("reports")}
          onKeyDown={onTabKeyDown}
        >
          <FileText className="w-4 h-4" aria-hidden="true" />
          Reports
        </button>
      </div>

      {activeTab === "audit" ? (
        <div
          role="tabpanel"
          id="activity-panel-audit"
          aria-labelledby="activity-tab-audit"
          className="space-y-6 md:flex-1 md:flex md:flex-col md:min-h-0"
        >
          <div className="pq-filter-bar p-3 sm:p-4 flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <div className="pq-field-icon">
                <Search className="w-5 h-5" aria-hidden="true" />
              </div>
              <label htmlFor="activity-search" className="sr-only">Search audit logs</label>
              <input
                id="activity-search"
                type="text"
                placeholder="Search audit logs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pq-input pl-10"
              />
            </div>

            <div className="flex gap-3">
              <div className="relative flex-1 md:flex-none">
                <div className="pq-field-icon">
                  <Filter className="w-4 h-4" aria-hidden="true" />
                </div>
                <label htmlFor="activity-category-filter" className="sr-only">Filter by category</label>
                <select
                  id="activity-category-filter"
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="pq-input pl-10 appearance-none cursor-pointer min-w-[12rem]"
                >
                  <option value="all">All Categories</option>
                  {Object.values(AUDIT_CATEGORIES).map((cat) => (
                    <option key={cat} value={cat}>{formatCategory(cat)}</option>
                  ))}
                </select>
              </div>

              <div className="relative flex-1 md:flex-none">
                <label htmlFor="activity-role-filter" className="sr-only">Filter by role</label>
                <select
                  id="activity-role-filter"
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="pq-input appearance-none cursor-pointer min-w-[9rem]"
                >
                  <option value="all">All Roles</option>
                  <option value="admin">Admin</option>
                  <option value="doctor">Doctor</option>
                  <option value="secretary">Secretary</option>
                </select>
              </div>
            </div>
          </div>

          <div className="pq-glass overflow-hidden min-h-[300px] md:flex-1 md:flex md:flex-col md:min-h-0">
            {error ? (
              <div className="flex flex-col items-center justify-center p-12 text-center md:flex-1">
                <AlertCircle className="w-12 h-12 mb-3" style={{ color: "var(--pq-alert)" }} aria-hidden="true" />
                <p className="font-extrabold tracking-tight">{error}</p>
              </div>
            ) : loading && logs.length === 0 ? (
              <PqSpinner label="Loading audit logs" />
            ) : filteredLogs.length > 0 ? (
              <>
                <div className="block md:hidden overflow-y-auto">
                  {paginatedLogs.map((log) => (
                    <div
                      key={log.id}
                      className="p-5 flex flex-col gap-3"
                      style={{ borderTop: "1px solid var(--pq-glass-line)" }}
                    >
                      <div>
                        <h3 className="font-extrabold tracking-tight text-sm leading-tight">{log.description}</h3>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-xs pq-muted flex items-center gap-1 leading-none">
                            <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                            {formatDateTime(log.timestamp)}
                          </span>
                        </div>
                      </div>

                      <div className="pq-row" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", minHeight: 0, alignItems: "start" }}>
                        <div className="text-sm min-w-0">
                          <span className="pq-faint text-xs block mb-1">Actor</span>
                          <span className="font-semibold block truncate">{log.actorName}</span>
                          <span className={`${roleChip(log.actorRole)} capitalize mt-1`}>
                            {getRoleIcon(log.actorRole)}
                            {log.actorRole}
                          </span>
                        </div>
                        <div className="text-sm min-w-0">
                          <span className="pq-faint text-xs block mb-1">Category</span>
                          <span className="pq-chip max-w-full truncate">
                            {formatCategory(log.category)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="hidden md:block overflow-x-auto md:flex-1 md:overflow-y-auto relative">
                  <table className="pq-table">
                    <thead className="pq-table-head-sticky">
                      <tr>
                        <th className="pl-6 w-48">Date & Time</th>
                        <th className="w-48">Actor</th>
                        <th className="w-32">Role</th>
                        <th className="min-w-[200px]">Activity</th>
                        <th className="w-48">Category</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedLogs.map((log) => (
                        <tr key={log.id}>
                          <td className="pl-6 text-sm pq-muted whitespace-nowrap font-medium">
                            {formatDateTime(log.timestamp)}
                          </td>
                          <td className="font-semibold truncate max-w-[150px]">
                            {log.actorName}
                          </td>
                          <td>
                            <span className={`${roleChip(log.actorRole)} capitalize`}>
                              {getRoleIcon(log.actorRole)}
                              {log.actorRole}
                            </span>
                          </td>
                          <td className="text-sm font-semibold">
                            {log.description}
                          </td>
                          <td>
                            <span className="pq-chip">
                              {formatCategory(log.category)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div
                  className="flex flex-col sm:flex-row sm:items-center justify-between px-5 py-4 gap-4 md:flex-none z-10"
                  style={{ borderTop: "1px solid var(--pq-glass-line)" }}
                >
                  <div className="text-sm pq-muted font-medium text-center sm:text-left">
                    Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, filteredLogs.length)} of {filteredLogs.length} matching {filteredLogs.length === 1 ? "record" : "records"}
                  </div>

                  <div className="flex flex-col sm:flex-row items-center gap-3">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="pq-btn-secondary"
                      >
                        Previous
                      </button>
                      <span className="text-sm font-medium pq-muted px-2">
                        Page {currentPage} of {totalPages}
                      </span>
                      <button
                        type="button"
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="pq-btn-secondary"
                      >
                        Next
                      </button>
                    </div>

                    {hasMoreLogs && (
                      <button
                        type="button"
                        onClick={() => setLogLimit((l) => l + 100)}
                        disabled={loading}
                        className="pq-btn-secondary"
                      >
                        {loading ? (
                          <span className="pq-spinner w-4 h-4 border-2" aria-hidden="true" />
                        ) : (
                          <ArrowDownToLine className="w-4 h-4" aria-hidden="true" />
                        )}
                        Load Older Logs
                      </button>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center p-12 text-center md:flex-1">
                <ActivityIcon className="w-12 h-12 pq-faint mb-3" aria-hidden="true" />
                <p className="font-extrabold tracking-tight">No activity logs found.</p>
                {(searchQuery || categoryFilter !== "all" || roleFilter !== "all") && (
                  <button
                    type="button"
                    onClick={() => { setSearchQuery(""); setCategoryFilter("all"); setRoleFilter("all"); }}
                    className="pq-btn-ghost mt-4"
                  >
                    Clear Filters
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div
          role="tabpanel"
          id="activity-panel-reports"
          aria-labelledby="activity-tab-reports"
          className="md:flex-1 md:flex md:flex-col md:min-h-0"
        >
          <AdminReports />
        </div>
      )}
    </div>
  );
}
