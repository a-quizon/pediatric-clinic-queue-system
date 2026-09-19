import { CalendarDays, CalendarPlus, Clock, MapPin, Stethoscope, Ticket as TicketIcon, Users, Building2, CheckCircle2, Baby } from "lucide-react";
import ReservationStatusBadge from "../common/ReservationStatusBadge";
import { formatBranchLabel } from "../../utils/stringUtils";
import {
  TOUR_SAMPLE_CHILD,
  TOUR_SAMPLE_CONCERN,
  formatSampleDate,
  formatSampleTime,
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

export function TourSampleScheduleList() {
  const schedules = getTourSampleSchedules();

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5" data-tour="reserve-schedule-list">
      {schedules.map((schedule, index) => (
        <div key={schedule.id} className="pq-glass p-5 flex flex-col">
          <div className="flex justify-between items-start mb-4 gap-2">
            <div className="flex flex-col min-w-0">
              <h3 className="text-lg font-bold flex items-center">
                <MapPin className="w-5 h-5 mr-2 pq-faint shrink-0" />
                {formatBranchLabel(schedule.branch)}
              </h3>
              <p className="text-xs pq-muted whitespace-pre-line ml-7 mt-0.5">
                {schedule.address}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1.5 shrink-0">
              <SampleFlag />
              <div className="pq-chip pq-chip-wait">
                <Clock className="w-3.5 h-3.5 mr-1.5" />
                Reservations Open
              </div>
            </div>
          </div>

          <div className="space-y-3 mb-6 flex-1">
            <div className="flex items-center text-sm">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center mr-3" style={{ background: "color-mix(in srgb, var(--pq-ink) 6%, white)" }}>
                <CalendarDays className="w-4 h-4 pq-muted" />
              </div>
              <span className="pq-muted font-medium">
                Date:{" "}
                <span>
                  {formatSampleDate(schedule.clinicDate, { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
                </span>
              </span>
            </div>
            <div className="flex items-center text-sm">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center mr-3" style={{ background: "color-mix(in srgb, var(--pq-ink) 6%, white)" }}>
                <Clock className="w-4 h-4 pq-muted" />
              </div>
              <span className="pq-muted font-medium">
                Clinic Hours: <span>{formatSampleTime(schedule.openingTime)} - {formatSampleTime(schedule.closingTime)}</span>
              </span>
            </div>
            <div className="flex items-center text-sm">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center mr-3" style={{ background: "color-mix(in srgb, var(--pq-ink) 6%, white)" }}>
                <Users className="w-4 h-4 pq-muted" />
              </div>
              <span className="pq-muted font-medium">
                Available Slots: <span className="font-bold">{schedule.availableSlots} / {schedule.slotCapacity}</span>
              </span>
            </div>
          </div>

          <button
            type="button"
            disabled
            tabIndex={-1}
            className="pq-btn-primary w-full py-2.5 font-bold rounded-[0.95rem] min-h-[44px] flex items-center justify-center opacity-90 pointer-events-none"
            data-tour={index === 0 ? "reserve-slot-cta" : undefined}
          >
            <CalendarPlus className="w-4 h-4 mr-2 flex-shrink-0" />
            Reserve Slot
          </button>
        </div>
      ))}
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
          <p className="text-[11px] font-bold pq-muted mb-2">Selected session</p>
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

export function TourSampleTicket() {
  const ticket = getTourSampleTicket();

  return (
    <div className="max-w-md mx-auto">
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
          <div className="pq-note pq-note-info mb-4 w-full text-center">
            <div className="text-xs font-bold mb-0.5">Clinic Check-In QR Pass</div>
            <div className="text-[11px] font-medium">
              This is the QR code you&apos;ll show at the clinic to check in. The graphic below is a tour placeholder, not a real scannable ticket.
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
        <p className="text-[11px] font-semibold pq-muted">Tour preview — sample sessions only</p>
      </div>
      <TourSampleScheduleList />
      {showForm ? <TourSampleReservationForm /> : null}
    </div>
  );
}
