import React from 'react';
import { X, MapPin, CalendarDays, Clock, User, FileText, Activity, Hash } from 'lucide-react';
import ReservationStatusBadge from '../common/ReservationStatusBadge';
import { getReservationChildren } from '../../utils/reservationPatients';
import { useHistoryOverlay } from '../../hooks/useHistoryOverlay';

export default function ReservationDetailsModal({ isOpen, onClose, reservation, schedule, clinicAddress }) {
  useHistoryOverlay(Boolean(isOpen && reservation), onClose);
  if (!isOpen || !reservation) return null;

  const sched = schedule || {};
  const status = reservation.status || 'unknown';

  const formatTime = (timeStr) => {
    if (!timeStr) return 'N/A';
    const [hours, minutes] = timeStr.split(':');
    const h = parseInt(hours, 10);
    if (isNaN(h)) return timeStr;
    const ampm = h >= 12 ? 'PM' : 'AM';
    const formattedH = h % 12 || 12;
    return `${formattedH}:${minutes} ${ampm}`;
  };

  const formatDateTime = (timestamp) => {
    if (!timestamp) return null;
    try {
      return new Date(timestamp).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true
      });
    } catch {
      return null;
    }
  };

  const formatDateOnly = (dateStr) => {
    if (!dateStr) return 'N/A';
    try {
      return new Date(dateStr).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric"
      });
    } catch {
      return dateStr;
    }
  };

  const formatDayOnly = (dateStr) => {
    if (!dateStr) return 'N/A';
    try {
      return new Date(dateStr).toLocaleDateString("en-US", {
        weekday: "long"
      });
    } catch {
      return 'N/A';
    }
  };

  const queueNum = reservation.pNum || reservation.queuePosition || reservation.queueNumber || null;
  const hasNotes = !!reservation.doctorNotes && reservation.doctorNotes.trim() !== "";

  // Timeline events
  const timelineEvents = [
    { label: "Reserved", time: formatDateTime(reservation.createdAt) },
    { label: "Checked In", time: formatDateTime(reservation.checkedInAt || reservation.validatedAt) },
    { label: "In Consultation", time: formatDateTime(reservation.inConsultationAt || reservation.consultationStartedAt) },
  ];

  if (['completed', 'consultation_completed'].includes(status)) {
    timelineEvents.push({ label: "Completed", time: formatDateTime(reservation.consultationCompletedAt || reservation.completedAt) });
  } else if (status === 'cancelled') {
    timelineEvents.push({ label: "Cancelled", time: formatDateTime(reservation.cancelledAt) });
  } else if (status === 'expired') {
    timelineEvents.push({ label: "Expired", time: formatDateTime(reservation.expiredAt) });
  } else if (['forfeited', 'penalized', 'late_limit_reached'].includes(status)) {
    timelineEvents.push({ label: "Forfeited", time: formatDateTime(reservation.forfeitedAt || reservation.penalizedAt) });
  }

  return (
    <div className="pq-modal-scrim">
      <div className="pq-modal w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center px-6 py-5" style={{ borderBottom: "1px solid var(--pq-glass-line)" }}>
          <div>
            <h2 className="text-lg font-bold">Reservation Details</h2>
            <p className="text-xs pq-muted mt-0.5">Complete record of your clinic reservation</p>
          </div>
          <button 
            onClick={onClose} 
            className="pq-icon-btn"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto space-y-6" style={{ borderColor: "var(--pq-glass-line)" }}>
          <div className="flex items-center justify-between pt-1">
            <span className="text-xs font-bold pq-muted">Status</span>
            <ReservationStatusBadge status={status} className="px-3.5 py-1" />
          </div>

          {['forfeited', 'penalized', 'late_limit_reached'].includes(status) && (
            <div>
              <div className="pq-note pq-note-alert text-xs">
                <div className="font-bold mb-0.5">Reason:</div>
                <div className="font-medium">
                  {reservation.forfeitureReason || "Did not check in on time."}
                </div>
              </div>
            </div>
          )}

          <div className="space-y-3" style={{ borderTop: "1px solid var(--pq-glass-line)", paddingTop: "1.25rem" }}>
            <div className="flex items-center text-xs font-bold pq-muted mb-2">
              <User className="w-3.5 h-3.5 mr-1.5" style={{ color: "var(--pq-mark-blue)" }} />
              Patient Information
            </div>
            <div className="pq-row flex-col items-stretch p-4 space-y-3 text-sm">
              {getReservationChildren(reservation).length > 0 ? (
                getReservationChildren(reservation).map((child, index) => (
                  <div key={child.childId || index} className="grid grid-cols-3 gap-3">
                    <div className="col-span-3 sm:col-span-1">
                      <span className="text-xs pq-muted block mb-0.5">Child Name</span>
                      <span className="font-bold break-words">{child.childName || "N/A"}</span>
                    </div>
                    <div>
                      <span className="text-xs pq-muted block mb-0.5">Age</span>
                      <span className="font-semibold">{child.age || "N/A"}</span>
                    </div>
                    <div>
                      <span className="text-xs pq-muted block mb-0.5">Sex</span>
                      <span className="font-semibold">{child.sex || "N/A"}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-3 sm:col-span-1">
                    <span className="text-xs pq-muted block mb-0.5">Child Name</span>
                    <span className="font-bold break-words">N/A</span>
                  </div>
                  <div>
                    <span className="text-xs pq-muted block mb-0.5">Age</span>
                    <span className="font-semibold">N/A</span>
                  </div>
                  <div>
                    <span className="text-xs pq-muted block mb-0.5">Sex</span>
                    <span className="font-semibold">N/A</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-3" style={{ borderTop: "1px solid var(--pq-glass-line)", paddingTop: "1.25rem" }}>
            <div className="flex items-center text-xs font-bold pq-muted mb-2">
              <CalendarDays className="w-3.5 h-3.5 mr-1.5" style={{ color: "var(--pq-mark-blue)" }} />
              Schedule
            </div>
            <div className="p-4 space-y-3 text-sm rounded-[0.9rem]" style={{ background: "color-mix(in srgb, #ffffff 55%, transparent)", border: "1px solid var(--pq-glass-line)" }}>
              <div className="grid grid-cols-2 gap-y-3 gap-x-4">
              <div>
                <span className="text-xs pq-muted block mb-0.5 flex items-center">
                  <MapPin className="w-3 h-3 mr-1 inline" style={{ color: "var(--pq-mark-coral)" }} /> Branch
                </span>
                <span className="font-bold block">{sched.branch || "Unknown Branch"}</span>
                {clinicAddress && (
                  <span className="text-[10px] pq-muted block mt-0.5 leading-snug pr-2">
                    {clinicAddress}
                  </span>
                )}
              </div>
              <div>
                <span className="text-xs pq-muted block mb-0.5 flex items-center">
                  <Clock className="w-3 h-3 mr-1 inline" style={{ color: "var(--pq-mark-blue)" }} /> Time
                </span>
                <span className="font-semibold">
                  {sched.openingTime && sched.closingTime 
                    ? `${formatTime(sched.openingTime)} - ${formatTime(sched.closingTime)}`
                    : "N/A"}
                </span>
              </div>
              <div>
                <span className="text-xs pq-muted block mb-0.5">Date</span>
                <span className="font-semibold">{formatDateOnly(sched.clinicDate)}</span>
              </div>
              <div>
                <span className="text-xs pq-muted block mb-0.5">Day</span>
                <span className="font-semibold">{formatDayOnly(sched.clinicDate)}</span>
              </div>
              </div>
            </div>
          </div>

          <div className="space-y-3" style={{ borderTop: "1px solid var(--pq-glass-line)", paddingTop: "1.25rem" }}>
            <div className="flex items-center text-xs font-bold pq-muted mb-2">
              <Hash className="w-3.5 h-3.5 mr-1.5" style={{ color: "var(--pq-mark-blue)" }} />
              Queue Information
            </div>
            <div className="p-4 grid grid-cols-2 gap-4 text-sm rounded-[0.9rem]" style={{ background: "color-mix(in srgb, #ffffff 55%, transparent)", border: "1px solid var(--pq-glass-line)" }}>
              <div>
                <span className="text-xs pq-muted block mb-0.5">Queue Number</span>
                <span className="text-lg font-extrabold pq-num" style={{ color: "var(--pq-mark-blue-deep)" }}>
                  {queueNum ? `Queue #${queueNum}` : "—"}
                </span>
              </div>
              <div>
                <span className="text-xs pq-muted block mb-0.5">Reservation Code</span>
                <span className="font-mono font-bold px-2.5 py-1 rounded-lg inline-block text-xs mt-0.5" style={{ background: "color-mix(in srgb, #ffffff 70%, transparent)", border: "1px solid var(--pq-glass-line)" }}>
                  {reservation.reservationCode || "N/A"}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-3" style={{ borderTop: "1px solid var(--pq-glass-line)", paddingTop: "1.25rem" }}>
            <div className="flex items-center text-xs font-bold pq-muted mb-2">
              <Activity className="w-3.5 h-3.5 mr-1.5" style={{ color: "var(--pq-mark-blue)" }} />
              Reservation Timeline
            </div>
            <div className="pq-row flex-col items-stretch p-4 space-y-3 text-xs sm:text-sm">
              {timelineEvents.map((ev, idx) => (
                <div key={idx} className="flex justify-between items-center">
                  <span className="font-semibold flex items-center">
                    <span className="w-2 h-2 rounded-full mr-2" style={{ background: ev.time ? "var(--pq-mark-blue)" : "var(--pq-ink-faint)" }}></span>
                    {ev.label}
                  </span>
                  <span className="font-medium pq-muted">
                    {ev.time || <span className="pq-faint italic">Pending</span>}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {hasNotes && (
            <div className="space-y-3" style={{ borderTop: "1px solid var(--pq-glass-line)", paddingTop: "1.25rem" }}>
              <div className="flex items-center text-xs font-bold mb-2" style={{ color: "var(--pq-mark-blue-deep)" }}>
                <FileText className="w-3.5 h-3.5 mr-1.5" />
                Doctor&apos;s Notes
              </div>
              <div className="pq-note pq-note-info text-sm whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto font-medium">
                {reservation.doctorNotes}
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 flex justify-end" style={{ borderTop: "1px solid var(--pq-glass-line)" }}>
          <button 
            onClick={onClose}
            className="pq-btn-secondary w-full sm:w-auto text-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
