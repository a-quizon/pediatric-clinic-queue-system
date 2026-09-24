import {
  AlertTriangle,
  Calendar,
  Clock,
  Lock,
  Pause,
  QrCode,
  Square,
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

  return (
    <div className="pq-tour-sample space-y-6 max-w-4xl mx-auto pointer-events-none">
      <p className="text-[11px] font-semibold pq-muted flex items-center gap-2">
        Tour preview — not a real queue
        <SampleFlag />
      </p>

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
                style={res.penalize ? { gridRow: "1 / span 2" } : undefined}
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

export function TourSampleSchedulePublish({
  showForm = false,
  publishTourId = "schedule-publish",
  formTourId = "schedule-form",
}) {
  const schedule = getSecretaryTourSampleSchedule();

  return (
    <div className="pq-tour-sample w-full space-y-6 pointer-events-none">
      <p className="text-[11px] font-semibold pq-muted flex items-center gap-2">
        Tour preview — no schedule is published
        <SampleFlag />
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        <div className="pq-glass p-5 flex flex-col h-full" data-tour={publishTourId}>
          <div className="mb-4">
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
              <h3 className="text-lg font-extrabold tracking-tight truncate">{schedule.branch}</h3>
              <span className="pq-chip shrink-0">Draft</span>
            </div>
            <p className="text-xs mt-1.5 pq-muted">{schedule.address}</p>
          </div>
          <div className="grid grid-cols-2 gap-y-3 mb-5">
            <div className="flex items-center text-sm">
              <Calendar className="w-4 h-4 mr-2 pq-faint" aria-hidden="true" />
              <span className="pq-muted">
                {formatSecretarySampleDate(schedule.clinicDate, { month: "short", day: "numeric", year: "numeric" })}
              </span>
            </div>
            <div className="flex items-center text-sm">
              <Clock className="w-4 h-4 mr-2 pq-faint" aria-hidden="true" />
              <span className="pq-muted">
                {formatSecretarySampleTime(schedule.openingTime)} - {formatSecretarySampleTime(schedule.closingTime)}
              </span>
            </div>
            <div className="flex items-center text-sm">
              <Users className="w-4 h-4 mr-2 pq-faint" aria-hidden="true" />
              <span className="pq-muted">
                Capacity: <span className="font-extrabold" style={{ color: "var(--pq-ink)" }}>{schedule.slotCapacity}</span>
              </span>
            </div>
          </div>
          <div className="mt-auto flex items-center gap-2 pt-4" style={{ borderTop: "1px solid var(--pq-glass-line)" }}>
            <button type="button" tabIndex={-1} className="pq-btn-secondary flex-1">Edit</button>
            <button type="button" tabIndex={-1} className="pq-btn-live flex-1">Publish</button>
          </div>
        </div>
      </div>

      {showForm ? (
        <div className="pq-glass overflow-hidden" data-tour={formTourId}>
          <div className="flex items-center justify-between p-5" style={{ borderBottom: "1px solid var(--pq-glass-line)" }}>
            <h2 className="text-lg font-extrabold tracking-tight">Create Schedule</h2>
            <SampleFlag />
          </div>
          <div className="p-6 space-y-4">
            <div>
              <label className="pq-label">Branch</label>
              <input readOnly tabIndex={-1} value={schedule.branch} className="pq-input" />
            </div>
            <div>
              <label className="pq-label">Clinic Date</label>
              <input readOnly tabIndex={-1} value={schedule.clinicDate} className="pq-input" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="pq-label">Opening Time</label>
                <input readOnly tabIndex={-1} value={schedule.openingTime} className="pq-input" />
              </div>
              <div>
                <label className="pq-label">Closing Time</label>
                <input readOnly tabIndex={-1} value={schedule.closingTime} className="pq-input" />
              </div>
            </div>
            <div>
              <label className="pq-label">Slot Capacity</label>
              <input readOnly tabIndex={-1} value={String(schedule.slotCapacity)} className="pq-input" />
            </div>
          </div>
          <div className="p-5 flex justify-end gap-3" style={{ borderTop: "1px solid var(--pq-glass-line)" }}>
            <button type="button" tabIndex={-1} className="pq-btn-secondary">Cancel</button>
            <button type="button" tabIndex={-1} disabled className="pq-btn-primary">Save Schedule</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
