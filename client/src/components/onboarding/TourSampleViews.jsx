import { CalendarDays, CalendarPlus, Clock, MapPin, Stethoscope, Ticket as TicketIcon, Users, Building2, CheckCircle2, Baby, AlertCircle, ChevronLeft, ChevronRight } from "lucide-react";
import ReservationStatusBadge from "../common/ReservationStatusBadge";
import { formatBranchLabel } from "../../utils/stringUtils";
import {
  TOUR_SAMPLE_CHILD,
  TOUR_SAMPLE_CONCERN,
  TOUR_SAMPLE_WEEKDAYS,
  formatSampleDate,
  formatSampleTime,
  getParentTourSampleCalendarCells,
  getTourSampleQueue,
  getTourSampleSchedules,
  getTourSampleTicket,
} from "./tourSampleData";

function SampleFlag() {
  return (
    <span className="pq-tour-sample-flag">Sample</span>
  );
}

export function SampleQrGraphic({ caption = "Placeholder QR — tour only" }) {
  const finder = (x, y) => (
    <g transform={`translate(${x} ${y})`}>
      <rect width="7" height="7" fill="#16344a" />
      <rect x="1" y="1" width="5" height="5" fill="#f7fbfb" />
      <rect x="2" y="2" width="3" height="3" fill="#16344a" />
    </g>
  );

  const dots = [
    [9, 1], [11, 2], [13, 1], [15, 3], [9, 4], [12, 5], [16, 5],
    [1, 9], [3, 10], [2, 12], [5, 13], [1, 15], [4, 16],
    [9, 9], [11, 11], [14, 10], [16, 12], [10, 14], [13, 15], [15, 16],
    [8, 8], [12, 8], [8, 12], [16, 8], [8, 16],
  ];

  return (
    <div className="pq-tour-sample-qr" data-tour="sample-qr" aria-hidden="true">
      <svg viewBox="0 0 21 21" className="w-full h-full" role="img" aria-label={caption}>
        <rect width="21" height="21" fill="#f7fbfb" />
        {finder(1, 1)}
        {finder(13, 1)}
        {finder(1, 13)}
        {dots.map(([x, y]) => (
          <rect key={`${x}-${y}`} x={x} y={y} width="1.15" height="1.15" fill="#16344a" />
        ))}
      </svg>
      <span className="pq-tour-sample-qr-stamp">SAMPLE</span>
    </div>
  );
}

export function TourSampleQueueMonitor() {
  const sample = getTourSampleQueue();

  return (
    <div className="space-y-4">
      <section className="pq-glass overflow-hidden" data-tour="parent-queue-monitor">
        <div className="px-4 pt-4 flex justify-between items-center gap-2">
          <p className="text-[11px] font-semibold pq-muted">Tour preview — not a real reservation</p>
          <SampleFlag />
        </div>
        <div className="p-4 flex justify-between items-start gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: "color-mix(in srgb, var(--pq-mark-blue) 12%, white)", color: "var(--pq-mark-blue-deep)" }}>
              <Building2 className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="font-bold text-sm leading-tight">{sample.branch}</h2>
              <span className="text-[11px] font-semibold block leading-tight mt-0.5" style={{ color: "var(--pq-mark-blue-deep)" }}>
                {formatBranchLabel(sample.branch)}
              </span>
              <span className="text-[10px] pq-muted block truncate max-w-[150px] sm:max-w-[200px] leading-tight mt-0.5">
                {sample.address}
              </span>
            </div>
          </div>
          <div className="text-right shrink-0 pl-3" style={{ borderLeft: "1px solid var(--pq-glass-line)" }}>
            <div className="flex items-center justify-end gap-1 mb-0.5" style={{ color: "var(--pq-mark-blue-deep)" }}>
              <Clock className="w-3.5 h-3.5" />
              <span className="text-[11px] font-bold">Clinic Hours</span>
            </div>
            <div className="text-[10px] font-semibold leading-tight">
              {formatSampleDate(sample.clinicDate, { month: "short", day: "numeric", year: "numeric" })}
            </div>
            <div className="text-[10px] pq-muted leading-tight">{sample.openingTime}</div>
          </div>
        </div>

        <div className="pq-ticket">
          <div className="pq-ticket-num">
            <div className="text-[11px] font-bold mb-1" style={{ color: "var(--pq-mark-blue-deep)" }}>My Queue Number</div>
            <div className="pq-num text-5xl sm:text-6xl" style={{ color: "var(--pq-mark-blue-deep)" }}>
              {sample.queueNumber}
            </div>
            <p className="text-[10px] sm:text-xs font-medium mt-2 leading-snug">Please wait for your turn.</p>
            <div className="mt-3 flex justify-center">
              <ReservationStatusBadge status="WAITING" className="shadow-xs px-3 py-1 text-[10px] sm:text-xs font-bold" />
            </div>
          </div>
          <div className="pq-ticket-ahead flex flex-col items-center justify-center">
            <div className="text-[11px] font-bold mb-1" style={{ color: "var(--pq-wait)" }}>Patients Ahead</div>
            <div className="pq-num text-5xl sm:text-6xl">{sample.patientsAhead}</div>
            <div className="flex items-center justify-center gap-1.5 mt-2">
              <Users className="w-3.5 h-3.5" style={{ color: "var(--pq-wait)" }} />
              <span className="text-[10px] sm:text-xs font-medium pq-muted">ahead of you</span>
            </div>
          </div>
        </div>

        <div className="p-4 pt-3">
          <div className="pq-now">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-11 h-11 rounded-full flex items-center justify-center shrink-0" style={{ background: "color-mix(in srgb, var(--pq-live) 16%, white)", color: "var(--pq-live)" }}>
                <Stethoscope className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold leading-tight">Now Serving</h3>
                <div className="pq-num text-2xl leading-none mt-0.5">Queue #{sample.nowServing}</div>
              </div>
            </div>
            <div className="pq-chip pq-chip-live shrink-0">
              IN PROGRESS
              <span className="pq-pip" />
            </div>
          </div>
        </div>

        <div className="px-4 pb-4">
          <div className="flex items-baseline justify-between gap-2 mb-3">
            <h2 className="text-sm font-bold">Waiting Queue</h2>
            <span className="text-[11px] font-semibold pq-muted">#13–#01</span>
          </div>
          <div className="pq-wait-row">
            {sample.waiting.map((r) => (
              <div key={r.id} className={`pq-wait-key ${r.you ? "pq-wait-key-you" : ""}`}>
                <div className="pq-num text-lg">{r.pNum}</div>
                <div className="text-[10px] font-semibold mt-0.5">{r.you ? "You" : "In Queue"}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
      <p className="text-center text-[10px] pq-faint font-medium">
        Sample layout only. Your real Home screen stays empty until you book.
      </p>
    </div>
  );
}

export function TourSampleReserveCalendar() {
  const schedule = getTourSampleSchedules()[0];
  const monthLabel = formatSampleDate(schedule.clinicDate, { month: "long", year: "numeric" });
  const cells = getParentTourSampleCalendarCells(schedule.clinicDate);
  const nextLabel = formatSampleDate(schedule.clinicDate, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  return (
    <div className="space-y-4" data-tour="reserve-schedule-calendar">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <h2 className="text-lg font-extrabold tracking-tight">Reserve a slot</h2>
          <SampleFlag />
        </div>
        <select
          className="pq-input sm:max-w-xs pointer-events-none"
          aria-label="Clinic branch"
          tabIndex={-1}
          defaultValue={schedule.branch}
          disabled
        >
          <option value={schedule.branch}>{formatBranchLabel(schedule.branch)}</option>
        </select>
      </div>

      <section className="pq-glass p-4">
        <p className="pq-stat-label mb-1">Current active queue for today</p>
        <p className="pq-muted text-sm">No active queue right now.</p>
      </section>

      <section className="pq-glass p-4">
        <p className="pq-stat-label mb-1">Next queue session</p>
        <p className="font-semibold">
          {nextLabel}
          {" · "}
          {formatSampleTime(schedule.openingTime)} – {formatSampleTime(schedule.closingTime)}
        </p>
      </section>

      <section className="pq-glass p-4" data-tour="reserve-schedule-list">
        <div className="flex items-center justify-between mb-3">
          <button type="button" tabIndex={-1} className="pq-btn-secondary" aria-label="Previous month">
            <ChevronLeft className="w-4 h-4" aria-hidden="true" />
          </button>
          <h3 className="font-extrabold">{monthLabel}</h3>
          <button type="button" tabIndex={-1} className="pq-btn-secondary" aria-label="Next month">
            <ChevronRight className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
        <div className="flex flex-wrap gap-3 text-xs font-semibold mb-3">
          <span style={{ color: "var(--pq-live)" }}>Green: slots left</span>
          <span style={{ color: "var(--pq-alert)" }}>Red: full</span>
          <span style={{ color: "var(--pq-mark-blue)" }}>Your reservation</span>
          <span style={{ color: "var(--pq-wait)" }}>Closed</span>
          <span className="pq-muted">Muted: no session or past</span>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold pq-muted mb-1">
          {TOUR_SAMPLE_WEEKDAYS.map((label) => (
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
                  color: cell.style?.color || (cell.kind === "past" ? "var(--pq-ink-faint)" : "var(--pq-ink)"),
                  border: cell.highlight
                    ? "2px solid var(--pq-mark-blue)"
                    : "1px solid var(--pq-glass-line)",
                }}
                aria-label={`Day ${cell.day}, ${cell.label || "No session"}`}
                data-tour={cell.highlight ? "reserve-slot-cta" : undefined}
              >
                <div className="text-sm font-extrabold">{cell.day}</div>
                <div className="text-[10px] leading-tight font-semibold">{cell.label}</div>
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-xs pq-muted">
          Sample calendar only — tapping a green day in the real app starts a reservation. Nothing is saved here.
        </p>
      </section>
    </div>
  );
}

export function TourSampleReservationForm() {
  const schedule = getTourSampleSchedules()[0];

  return (
    <div className="pq-glass overflow-hidden mt-5" data-tour="reserve-patient-form">
      <div className="flex justify-between items-center p-5" style={{ borderBottom: "1px solid var(--pq-glass-line)" }}>
        <h2 className="text-lg font-bold">Select Patients</h2>
        <SampleFlag />
      </div>

      <div className="p-6">
        <div className="flex items-start pq-note pq-note-info mb-5">
          <CheckCircle2 className="w-5 h-5 mr-3 mt-0.5 flex-shrink-0" />
          <p className="text-sm font-medium">
            Walkthrough only — this form does not save or create a reservation.
          </p>
        </div>

        <div className="pq-row flex-col items-stretch text-left p-4 mb-5">
          <p className="text-[11px] font-bold pq-muted mb-2">Selected clinic day</p>
          <p className="text-sm font-bold">{formatBranchLabel(schedule.branch)}</p>
          <p className="text-xs pq-muted mt-1">
            {formatSampleDate(schedule.clinicDate, { weekday: "short", month: "short", day: "numeric" })}
            {" · "}
            {formatSampleTime(schedule.openingTime)}–{formatSampleTime(schedule.closingTime)}
          </p>
        </div>

        <div className="space-y-4 pointer-events-none">
          <div>
            <label className="block text-sm font-medium mb-2">Who is this reservation for? *</label>
            <label className="pq-row pq-row-start pq-row-you w-full cursor-pointer text-left">
              <input type="checkbox" checked readOnly onChange={() => {}} className="w-4 h-4 shrink-0 rounded" />
              <span className="min-w-0 flex-1 text-left">
                <span className="block text-sm font-bold truncate">{TOUR_SAMPLE_CHILD.childName}</span>
                <span className="block text-xs pq-muted">{TOUR_SAMPLE_CHILD.age} • {TOUR_SAMPLE_CHILD.sex}</span>
              </span>
            </label>
          </div>
          <div>
            <label className="pq-label">Concern / Reason for Visit</label>
            <textarea
              readOnly
              value={TOUR_SAMPLE_CONCERN}
              rows={3}
              className="pq-input resize-none"
            />
          </div>
        </div>
      </div>

      <div className="p-5 flex gap-3 justify-end pointer-events-none" style={{ borderTop: "1px solid var(--pq-glass-line)" }}>
        <button type="button" tabIndex={-1} className="pq-btn-secondary w-full sm:w-auto text-sm">
          Cancel Reservation
        </button>
        <button type="button" tabIndex={-1} className="pq-btn-primary w-full text-sm">
          Save Information
        </button>
      </div>
    </div>
  );
}

export function TourSampleLateRules() {
  return (
    <div
      className="pq-glass p-5 max-w-md mx-auto"
      data-tour="parent-late-rules"
      role="note"
      aria-label="Late arrival rules sample"
    >
      <div className="flex justify-between items-start gap-2 mb-3">
        <div className="flex items-start gap-3 min-w-0">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: "color-mix(in srgb, var(--pq-wait) 16%, white)", color: "var(--pq-wait)" }}
          >
            <AlertCircle className="w-5 h-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h3 className="font-extrabold text-sm leading-tight">Late arrival &amp; forfeited slots</h3>
            <p className="text-[11px] pq-muted mt-0.5">Sample explanation — tour only</p>
          </div>
        </div>
        <SampleFlag />
      </div>
      <ul className="list-disc pl-5 space-y-2 text-sm leading-relaxed pq-muted">
        <li>If you are next and not at the clinic, staff may mark you late after a short grace period.</li>
        <li>You may be moved back in line and given time to show your QR code or reservation code.</li>
        <li>If that time runs out, the reservation is forfeited so another family can use the slot.</li>
      </ul>
    </div>
  );
}

export function TourSampleTicket() {
  const ticket = getTourSampleTicket();

  return (
    <div className="max-w-md mx-auto space-y-4">
      <div className="pq-glass overflow-hidden" data-tour="reservation-list">
        <div className="p-6 sm:p-7 relative" style={{ background: "color-mix(in srgb, var(--pq-mark-blue) 16%, transparent)" }}>
          <div className="flex justify-between items-start gap-3">
            <div>
              <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
                Queue #{ticket.queueNumber}
              </h2>
              <p className="text-[11px] font-bold pq-muted mt-1">Sample reservation ticket</p>
            </div>
            <SampleFlag />
          </div>

          <div className="mt-5 pt-5 grid grid-cols-2 gap-3 text-xs" style={{ borderTop: "1px solid var(--pq-glass-line)" }}>
            <div>
              <div className="pq-muted font-semibold mb-0.5">Clinic Branch</div>
              <div className="font-bold text-sm flex items-center truncate">
                <MapPin className="w-3.5 h-3.5 mr-1.5 shrink-0" style={{ color: "var(--pq-mark-blue)" }} />
                {ticket.branch}
              </div>
            </div>
            <div className="text-right">
              <div className="pq-muted font-semibold mb-0.5">Date & Time</div>
              <div className="font-bold text-sm">
                {formatSampleDate(ticket.clinicDate, { month: "short", day: "numeric", year: "numeric" })}
                {" · "}
                {formatSampleTime(ticket.openingTime)}
              </div>
            </div>
          </div>
        </div>

        <div className="relative flex items-center justify-between px-2 py-3">
          <div className="w-6 h-6 rounded-full -ml-5" style={{ background: "var(--pq-paper)" }}></div>
          <div className="flex-1 border-t border-dashed mx-2" style={{ borderColor: "var(--pq-glass-line)" }}></div>
          <div className="w-6 h-6 rounded-full -mr-5" style={{ background: "var(--pq-paper)" }}></div>
        </div>

        <div className="px-6 sm:px-8 py-4 text-center flex flex-col items-center">
          <div className="pq-note pq-note-info mb-4 w-full text-center" data-tour="ticket-qr-hint">
            <div className="text-xs font-bold mb-0.5">Clinic Check-In QR Pass</div>
            <div className="text-[11px] font-medium">
              Show this QR code at the clinic to confirm you arrived and keep your queue slot. The graphic below is a tour placeholder, not a real scannable ticket.
            </div>
          </div>

          <div className="pq-row mb-4 w-52 h-52 sm:w-56 sm:h-56 flex items-center justify-center p-4">
            <SampleQrGraphic />
          </div>

          <span className="text-[11px] font-bold pq-muted">Reservation Code</span>
          <div className="text-3xl font-extrabold tracking-wider mt-0.5 font-mono">
            {ticket.reservationCode}
          </div>
          <p className="text-[10px] pq-muted mt-3 flex items-center justify-center gap-1.5">
            <TicketIcon className="w-3.5 h-3.5" />
            Not saved to your account
          </p>
        </div>
      </div>
    </div>
  );
}

export function TourSampleSchedulesBlock({ showForm }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Baby className="w-4 h-4 pq-muted" />
        <p className="text-[11px] font-semibold pq-muted">Tour preview — sample calendar only</p>
      </div>
      <TourSampleReserveCalendar />
      {showForm ? <TourSampleReservationForm /> : null}
    </div>
  );
}
