import {
  Activity,
  AlertCircle,
  AlertTriangle,
  Bell,
  CheckCircle,
  Clock,
  FileText,
  Lock,
  MapPin,
  Pause,
  Play,
  Square,
  User,
  UserCog,
  Users,
  XCircle,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart as RePieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import {
  DOCTOR_TOUR_SAMPLE_NOTES,
  formatDoctorSampleDate,
  formatDoctorSampleTime,
  getDoctorTourSampleAudit,
  getDoctorTourSampleDashboard,
  getDoctorTourSampleQueue,
  getDoctorTourSampleReports,
  getDoctorTourSampleUsers,
} from "./doctorTourSampleData";

const CHART_INK = "#16344a";
const CHART_MUTED = "#5a7a88";
const CHART_LINE = "#2f6fdb";
const CHART_GRID = "rgba(22, 52, 74, 0.1)";

function SampleFlag() {
  return <span className="pq-tour-sample-flag">Sample</span>;
}

function statusBadge(status) {
  if (status === "checked_in") {
    return (
      <span className="pq-chip pq-chip-live shrink-0">
        Checked In
      </span>
    );
  }
  return (
    <span className="pq-chip pq-chip-wait shrink-0">
      <Clock className="w-3.5 h-3.5" aria-hidden="true" />
      Not Checked In
    </span>
  );
}

function SampleCompletePanel({
  tourId,
  patient,
  walkIn,
}) {
  return (
    <div
      className="pq-glass w-full max-w-md mx-auto flex flex-col overflow-hidden"
      data-tour={tourId}
    >
      <div className="flex items-center justify-between gap-3 p-4 sm:p-5" style={{ borderBottom: "1px solid var(--pq-glass-line)" }}>
        <h2 className="text-base sm:text-lg font-extrabold tracking-tight flex items-center min-w-0">
          <CheckCircle className="w-5 h-5 mr-2 shrink-0" style={{ color: "var(--pq-live)" }} aria-hidden="true" />
          <span className="truncate">Complete Consultation</span>
        </h2>
        <SampleFlag />
      </div>
      <div className="p-4 sm:p-6">
        <div className="pq-row mb-6">
          <div>
            <div className="text-xs pq-faint font-extrabold uppercase tracking-wider mb-1">Patient</div>
            <div className="font-extrabold text-lg tracking-tight">{patient.childName}</div>
            <div className="mt-2">
              {walkIn ? <span className="pq-chip pq-chip-wait">Walk-in</span> : null}
            </div>
          </div>
          <div className="pq-queue-plate">#{patient.queueNumber}</div>
        </div>
        <label className="pq-label" htmlFor={`${tourId}-notes`}>Doctor&apos;s Notes (Optional)</label>
        {walkIn ? (
          <>
            <p className="pq-note pq-note-wait mb-3">
              Notes are not available for walk-in reservations.
            </p>
            <textarea
              id={`${tourId}-notes`}
              value=""
              disabled
              readOnly
              tabIndex={-1}
              placeholder="Notes are not available for walk-in reservations"
              rows={4}
              className="pq-input resize-none"
            />
          </>
        ) : (
          <>
            <p className="text-xs pq-muted mb-3">
              Add any medical notes, prescriptions, or follow-up instructions. These will be visible to the parent.
            </p>
            <textarea
              id={`${tourId}-notes`}
              value={DOCTOR_TOUR_SAMPLE_NOTES}
              readOnly
              tabIndex={-1}
              rows={4}
              className="pq-input resize-none"
            />
          </>
        )}
      </div>
      <div className="p-4 sm:p-5 flex gap-3 justify-end flex-wrap" style={{ borderTop: "1px solid var(--pq-glass-line)" }}>
        <button type="button" tabIndex={-1} className="pq-btn-secondary flex-1 sm:flex-none">Cancel</button>
        <button type="button" tabIndex={-1} disabled className="pq-btn-live flex-1 sm:flex-none">Complete Session</button>
      </div>
    </div>
  );
}

export function TourSampleDoctorDashboard() {
  const sample = getDoctorTourSampleDashboard();
  const stats = [
    { label: "Total", value: sample.stats.total },
    { label: "Waiting", value: sample.stats.waiting },
    { label: "In Consult", value: sample.stats.inConsultation },
    { label: "Completed", value: sample.stats.completed },
    { label: "Forfeited", value: sample.stats.forfeited },
  ];

  return (
    <div className="pq-tour-sample space-y-4 pointer-events-none" data-tour="doctor-dashboard">
      <p className="text-[11px] font-semibold pq-muted flex items-center gap-2">
        Tour preview — sample dashboard
        <SampleFlag />
      </p>
      <section className="pq-glass p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div className="min-w-0">
            <h2 className="text-lg font-extrabold tracking-tight flex items-center gap-2">
              <MapPin className="w-5 h-5 shrink-0" style={{ color: "var(--pq-mark-blue)" }} aria-hidden="true" />
              {sample.branch}
            </h2>
            <p className="text-sm pq-muted mt-1">
              {formatDoctorSampleDate(sample.clinicDate, {
                weekday: "long",
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
              {" · "}
              {formatDoctorSampleTime(sample.openingTime)} – {formatDoctorSampleTime(sample.closingTime)}
            </p>
          </div>
          <span className="pq-chip pq-chip-live">
            <span className="pq-pip" style={{ width: 8, height: 8 }} />
            Active
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {stats.map((stat) => (
            <div key={stat.label} className="pq-stat">
              <span className="pq-stat-label">{stat.label}</span>
              <span className="pq-stat-value">{stat.value}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export function TourSampleDoctorUsers() {
  const sample = getDoctorTourSampleUsers();

  return (
    <div className="pq-tour-sample space-y-4 pointer-events-none">
      <p className="text-[11px] font-semibold pq-muted flex items-center gap-2">
        Tour preview — sample accounts
        <SampleFlag />
      </p>

      <div className="pq-filter-bar p-3 sm:p-4" data-tour="doctor-users-list">
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="font-extrabold tracking-tight">Users</p>
            <p className="text-sm pq-muted">Search and filter staff or parent accounts</p>
          </div>
          <button type="button" tabIndex={-1} className="pq-btn-primary shrink-0">
            Add Staff
          </button>
        </div>
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div
            className="pq-row"
            style={{ display: "block", minHeight: 0, padding: "1rem" }}
            data-tour="doctor-users-secretary"
          >
            <div className="flex items-start gap-3">
              <div
                className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
                style={{ background: "var(--pq-wait-wash)", color: "var(--pq-wait)" }}
              >
                <UserCog className="w-5 h-5" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <h3 className="font-extrabold tracking-tight">{sample.secretary.name}</h3>
                  <span className="pq-chip pq-chip-wait">Secretary</span>
                  <span className="pq-chip pq-chip-live">Active</span>
                </div>
                <p className="text-sm pq-muted truncate">{sample.secretary.email}</p>
                <p className="text-xs pq-muted mt-2">
                  Reset Password creates a temporary password immediately — no email is sent.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" tabIndex={-1} className="pq-btn-secondary">Edit</button>
                  <button type="button" tabIndex={-1} className="pq-btn-secondary">Reset Password</button>
                  <button type="button" tabIndex={-1} className="pq-btn-secondary">Deactivate</button>
                </div>
              </div>
            </div>
          </div>

          <div
            className="pq-row"
            style={{ display: "block", minHeight: 0, padding: "1rem" }}
            data-tour="doctor-users-parent"
          >
            <div className="flex items-start gap-3">
              <div
                className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
                style={{ background: "color-mix(in srgb, var(--pq-mark-blue) 12%, white)", color: "var(--pq-mark-blue-deep)" }}
              >
                <User className="w-5 h-5" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <h3 className="font-extrabold tracking-tight">{sample.parent.name}</h3>
                  <span className="pq-chip">Parent</span>
                  <span className="pq-chip pq-chip-live">Active</span>
                </div>
                <p className="text-sm pq-muted truncate">{sample.parent.email}</p>
                <p className="text-xs pq-muted mt-2">
                  Parent accounts are view-only. You can deactivate, delete, or send a password reset email.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" tabIndex={-1} className="pq-btn-secondary">View</button>
                  <button type="button" tabIndex={-1} className="pq-btn-secondary">Send Reset Email</button>
                  <button type="button" tabIndex={-1} className="pq-btn-secondary">Deactivate</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function TourSampleDoctorAudit() {
  const sample = getDoctorTourSampleAudit();
  const log = sample.suspicious;

  return (
    <div className="pq-tour-sample space-y-4 pointer-events-none">
      <p className="text-[11px] font-semibold pq-muted flex items-center gap-2">
        Tour preview — sample audit entry
        <SampleFlag />
      </p>

      <div className="pq-filter-bar p-3 sm:p-4" data-tour="doctor-audit-filters">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="pq-input opacity-80 flex-1">Search audit logs...</div>
          <div className="pq-input opacity-80 min-w-[9rem]">{sample.filters.category}</div>
          <div className="pq-input opacity-80 min-w-[9rem]">{sample.filters.role}</div>
        </div>
        <p className="text-xs pq-muted mt-3">
          Role filter options: All Roles, Doctor, Secretary, System — no Admin filter.
        </p>
      </div>

      <div
        className="pq-glass overflow-hidden"
        data-tour="doctor-audit-suspicious"
      >
        <div className="p-4 sm:p-5 flex flex-wrap items-start justify-between gap-3" style={{ borderBottom: "1px solid var(--pq-glass-line)" }}>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="pq-chip pq-chip-alert">Suspicious</span>
              <span className="pq-chip">User</span>
              <span className="pq-chip pq-chip-alert">System</span>
            </div>
            <h3 className="font-extrabold tracking-tight">{log.description}</h3>
            <p className="text-xs pq-muted mt-1 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" aria-hidden="true" />
              Sample entry — tour only
            </p>
          </div>
          <AlertTriangle className="w-5 h-5 shrink-0" style={{ color: "var(--pq-alert)" }} aria-hidden="true" />
        </div>
        <div className="p-4 sm:p-5 space-y-4">
          <div>
            <p className="text-xs font-semibold pq-faint uppercase tracking-wide mb-1.5">Recommendation</p>
            <p className="text-sm font-medium leading-relaxed">{log.recommendation}</p>
          </div>
          <div>
            <p className="text-xs font-semibold pq-faint uppercase tracking-wide mb-1">Evidence</p>
            <ul className="space-y-1.5 text-sm pq-muted">
              {log.evidence.map((row) => (
                <li key={row.reservationId}>
                  <span className="font-semibold text-[var(--pq-ink)]">{row.clinicDate}</span>
                  {" — No QR validation (no-show)"}
                  {row.status ? ` · status: ${row.status}` : ""}
                </li>
              ))}
            </ul>
          </div>
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
            <button type="button" tabIndex={-1} disabled className="pq-btn-secondary">
              Dismiss / Mark as Reviewed
            </button>
            <button
              type="button"
              tabIndex={-1}
              disabled
              className="pq-btn-primary"
              style={{ background: "var(--pq-alert)" }}
            >
              Deactivate Account
            </button>
          </div>
        </div>
      </div>

      <div className="pq-glass p-4 sm:p-5" data-tour="doctor-notifications">
        <div className="flex items-start gap-3">
          <div
            className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
            style={{ background: "var(--pq-wait-wash)", color: "var(--pq-wait)" }}
          >
            <Bell className="w-5 h-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h3 className="font-extrabold tracking-tight">Suspicious Account Detected</h3>
            <p className="text-sm pq-muted mt-1 leading-relaxed">
              Sample push / in-app alert. Allow notifications when prompted after sign-in. Tapping a push opens the matching Audit Logs entry. The tour never triggers a real permission prompt.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function TourSampleDoctorQueue() {
  const sample = getDoctorTourSampleQueue();
  const walkInPatient = sample.waiting.find((row) => row.source === "walk_in") || sample.waiting[0];

  return (
    <div className="pq-tour-sample space-y-6 pointer-events-none">
      <p className="text-[11px] font-semibold pq-muted flex items-center gap-2">
        Tour preview — not a real queue
        <SampleFlag />
      </p>

      <div className="pq-glass p-4 sm:p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 min-w-0">
          <div className="min-w-0">
            <h2 className="text-lg font-extrabold tracking-tight flex items-center">
              <MapPin className="w-5 h-5 mr-2 shrink-0" style={{ color: "var(--pq-mark-blue)" }} aria-hidden="true" />
              {sample.branch}
            </h2>
            <div className="pq-muted text-sm mt-1">
              <span className="flex items-center">
                <Clock className="w-4 h-4 mr-1.5 shrink-0" aria-hidden="true" />
                {formatDoctorSampleDate(sample.clinicDate, {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </span>
            </div>
          </div>

          <div className="flex flex-col items-stretch sm:items-end gap-3 min-w-0 w-full sm:w-auto">
            <button type="button" tabIndex={-1} className="pq-btn-live w-full sm:w-auto" data-tour="doctor-queue-start">
              <Play className="w-4 h-4" aria-hidden="true" /> Start Queue
            </button>
            <div className="flex flex-wrap items-center gap-2 min-w-0" data-tour="doctor-queue-control">
              <span className="pq-chip pq-chip-live shrink-0">
                <span className="pq-pip" style={{ width: 8, height: 8 }} />
                Active Session
              </span>
              <button type="button" tabIndex={-1} className="pq-session-orb pq-session-orb-wait" aria-label="Pause Queue">
                <Pause className="w-4 h-4" aria-hidden="true" />
              </button>
              <button type="button" tabIndex={-1} className="pq-session-orb pq-session-orb-live" aria-label="Resume Queue">
                <Play className="w-4 h-4" aria-hidden="true" />
              </button>
              <button type="button" tabIndex={-1} className="pq-session-orb pq-session-orb-lock" aria-label="Close Queue to New Reservations">
                <Lock className="w-4 h-4" aria-hidden="true" />
              </button>
              <button type="button" tabIndex={-1} className="pq-session-orb pq-session-orb-stop" aria-label="End Clinic Session">
                <Square className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 items-stretch">
        <div className="flex-[4] pq-glass overflow-hidden flex flex-col">
          <div className="pq-now mx-0 rounded-none" style={{ borderRadius: 0, border: "none", borderBottom: "1px solid color-mix(in srgb, var(--pq-live) 18%, white)" }}>
            <h3 className="font-extrabold flex items-center" style={{ color: "var(--pq-live)" }}>
              <span className="pq-pip mr-2" />
              Current Consultation
            </h3>
            <span className="pq-chip pq-chip-live">Queue #{sample.inConsultation.queueNumber}</span>
          </div>
          <div className="p-4 sm:p-6">
            <div className="mb-6">
              <h3 className="font-extrabold tracking-tight text-2xl">{sample.inConsultation.childName}</h3>
              <div className="text-sm pq-muted flex flex-col gap-1 mt-2">
                <span className="flex items-center">
                  <User className="w-4 h-4 mr-1.5" aria-hidden="true" />
                  Age: {sample.inConsultation.age} • {sample.inConsultation.sex}
                </span>
              </div>
            </div>
            <div className="pq-note pq-note-wait mb-6">
              <div className="text-xs font-extrabold uppercase tracking-wider mb-2 flex items-center">
                <AlertCircle className="w-4 h-4 mr-1.5" aria-hidden="true" /> Concern / Reason for Visit
              </div>
              <div className="font-medium text-sm" style={{ color: "var(--pq-ink)" }}>
                {sample.inConsultation.concern}
              </div>
            </div>
            <button type="button" tabIndex={-1} className="pq-btn-live w-full">
              <CheckCircle className="w-5 h-5" aria-hidden="true" /> Complete Consultation
            </button>
          </div>
        </div>

        <section className="flex-[6] pq-glass p-5 flex flex-col" data-tour="doctor-queue-list">
          <h3 className="font-extrabold tracking-tight mb-4 flex items-center">
            <Users className="w-5 h-5 mr-2" style={{ color: "var(--pq-mark-blue)" }} aria-hidden="true" />
            Waiting Queue <span className="ml-2 pq-chip pq-chip-info">{sample.waiting.length}</span>
          </h3>
          <div className="space-y-2">
            {sample.waiting.map((res) => (
              <div key={res.id} className="pq-row items-start sm:items-center">
                <div className="flex items-start min-w-0 flex-1 gap-4">
                  <div className="pq-queue-plate">{res.queueNumber}</div>
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <h4 className="font-extrabold truncate">{res.childName}</h4>
                      {res.source === "walk_in" ? (
                        <span className="pq-chip pq-chip-wait">Walk-in</span>
                      ) : null}
                    </div>
                    {statusBadge(res.status)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SampleCompletePanel
          tourId="doctor-consult-regular"
          patient={sample.inConsultation}
          walkIn={false}
        />
        <SampleCompletePanel
          tourId="doctor-consult-walkin"
          patient={walkInPatient}
          walkIn
        />
      </div>
    </div>
  );
}

export function TourSampleDoctorReports() {
  const sample = getDoctorTourSampleReports();
  const DATE_RANGES = ["Today", "This Week", "This Month", "This Year"];
  const tooltipStyle = {
    borderRadius: "0.95rem",
    border: "1px solid rgba(22, 52, 74, 0.1)",
    background: "color-mix(in srgb, #ffffff 92%, #e4f3f4)",
    color: CHART_INK,
    boxShadow: "0 12px 28px -14px rgba(22, 52, 74, 0.28)",
  };

  return (
    <div className="pq-tour-sample space-y-6 pointer-events-none">
      <p className="text-[11px] font-semibold pq-muted flex items-center gap-2">
        Tour preview — sample numbers only
        <SampleFlag />
      </p>

      <div className="pq-filter-bar p-4 sm:p-5" data-tour="doctor-reports-filters">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
          <div className="flex flex-col min-w-0">
            <span className="pq-label mb-1">Showing</span>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-extrabold tracking-tight">{sample.branch}</span>
              <span className="pq-faint" aria-hidden="true">•</span>
              <span className="font-extrabold tracking-tight">{sample.dateRange}</span>
            </div>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 sm:pb-0 pq-scroll-x pq-scroll-none" role="group" aria-label="Filter by Date Range">
            {DATE_RANGES.map((range) => (
              <button
                key={range}
                type="button"
                tabIndex={-1}
                className={range === sample.dateRange ? "pq-btn-primary flex-shrink-0" : "pq-btn-secondary flex-shrink-0"}
                aria-pressed={range === sample.dateRange}
              >
                {range}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="pq-glass p-5">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          <div className="pq-stat pq-stat-info col-span-2 md:col-span-1">
            <span className="pq-stat-label flex items-center gap-1"><Users className="w-3.5 h-3.5" aria-hidden="true" /> Total</span>
            <span className="pq-stat-value">{sample.totals.totalReservations}</span>
          </div>
          <div className="pq-stat pq-stat-live">
            <span className="pq-stat-label flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5" aria-hidden="true" /> Checked Up</span>
            <span className="pq-stat-value">{sample.totals.checkedUp}</span>
          </div>
          <div className="pq-stat" style={{ background: "var(--pq-alert-wash)", borderColor: "color-mix(in srgb, var(--pq-alert) 22%, white)" }}>
            <span className="pq-stat-label flex items-center gap-1" style={{ color: "var(--pq-alert)" }}><XCircle className="w-3.5 h-3.5" aria-hidden="true" /> Cancelled</span>
            <span className="pq-stat-value" style={{ color: "var(--pq-alert)" }}>{sample.totals.cancelled}</span>
          </div>
          <div className="pq-stat pq-stat-wait">
            <span className="pq-stat-label flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" aria-hidden="true" /> Forfeited</span>
            <span className="pq-stat-value">{sample.totals.forfeited}</span>
          </div>
          <div className="pq-stat col-span-1 md:col-span-2 lg:col-span-1">
            <span className="pq-stat-label flex items-center gap-1"><Activity className="w-3.5 h-3.5" aria-hidden="true" /> Completion</span>
            <span className="pq-stat-value">{sample.totals.completionRate}%</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="pq-glass p-6">
          <h3 className="text-lg font-extrabold tracking-tight mb-4 sm:mb-6">Reservation Trend</h3>
          <div className="h-52 sm:h-64 lg:h-72 w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={sample.trend} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={CHART_GRID} />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: CHART_MUTED, fontSize: 12, fontFamily: "Lexend, Segoe UI, sans-serif" }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: CHART_MUTED, fontSize: 12, fontFamily: "Lexend, Segoe UI, sans-serif" }} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} labelStyle={{ fontWeight: 800, color: CHART_INK, marginBottom: 4 }} />
                <Line type="monotone" dataKey="reservations" name="Reservations" stroke={CHART_LINE} strokeWidth={3} dot={{ r: 4, strokeWidth: 2, fill: "#fff", stroke: CHART_LINE }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="pq-glass p-6">
          <h3 className="text-lg font-extrabold tracking-tight mb-4 sm:mb-6">Outcome Distribution</h3>
          <div className="h-52 sm:h-64 lg:h-72 w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <RePieChart>
                <Pie data={sample.outcomes} cx="50%" cy="50%" innerRadius={70} outerRadius={95} paddingAngle={5} dataKey="value">
                  {sample.outcomes.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
                <Legend verticalAlign="bottom" height={36} iconType="circle" />
              </RePieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="pq-glass overflow-hidden" data-tour="doctor-reports-history">
        <div className="p-6 flex justify-between items-center" style={{ borderBottom: "1px solid var(--pq-glass-line)" }}>
          <h3 className="text-lg font-extrabold tracking-tight">Session History</h3>
          <SampleFlag />
        </div>
        <div className="p-4 sm:p-5" style={{ borderBottom: "1px solid var(--pq-glass-line)" }}>
          <div className="pq-row" style={{ display: "block", minHeight: 0, padding: "1rem" }}>
            <div className="flex items-start gap-3">
              <FileText className="w-5 h-5 mt-0.5 shrink-0" style={{ color: "var(--pq-mark-blue)" }} aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-xs pq-faint font-extrabold uppercase tracking-wider mb-1">Sample consultation record</p>
                <p className="font-extrabold tracking-tight">{sample.consultation.childName}</p>
                <p className="text-sm pq-muted mt-1">{sample.consultation.notes}</p>
              </div>
            </div>
          </div>
        </div>
        <div className="hidden md:block overflow-x-auto pq-scroll-x">
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
              <tr>
                <td className="whitespace-nowrap">
                  {formatDoctorSampleDate(sample.session.clinicDate, { month: "short", day: "numeric", year: "numeric" })}
                  <div className="text-xs pq-muted font-medium mt-0.5">
                    {sample.session.openingTime} - {sample.session.closingTime}
                  </div>
                </td>
                <td className="whitespace-nowrap pq-muted">{sample.session.branch}</td>
                <td className="text-center">{sample.session.metrics.totalReservations}</td>
                <td className="text-center" style={{ color: "var(--pq-live)" }}>{sample.session.metrics.checkedUp}</td>
                <td className="text-center" style={{ color: "var(--pq-alert)" }}>{sample.session.metrics.cancelled}</td>
                <td className="text-center" style={{ color: "var(--pq-wait)" }}>{sample.session.metrics.forfeited}</td>
                <td className="text-center font-extrabold" style={{ color: "var(--pq-mark-blue-deep)" }}>{sample.session.metrics.completionRate.toFixed(1)}%</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="block md:hidden p-4 space-y-3">
          <div className="flex justify-between items-start gap-3">
            <div>
              <div className="font-extrabold tracking-tight">
                {formatDoctorSampleDate(sample.session.clinicDate, { month: "short", day: "numeric", year: "numeric" })}
              </div>
              <div className="text-xs pq-muted">{sample.session.openingTime} - {sample.session.closingTime}</div>
            </div>
            <div className="pq-chip pq-chip-info">{sample.session.branch}</div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="flex flex-col">
              <span className="pq-faint text-xs">Total</span>
              <span className="font-semibold">{sample.session.metrics.totalReservations}</span>
            </div>
            <div className="flex flex-col">
              <span className="pq-faint text-xs">Completion</span>
              <span className="font-extrabold" style={{ color: "var(--pq-mark-blue-deep)" }}>{sample.session.metrics.completionRate.toFixed(1)}%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
