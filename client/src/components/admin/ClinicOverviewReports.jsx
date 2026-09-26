import { Activity as ActivityIcon, MapPin, AlertCircle, Users, Inbox, ChevronDown } from "lucide-react";
import { useAdminReportsData } from "../../hooks/useAdminReportsData";
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { PqSpinner } from "../parent/pqUi";

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

const SelectChevron = () => (
  <div className="pq-field-icon" style={{ left: "auto", right: "0.85rem" }} aria-hidden="true">
    <ChevronDown className="w-4 h-4" />
  </div>
);

/** System-wide adoption / utilization reports (formerly admin Reports tab). */
export default function ClinicOverviewReports() {
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
    <div className="space-y-4 md:flex-1 md:flex md:flex-col md:min-h-0 overflow-y-auto pq-scroll-y">
      <div className="pq-filter-bar p-3 sm:p-4 flex">
        <div className="relative w-full sm:w-auto sm:min-w-[12rem]">
          <label htmlFor="clinic-overview-date-range" className="sr-only">Date range</label>
          <select
            id="clinic-overview-date-range"
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="pq-input pr-10 appearance-none cursor-pointer"
          >
            <option value="This Month">This Month</option>
            <option value="Last 3 Months">Last 3 Months</option>
            <option value="This Year">This Year</option>
            <option value="All Time">All Time</option>
          </select>
          <SelectChevron />
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
          <h3 className="text-lg font-extrabold tracking-tight mb-1">No activity found</h3>
          <p className="pq-muted text-sm max-w-sm mx-auto">
            There is no system activity for the selected date range. Try expanding your search.
          </p>
        </div>
      ) : (
        <div className="pq-glass p-5 sm:p-6 space-y-6 md:flex-1">
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

          <div>
            <h3 className="text-lg font-extrabold tracking-tight mb-4">Parent Adoption Trend</h3>
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

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <h3 className="text-lg font-extrabold tracking-tight mb-4">Reservations by Branch</h3>
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

            <div>
              <h3 className="text-lg font-extrabold tracking-tight mb-4">Global Outcomes</h3>
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
        </div>
      )}
    </div>
  );
}
