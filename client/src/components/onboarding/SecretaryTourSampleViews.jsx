import {
  AlertTriangle,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  Lock,
  Pause,
  PlayCircle,
  QrCode,
  Square,
  Stethoscope,
  UserCheck,
  UserPlus,
  Users,
} from "lucide-react";
import { SampleQrGraphic } from "./TourSampleViews";
import {
  SECRETARY_TOUR_SAMPLE_CODE,
  SECRETARY_TOUR_SAMPLE_WALKIN,
  formatSecretarySampleDate,
  formatSecretarySampleTime,
  getSecretaryTourSampleQueue,
  getSecretaryTourSampleSchedule,
} from "./secretaryTourSampleData";

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

export function TourSampleManageQueue() {
  const sample = getSecretaryTourSampleQueue();
  const nextCheckedIn = sample.waiting.find((r) => r.status === "checked_in");

  return (
    <div className="pq-tour-sample space-y-6 max-w-4xl mx-auto pointer-events-none">
      <p className="text-[11px] font-semibold pq-muted flex items-center gap-2">
        Tour preview — not a real queue
        <SampleFlag />
      </p>

      <div
        className="pq-glass p-5 sm:p-6 text-center"
        data-tour="queue-start"
        aria-label="Start queue sample"
      >
        <PlayCircle className="w-10 h-10 mx-auto mb-3" style={{ color: "var(--pq-live)" }} aria-hidden="true" />
        <h2 className="text-lg font-extrabold tracking-tight mb-1">Start Queue</h2>
        <p className="text-sm pq-muted mb-4 max-w-sm mx-auto">
          Sample control for opening today&apos;s published schedule. Disabled during the tour.
        </p>
        <button type="button" tabIndex={-1} disabled className="pq-btn-live">
          <PlayCircle className="w-4 h-4" aria-hidden="true" />
          Start Queue
        </button>
      </div>

      <section className="pq-glass p-5 sm:p-6" aria-label="Queue session" data-tour="queue-control">
        <div className="flex w-full min-w-0 flex-wrap items-center justify-between gap-2">
          <span className="pq-chip pq-chip-live shrink-0">
            <span className="pq-pip" style={{ width: 8, height: 8 }} />
            Active Session
          </span>
          <div className="flex items-center gap-2 min-w-0 flex-wrap">
            <button type="button" tabIndex={-1} className="pq-session-orb pq-session-orb-wait" aria-label="Pause Queue">
              <Pause className="w-4 h-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              tabIndex={-1}
              className="pq-session-orb pq-session-orb-lock"
              aria-label="Close Queue to New Reservations"
            >
              <Lock className="w-4 h-4" aria-hidden="true" />
            </button>
            <button type="button" tabIndex={-1} className="pq-session-orb pq-session-orb-stop" aria-label="End Clinic Session">
              <Square className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </div>
        <div className="mt-3 flex flex-col gap-3 @2xl:flex-row @2xl:items-center">
          <button
            type="button"
            tabIndex={-1}
            data-tour="walkin-open"
            className="pq-btn-primary pq-btn-pill w-full @2xl:flex-1"
          >
            <UserPlus className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span className="whitespace-nowrap">Add Walk-in</span>
          </button>
          <button
            type="button"
            tabIndex={-1}
            data-tour="queue-request-checkin"
            className="pq-btn-secondary pq-btn-pill w-full @2xl:flex-1"
          >
            <UserCheck className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span className="whitespace-nowrap">Request Check-In</span>
          </button>
          <div className="pq-session-count @2xl:flex-1" role="status">
            <Users className="w-4 h-4" aria-hidden="true" />
            {sample.waiting.length} Total Active
          </div>
        </div>
      </section>

      <section className="pq-glass overflow-hidden">
        <div className="pq-now mx-0 rounded-none" style={{ borderRadius: 0, border: "none", borderBottom: "1px solid color-mix(in srgb, var(--pq-live) 18%, white)" }}>
          <h2 className="font-extrabold" style={{ color: "var(--pq-live)" }}>Current Consultation</h2>
        </div>
        <div className="p-8 text-center">
          <Stethoscope className="w-8 h-8 mx-auto mb-2 pq-faint" aria-hidden="true" />
          <p className="text-sm font-extrabold">No active consultation</p>
          <p className="text-xs pq-muted mt-0.5">The consultation room is currently empty.</p>
        </div>
      </section>

      <section className="pq-glass p-5" data-tour="queue-list">
        <h2 className="font-extrabold tracking-tight mb-4 flex items-center gap-2">
          <Clock className="w-4 h-4" style={{ color: "var(--pq-wait)" }} aria-hidden="true" />
          Waiting Queue <span className="pq-chip pq-chip-info">{sample.waiting.length}</span>
        </h2>
        <div className="space-y-2">
          {sample.waiting.map((res, idx) => (
            <div
              key={res.id}
              className={`pq-row ${idx === 0 ? "pq-row-you" : ""}`}
              style={{
                display: "grid",
                gridTemplateColumns: "3rem minmax(0, 1fr)",
                alignItems: "center",
                columnGap: "0.85rem",
                rowGap: "0.55rem",
              }}
            >
              <div
                className={`pq-queue-plate ${idx === 0 ? "pq-queue-plate-next" : ""}`}
                style={res.penalize || res.status === "checked_in" ? { gridRow: "1 / span 2" } : undefined}
              >
                {res.queueNumber}
              </div>
              <div className="min-w-0 flex items-center gap-2 flex-wrap">
                <h3 className="min-w-0 truncate font-extrabold">{res.childName}</h3>
                {res.source === "walk_in" && (
                  <span className="pq-chip pq-chip-wait self-start shrink-0">Walk-in</span>
                )}
                {res.forfeitLabel && (
                  <span className="pq-chip pq-chip-alert shrink-0">{res.forfeitLabel}</span>
                )}
                {statusBadge(res.status)}
              </div>
              {res.penalize && (
                <div className="flex items-center gap-2" style={{ gridColumn: "2 / -1" }} data-tour="queue-penalize">
                  <button type="button" tabIndex={-1} className="pq-btn-warn flex-1">
                    <AlertTriangle className="w-4 h-4" aria-hidden="true" />
                    Penalize
                  </button>
                </div>
              )}
              {res.status === "checked_in" && nextCheckedIn?.id === res.id && (
                <div className="flex items-center gap-2" style={{ gridColumn: "2 / -1" }} data-tour="queue-send-to-doctor">
                  <button type="button" tabIndex={-1} className="pq-btn-live flex-1">
                    <Stethoscope className="w-4 h-4" aria-hidden="true" />
                    Send to Doctor
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export function TourSampleWalkInModal() {
  const sample = SECRETARY_TOUR_SAMPLE_WALKIN;

  return (
    <div className="pq-tour-sample">
      <div
        className="pq-modal w-full max-w-lg mx-auto min-w-0 flex flex-col overflow-hidden pointer-events-none"
        data-tour="walkin-form"
      >
        <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-4" style={{ borderBottom: "1px solid var(--pq-glass-line)" }}>
          <h2 id="walkin-title" className="text-base sm:text-lg font-extrabold tracking-tight min-w-0 truncate">
            Add Walk-in
          </h2>
          <SampleFlag />
        </div>
        <div className="px-4 sm:px-6 py-5 space-y-5">
          <p className="text-[11px] font-semibold pq-muted">Tour preview — this form does not check anyone in.</p>
          <div className="pq-row min-h-0 flex-col items-stretch gap-1.5 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-extrabold tracking-tight truncate">{sample.scheduleLabel}</p>
              <p className="text-xs pq-muted">Active — joins the live line</p>
            </div>
            <span className="pq-chip pq-chip-info shrink-0">12/30 slots left</span>
          </div>
          <div
            className="space-y-3"
            style={{
              padding: "1rem",
              borderRadius: "0.9rem",
              background: "color-mix(in srgb, #ffffff 55%, transparent)",
              border: "1px solid var(--pq-glass-line)",
            }}
          >
            <div>
              <label className="pq-label">Child name</label>
              <input readOnly tabIndex={-1} value={sample.childName} className="pq-input" />
            </div>
            <div className="grid gap-3" style={{ gridTemplateColumns: "5.75rem minmax(0, 1fr)" }}>
              <div>
                <label className="pq-label">Age</label>
                <input readOnly tabIndex={-1} value={sample.childAge} className="pq-input" />
              </div>
              <div>
                <label className="pq-label">Sex</label>
                <input readOnly tabIndex={-1} value={sample.childSex} className="pq-input" />
              </div>
            </div>
          </div>
          <div>
            <label className="pq-label">Concern / reason</label>
            <textarea readOnly tabIndex={-1} value={sample.concern} rows={2} className="pq-input resize-none" />
          </div>
        </div>
        <div className="px-4 sm:px-6 py-4 flex gap-3" style={{ borderTop: "1px solid var(--pq-glass-line)" }}>
          <button type="button" tabIndex={-1} className="pq-btn-secondary flex-1">
            Cancel
          </button>
          <button type="button" tabIndex={-1} disabled className="pq-btn-primary flex-1">
            Check In Walk-in
          </button>
        </div>
      </div>
    </div>
  );
}

export function TourSampleValidate() {
  return (
    <div className="pq-tour-sample space-y-6 max-w-lg mx-auto relative pointer-events-none">
      <section className="pq-glass p-5 md:p-6 flex flex-col items-center text-center" data-tour="validate-qr">
        <div className="w-full flex justify-between items-center mb-3">
          <p className="text-[11px] font-semibold pq-muted">Tour preview — camera stays off</p>
          <SampleFlag />
        </div>
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3"
          style={{ background: "color-mix(in srgb, var(--pq-mark-blue) 12%, white)", color: "var(--pq-mark-blue)" }}
        >
          <QrCode className="w-7 h-7" aria-hidden="true" />
        </div>
        <h2 className="text-xl font-extrabold tracking-tight mb-1">Scan to Check In</h2>
        <p className="pq-muted text-sm mb-4">
          Point the camera at the patient&apos;s QR code, or type the code below.
        </p>
        <div
          className="w-full min-h-[180px] sm:min-h-[280px] overflow-hidden flex flex-col items-center justify-center mb-4 p-6 sm:p-8"
          style={{ background: "color-mix(in srgb, #ffffff 88%, var(--pq-paper))", borderRadius: "var(--pq-radius-sm)", border: "1px solid var(--pq-glass-line)" }}
        >
          <div className="w-44 h-44 sm:w-52 sm:h-52">
            <SampleQrGraphic caption="Placeholder QR — tour only" />
          </div>
        </div>
        <div className="w-full mt-2 pt-5 text-left" style={{ borderTop: "1px solid var(--pq-glass-line)" }}>
          <label className="pq-label">Or enter code manually</label>
          <input
            readOnly
            tabIndex={-1}
            value={SECRETARY_TOUR_SAMPLE_CODE}
            className="pq-input text-center font-mono text-xl tracking-[0.35em] uppercase"
          />
          <p className="mt-2 text-xs pq-faint text-center">
            This sample code is not validated and does not check anyone in.
          </p>
        </div>
      </section>
    </div>
  );
}

const SAMPLE_WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Compact sample grid — not a real month; enough to show Not posted / Posted / Past. */
function getSampleCalendarCells(clinicDateYmd) {
  const focusDay = Number(clinicDateYmd.slice(-2)) || 12;
  const cells = [null, null, null, null, null, null];
  for (let day = focusDay - 5; day <= focusDay + 8; day += 1) {
    if (day < 1) {
      cells.push(null);
      continue;
    }
    if (day === focusDay) {
      cells.push({ day, label: "Not posted", tone: "open", highlight: true });
    } else if (day === focusDay - 1) {
      cells.push({
        day,
        label: "12 left",
        tone: "posted",
        style: { background: "var(--pq-live-wash)", color: "var(--pq-live)" },
      });
    } else if (day < focusDay) {
      cells.push({ day, label: "Past", tone: "past" });
    } else {
      cells.push({ day, label: "Not posted", tone: "open" });
    }
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export function TourSampleSchedulePublish({
  showForm = false,
  publishTourId = "schedule-publish",
  formTourId = "schedule-form",
  lockBranch = true,
}) {
  const schedule = getSecretaryTourSampleSchedule();
  const monthLabel = formatSecretarySampleDate(schedule.clinicDate, {
    month: "long",
    year: "numeric",
  });
  const postDateLabel = formatSecretarySampleDate(schedule.clinicDate, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const cells = getSampleCalendarCells(schedule.clinicDate);

  return (
    <div className="pq-tour-sample w-full space-y-6 pointer-events-none">
      <p className="text-[11px] font-semibold pq-muted flex items-center gap-2">
        Tour preview — no day is posted
        <SampleFlag />
      </p>

      <section className="pq-glass p-4 sm:p-5" data-tour={publishTourId} aria-label="Schedule calendar sample">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg font-extrabold tracking-tight">Schedule calendar</h2>
            <p className="pq-muted text-sm">
              Post a day, a range, or copy last week. Open a posted day to start the queue or close the clinic.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {!lockBranch ? (
              <select className="pq-input" tabIndex={-1} aria-label="Branch" defaultValue={schedule.branch} disabled>
                <option value={schedule.branch}>{schedule.branch}</option>
              </select>
            ) : null}
            <button type="button" tabIndex={-1} className="pq-btn-secondary">
              Publish range
            </button>
            <button type="button" tabIndex={-1} className="pq-btn-secondary">
              Copy previous week
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between mb-3">
          <button type="button" tabIndex={-1} className="pq-btn-secondary" aria-label="Previous month">
            <ChevronLeft className="w-4 h-4" aria-hidden="true" />
          </button>
          <h3 className="font-extrabold">{monthLabel}</h3>
          <button type="button" tabIndex={-1} className="pq-btn-secondary" aria-label="Next month">
            <ChevronRight className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold pq-muted mb-1">
          {SAMPLE_WEEKDAYS.map((label) => (
            <div key={label}>{label}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((cell, index) => {
            if (!cell) return <div key={`blank-${index}`} />;
            return (
              <div
                key={`${cell.day}-${index}`}
                className="min-h-14 rounded-xl text-left p-1.5"
                style={{
                  background: cell.style?.background || "transparent",
                  color: cell.style?.color || (cell.tone === "past" ? "var(--pq-ink-faint)" : "var(--pq-ink)"),
                  border: cell.highlight
                    ? "2px solid var(--pq-mark-blue)"
                    : "1px solid var(--pq-glass-line)",
                }}
                aria-label={`Day ${cell.day}, ${cell.label}`}
              >
                <div className="text-sm font-extrabold">{cell.day}</div>
                <div className="text-[10px] leading-tight font-semibold">{cell.label}</div>
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-xs pq-muted flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          Hours come from your branch weekday schedule — you only set slots when posting.
        </p>
      </section>

      {showForm ? (
        <div
          className="pq-modal w-full max-w-sm mx-auto p-5 pointer-events-none"
          data-tour={formTourId}
          role="dialog"
          aria-modal="true"
          aria-labelledby="tour-post-day-title"
        >
          <div className="flex items-start justify-between gap-2 mb-1">
            <h3 id="tour-post-day-title" className="text-lg font-extrabold">
              Post {postDateLabel}
            </h3>
            <SampleFlag />
          </div>
          <p className="pq-muted text-sm mb-4">Parents can reserve as soon as this is posted.</p>
          <label className="pq-label" htmlFor="tour-day-capacity">
            Slots
          </label>
          <input
            id="tour-day-capacity"
            readOnly
            tabIndex={-1}
            value={String(schedule.slotCapacity)}
            className="pq-input mb-4"
          />
          <p className="text-[11px] pq-faint mb-4">
            Clinic hours stay {formatSecretarySampleTime(schedule.openingTime)}–
            {formatSecretarySampleTime(schedule.closingTime)} from the branch weekday config.
          </p>
          <div className="flex gap-2 justify-end">
            <button type="button" tabIndex={-1} className="pq-btn-secondary">
              Cancel
            </button>
            <button type="button" tabIndex={-1} disabled className="pq-btn-primary">
              Post day
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function TourSampleSettings({
  queueTourId = "settings-queue-rules",
  smsTourId = "settings-sms",
}) {
  return (
    <div className="pq-tour-sample space-y-6 max-w-3xl mx-auto pointer-events-none">
      <p className="text-[11px] font-semibold pq-muted flex items-center gap-2">
        Tour preview — settings are not saved
        <SampleFlag />
      </p>
      <section className="pq-glass overflow-hidden" data-tour={queueTourId}>
        <div className="p-5 sm:p-6" style={{ borderBottom: "1px solid var(--pq-glass-line)" }}>
          <h3 className="text-lg font-extrabold tracking-tight mb-1">Queue Rules</h3>
          <p className="pq-muted text-sm mb-5">Sample penalty rules for this branch only.</p>
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <span className="text-sm font-semibold">Penalty Move-Back</span>
              <input readOnly tabIndex={-1} value="2" className="pq-input w-full sm:w-24 text-center font-extrabold" />
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <span className="text-sm font-semibold">Penalty Grace (minutes)</span>
              <input readOnly tabIndex={-1} value="2" className="pq-input w-full sm:w-24 text-center font-extrabold" />
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <span className="text-sm font-semibold">Penalty Timer (minutes)</span>
              <input readOnly tabIndex={-1} value="15" className="pq-input w-full sm:w-24 text-center font-extrabold" />
            </div>
          </div>
        </div>
        <div className="px-5 py-4 flex justify-end">
          <button type="button" tabIndex={-1} disabled className="pq-btn-primary">
            Save Queue Rules
          </button>
        </div>
      </section>
      <section className="pq-glass overflow-hidden" data-tour={smsTourId}>
        <div className="p-5 sm:p-6">
          <h3 className="text-lg font-extrabold tracking-tight mb-1">SMS Notification Configuration</h3>
          <p className="pq-muted text-sm mb-4">Sample near-turn timing and templates for parents at this branch.</p>
          <label className="pq-label">Near Turn — Patients Ahead</label>
          <input readOnly tabIndex={-1} value="3" className="pq-input w-full sm:w-24 text-center font-extrabold mb-4" />
          <label className="pq-label">Near Turn Message</label>
          <textarea
            readOnly
            tabIndex={-1}
            rows={2}
            className="pq-input resize-none"
            value="You are near your turn. Please prepare to arrive at the clinic."
          />
        </div>
      </section>
    </div>
  );
}
