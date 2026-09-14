import React from 'react';
import { X, MapPin, CalendarDays, Clock, Users, Activity, CheckCircle2, User } from 'lucide-react';
import { ACTIVE_RESERVATION_STATUSES } from '../../services/reservationService';
import { formatBranchLabel } from '../../utils/stringUtils';
import useResolvedLateLimit from '../../hooks/useResolvedLateLimit';

export default function ScheduleDetailsModal({ isOpen, onClose, schedule, reservations = [] }) {
  const lateLimit = useResolvedLateLimit(isOpen ? schedule : null);
  if (!isOpen || !schedule) return null;

  const formatTime = (time) => {
    if (!time) return '';
    const [hours, minutes] = time.split(':');
    const h = parseInt(hours, 10);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const formattedH = h % 12 || 12;
    return `${formattedH}:${minutes} ${ampm}`;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'reserved': return 'bg-blue-50 text-blue-600';
      case 'waiting': return 'bg-orange-50 text-orange-600';
      case 'validated': return 'bg-green-50 text-green-600';
      default: return 'bg-gray-50 text-gray-600';
    }
  };

  const isCompletedSchedule = schedule.status === 'completed';

  // Filter reservations for this schedule
  const scheduleReservations = reservations.filter(r => r.scheduleId === schedule.id);

  // use active statuses para occupied pa ang slot habang in_consultation/with_doctor
  const activeStatuses = ACTIVE_RESERVATION_STATUSES;
  
  const displayReservations = isCompletedSchedule 
    ? scheduleReservations.filter(r => r.status === 'completed' || r.status === 'cancelled').sort((a, b) => (a.queuePosition || 0) - (b.queuePosition || 0))
    : scheduleReservations.filter(r => activeStatuses.includes(r.status)).sort((a, b) => (a.queuePosition || 0) - (b.queuePosition || 0));

  const activeCount = scheduleReservations.filter(r => activeStatuses.includes(r.status)).length;
  const availableSlots = schedule.slotCapacity - activeCount;

  // Completed Stats
  const totalReservations = scheduleReservations.length;
  const patientsCheckedUp = scheduleReservations.filter(r => ["completed", "consultation_completed"].includes(r.status)).length;
  const cancelledReservations = scheduleReservations.filter(r => r.status === 'cancelled').length;
  const forfeitedReservations = scheduleReservations.filter(r => ["forfeited", "penalized", "late_limit_reached"].includes(r.status)).length;
  
  const checkedInCount = scheduleReservations.filter(r => r.status === 'checked_in' || r.checkedIn).length;

  return (
    <div className="pq-modal-scrim z-50">
      <div className="pq-modal w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]" role="dialog" aria-modal="true" aria-labelledby="schedule-details-title">
        
        <div className="flex justify-between items-center p-5" style={{ borderBottom: "1px solid var(--pq-glass-line)" }}>
          <h2 id="schedule-details-title" className="text-lg font-extrabold tracking-tight flex items-center">
            <Activity className="w-5 h-5 mr-2" style={{ color: "var(--pq-mark-blue)" }} aria-hidden="true" />
            Schedule Details & Queue
          </h2>
          <button type="button" onClick={onClose} className="pq-icon-btn" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto flex-1">
          {!isCompletedSchedule ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
              <div className="pq-stat">
                <span className="pq-stat-label">Capacity</span>
                <span className="pq-stat-value">{schedule.slotCapacity}</span>
              </div>
              <div className="pq-stat pq-stat-info">
                <span className="pq-stat-label">Reserved</span>
                <span className="pq-stat-value">{activeCount}</span>
              </div>
              <div className="pq-stat pq-stat-live">
                <span className="pq-stat-label">Checked In</span>
                <span className="pq-stat-value">{checkedInCount}</span>
              </div>
              <div className="pq-stat">
                <span className="pq-stat-label">Status</span>
                <span className="text-sm font-extrabold capitalize mt-1">{schedule.status}</span>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
              <div className="pq-stat">
                <span className="pq-stat-label">Total</span>
                <span className="pq-stat-value">{totalReservations}</span>
              </div>
              <div className="pq-stat pq-stat-live">
                <span className="pq-stat-label">Checked Up</span>
                <span className="pq-stat-value">{patientsCheckedUp}</span>
              </div>
              <div className="pq-stat" style={{ background: "var(--pq-alert-wash)", borderColor: "color-mix(in srgb, var(--pq-alert) 22%, white)" }}>
                <span className="pq-stat-label" style={{ color: "var(--pq-alert)" }}>Cancelled</span>
                <span className="pq-stat-value" style={{ color: "var(--pq-alert)" }}>{cancelledReservations}</span>
              </div>
              <div className="pq-stat">
                <span className="pq-stat-label">Forfeited</span>
                <span className="pq-stat-value">{forfeitedReservations}</span>
              </div>
            </div>
          )}

          <div className="pq-row block min-h-0 p-5">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
              <div className="flex items-center">
                <MapPin className="w-4 h-4 mr-2 pq-faint" aria-hidden="true" />
                <span className="font-semibold">{formatBranchLabel(schedule.branch)}</span>
              </div>
              <div className="flex items-center">
                <CalendarDays className="w-4 h-4 mr-2 pq-faint" aria-hidden="true" />
                <span className="font-semibold">{new Date(schedule.clinicDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</span>
              </div>
              <div className="flex items-center">
                <Clock className="w-4 h-4 mr-2 pq-faint" aria-hidden="true" />
                <span className="font-semibold">{formatTime(schedule.openingTime)} - {formatTime(schedule.closingTime)}</span>
              </div>
              <div className="flex flex-col">
                <span className="pq-stat-label">Late Limit</span>
                <span className="font-extrabold">{lateLimit} penalties</span>
              </div>
            </div>
          </div>
        </div>
        
        <div className="p-5" style={{ borderTop: "1px solid var(--pq-glass-line)" }}>
          <button 
            type="button"
            onClick={onClose}
            className="pq-btn-secondary w-full"
          >
            Close Details
          </button>
        </div>
      </div>
    </div>
  );
}
