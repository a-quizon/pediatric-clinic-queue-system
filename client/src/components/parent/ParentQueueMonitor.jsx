import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { Clock, Users, Building2, Stethoscope, CalendarDays } from "lucide-react";
import { ACTIVE_RESERVATION_STATUSES } from "../../services/reservationService";
import { isReservationExpired, formatRemainingTime } from "../../services/timeService";
import { getPenaltyTimerRemainingMs, hasActivePenaltyTimer } from "../../utils/penaltyTimer";
import ReservationStatusBadge from "../common/ReservationStatusBadge";
import { computeReservationState, computeAheadOfYou, QUEUE_STATES } from "../../services/queueEngine";
import { formatBranchLabel, branchesMatch } from "../../utils/stringUtils";
import { formatManilaLong } from "../../utils/manilaDate";
import { SESSION_STATUS } from "../../utils/currentParentSession";

const SESSION_CHIPS = {
  [SESSION_STATUS.ACTIVE]: { label: "Live session", className: "pq-chip pq-chip-live", pip: true },
  [SESSION_STATUS.WAITING]: { label: "Today", className: "pq-chip pq-chip-wait", pip: false },
  [SESSION_STATUS.UPCOMING]: { label: "Upcoming", className: "pq-chip pq-chip-info", pip: false },
};

const formatTime = (time) => {
  if (!time) return "";
  const [hours, minutes] = time.split(":");
  const h = parseInt(hours, 10);
  const ampm = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${minutes} ${ampm}`;
};

export default function ParentQueueMonitor({ session, scheduleReservations, branches }) {
  const { reservation: activeReservation, schedule, status: sessionStatus } = session;

  const [tick, setTick] = useState(0);
  const penaltyTimerActive = hasActivePenaltyTimer(activeReservation);
  useEffect(() => {
    if (activeReservation?.status !== "validation_open" && !penaltyTimerActive) return;
    const interval = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, [activeReservation?.status, penaltyTimerActive, activeReservation?.penaltyTimerExpiresAt]);

  const permanentQueueNumber = activeReservation.queueNumber || activeReservation.originalQueueNumber || 1;

  const { nowServing, patientsAhead, queueState, activeLine } = useMemo(() => {
    if (scheduleReservations.length === 0) {
      return { nowServing: null, patientsAhead: 0, queueState: null, activeLine: [] };
    }

    const scheduleRes = [...scheduleReservations].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    const resWithPNum = scheduleRes.map((r, idx) => ({ ...r, pNum: r.queueNumber || r.originalQueueNumber || (idx + 1) }));

    const inConsultation = resWithPNum.find(r => r.status === "in_consultation" || r.status === "with_doctor");

    const line = resWithPNum
      .filter(r => ACTIVE_RESERVATION_STATUSES.includes(r.status))
      .sort((a, b) => {
        if (a.queueOrder !== undefined && b.queueOrder !== undefined) {
          return a.queueOrder - b.queueOrder;
        }
        const timeA = a.sortTimestamp || a.createdAt || 0;
        const timeB = b.sortTimestamp || b.createdAt || 0;
        return timeA - timeB;
      });

    return {
      nowServing: inConsultation || null,
      patientsAhead: computeAheadOfYou(activeReservation, scheduleReservations),
      queueState: computeReservationState(activeReservation, scheduleReservations),
      activeLine: line,
    };
  }, [scheduleReservations, activeReservation]);

  const isExpired = useMemo(() => isReservationExpired(activeReservation, schedule), [activeReservation, schedule]);
  const effectiveStatus = isExpired ? "expired" : activeReservation.status;

  const waitingKeys = activeLine.filter((r) => !["in_consultation", "with_doctor"].includes(r.status));
  const guideFirst = waitingKeys[0]?.pNum;
  const guideLast = waitingKeys[waitingKeys.length - 1]?.pNum;
  const penaltyRemainingMs = tick >= 0 ? getPenaltyTimerRemainingMs(activeReservation) : 0;

  const chip = SESSION_CHIPS[sessionStatus] || SESSION_CHIPS[SESSION_STATUS.UPCOMING];
  const timeRange = [formatTime(schedule.openingTime), formatTime(schedule.closingTime)].filter(Boolean).join(" - ");

  return (
    <div className="space-y-4">
      <section className="pq-glass overflow-hidden" data-tour="parent-queue-monitor">
        <div className="px-4 pt-4 flex flex-wrap items-center justify-between gap-2">
          <span className={`${chip.className} shrink-0`}>
            {chip.pip && <span className="pq-pip" />}
            {chip.label}
          </span>
          <span className="flex items-center gap-1.5 text-[11px] font-semibold pq-muted">
            <CalendarDays className="w-3.5 h-3.5" />
            {formatManilaLong(schedule.clinicDate)}
            {timeRange && ` · ${timeRange}`}
          </span>
        </div>

        <div className="p-4 flex justify-between items-start gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: "color-mix(in srgb, var(--pq-mark-blue) 12%, white)", color: "var(--pq-mark-blue-deep)" }}>
              <Building2 className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="font-bold text-sm leading-tight">
                {schedule.branch || "Velasquez Pediatric Clinic"}
                {!schedule.branch?.toLowerCase().includes('clinic') && " Clinic"}
              </h2>
              <span className="text-[11px] font-semibold block leading-tight mt-0.5" style={{ color: "var(--pq-mark-blue-deep)" }}>
                {formatBranchLabel(schedule.branch)}
              </span>
              <span className="text-[10px] pq-muted block truncate max-w-[150px] sm:max-w-[200px] leading-tight mt-0.5">
                {branches.find(b => branchesMatch(b.name, schedule.branch) || b.id === schedule.branchId)?.clinicAddress || "Magalang Road, Angeles City, Pampanga"}
              </span>
            </div>
          </div>
          <div className="text-right shrink-0 pl-3" style={{ borderLeft: "1px solid var(--pq-glass-line)" }}>
            <div className="flex items-center justify-end gap-1 mb-0.5" style={{ color: "var(--pq-mark-blue-deep)" }}>
              <Clock className="w-3.5 h-3.5" />
              <span className="text-[11px] font-bold">Clinic Hours</span>
            </div>
            <div className="text-[10px] pq-muted leading-tight">
              {timeRange || "8:00 AM - 5:00 PM"}
            </div>
          </div>
        </div>

        {penaltyRemainingMs > 0 && (
          <div className="mx-4 mb-3 pq-note pq-note-alert text-sm">
            <p className="font-extrabold">Validate your QR at the desk</p>
            <p className="mt-0.5 font-medium">
              You were marked late. Check in within {formatRemainingTime(penaltyRemainingMs)} or this reservation will be forfeited.
            </p>
          </div>
        )}

        <Link to={`/parent/reservations/${activeReservation.id}/qr`} className="pq-ticket block">
          <div className="pq-ticket-num">
            <div className="text-[11px] font-bold mb-1" style={{ color: "var(--pq-mark-blue-deep)" }}>My Queue Number</div>
            <div className="pq-num text-5xl sm:text-6xl" style={{ color: "var(--pq-mark-blue-deep)" }}>
              {permanentQueueNumber || "-"}
            </div>
            <p className="text-[10px] sm:text-xs font-medium mt-2 leading-snug">
              {(() => {
                if (queueState === QUEUE_STATES.WITH_DOCTOR || activeReservation.status === 'in_consultation' || activeReservation.status === 'with_doctor') return "You're currently with the doctor.";
                if (queueState === QUEUE_STATES.YOU_ARE_NEXT) return "You're Next — Please be ready.";
                if (queueState === QUEUE_STATES.ALMOST_NEXT) return "Your turn is approaching.";
                if (activeReservation.status === 'completed' || activeReservation.status === 'consultation_completed') return "Consultation completed.";
                if (sessionStatus !== SESSION_STATUS.ACTIVE) return "The queue starts once the clinic opens this session.";
                return "Please wait for your turn.";
              })()}
            </p>
            <div className="mt-3 flex justify-center">
              <ReservationStatusBadge status={queueState || effectiveStatus} className="shadow-xs px-3 py-1 text-[10px] sm:text-xs font-bold" />
            </div>
          </div>
          <div className="pq-ticket-ahead flex flex-col items-center justify-center">
            <div className="text-[11px] font-bold mb-1" style={{ color: "var(--pq-wait)" }}>Patients Ahead</div>
            <div className="pq-num text-5xl sm:text-6xl">
              {["in_consultation", "with_doctor"].includes(activeReservation.status) || queueState === QUEUE_STATES.WITH_DOCTOR || activeReservation.status === "consultation_completed"
                  ? "0"
                  : patientsAhead}
            </div>
            <div className="flex items-center justify-center gap-1.5 mt-2">
              <Users className="w-3.5 h-3.5" style={{ color: "var(--pq-wait)" }} />
              <span className="text-[10px] sm:text-xs font-medium pq-muted">ahead of you</span>
            </div>
          </div>
        </Link>

        <div className="p-4 pt-3">
          <div className="pq-now">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-11 h-11 rounded-full flex items-center justify-center shrink-0" style={{ background: "color-mix(in srgb, var(--pq-live) 16%, white)", color: "var(--pq-live)" }}>
                <Stethoscope className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold leading-tight">Now Serving</h3>
                <div className="pq-num text-2xl leading-none mt-0.5">
                  {nowServing ? `Queue #${nowServing.pNum}` : "—"}
                </div>
              </div>
            </div>
            {nowServing && (
              <div className="pq-chip pq-chip-live shrink-0">
                {['with_doctor', 'in_consultation'].includes(nowServing.status) ? 'WITH DOCTOR' : 'IN PROGRESS'}
                <span className="pq-pip" />
              </div>
            )}
          </div>
          {nowServing && nowServing.id === activeReservation.id && (
            <p className="text-center text-xs font-bold mt-2" style={{ color: "var(--pq-live)" }}>You're in consultation</p>
          )}
        </div>

        <div className="px-4 pb-4">
          <div className="flex items-baseline justify-between gap-2 mb-3">
            <h2 className="text-sm font-bold">Waiting Queue</h2>
            {waitingKeys.length > 0 && (
              <span className="text-[11px] font-semibold pq-muted">#{guideFirst}–#{guideLast}</span>
            )}
          </div>
          {waitingKeys.length > 0 ? (
            <div className="pq-wait-row">
              {waitingKeys.map((r) => {
                const isYou = r.id === activeReservation.id;
                return (
                  <div key={r.id} className={`pq-wait-key ${isYou ? "pq-wait-key-you" : ""}`}>
                    <div className="pq-num text-lg">{r.pNum}</div>
                    <div className="text-[10px] font-semibold mt-0.5">{isYou ? "You" : "In Queue"}</div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm pq-muted text-center py-3">No one is currently waiting.</p>
          )}
        </div>
      </section>

      <p className="text-center text-[10px] pq-faint font-medium">
        Real-time updates may vary depending on internet connection.
      </p>
    </div>
  );
}
