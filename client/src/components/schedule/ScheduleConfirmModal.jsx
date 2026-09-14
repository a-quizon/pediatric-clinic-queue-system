import React from 'react';
import { Calendar, Clock, MapPin, CalendarCheck, PlayCircle } from 'lucide-react';

export default function ScheduleConfirmModal({
  isOpen,
  title,
  description,
  schedule,
  confirmText = "Confirm",
  cancelText = "Cancel",
  onConfirm,
  onCancel,
  loading = false,
  icon: Icon = CalendarCheck,
}) {
  if (!isOpen || !schedule) return null;

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-');
    if (!year || !month || !day) return dateStr;
    const date = new Date(year, parseInt(month, 10) - 1, day);
    return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  };

  const formatDay = (dateStr) => {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-');
    if (!year || !month || !day) return '';
    const date = new Date(year, parseInt(month, 10) - 1, day);
    return date.toLocaleDateString('en-US', { weekday: 'long' });
  };

  const formatTime = (time) => {
    if (!time) return '';
    const [hours, minutes] = time.split(':');
    const h = parseInt(hours, 10);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const formattedH = h % 12 || 12;
    return `${formattedH}:${minutes} ${ampm}`;
  };

  return (
    <div className="pq-modal-scrim z-50">
      <div className="pq-glass-modal w-full max-w-md overflow-hidden" role="dialog" aria-modal="true" aria-labelledby="schedule-confirm-title">
        <div className="p-6">
          <div className="flex flex-col items-center text-center mb-5">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mb-3" style={{ background: "var(--pq-live-wash)", color: "var(--pq-live)" }}>
              <Icon className="w-8 h-8" aria-hidden="true" />
            </div>
            <h2 id="schedule-confirm-title" className="text-xl font-extrabold tracking-tight mb-2">{title}</h2>
            <div className="pq-muted text-sm whitespace-pre-line text-left w-full mt-1">
              {description}
            </div>
          </div>

          <div className="pq-row block min-h-0 p-4 mb-6">
            <div className="pq-stat-label mb-3">Schedule Summary</div>
            <div className="space-y-2.5 text-sm">
              <div className="flex justify-between items-center pb-2" style={{ borderBottom: "1px solid var(--pq-glass-line)" }}>
                <span className="pq-muted flex items-center"><MapPin className="w-4 h-4 mr-2 pq-faint" aria-hidden="true"/> Branch</span>
                <span className="font-extrabold">{schedule.branch}</span>
              </div>
              <div className="flex justify-between items-center pb-2" style={{ borderBottom: "1px solid var(--pq-glass-line)" }}>
                <span className="pq-muted flex items-center"><Calendar className="w-4 h-4 mr-2 pq-faint" aria-hidden="true"/> Clinic Date</span>
                <span className="font-extrabold">{formatDate(schedule.clinicDate)}</span>
              </div>
              <div className="flex justify-between items-center pb-2" style={{ borderBottom: "1px solid var(--pq-glass-line)" }}>
                <span className="pq-muted">Day</span>
                <span className="font-extrabold">{formatDay(schedule.clinicDate)}</span>
              </div>
              <div className="flex justify-between items-center pb-2" style={{ borderBottom: "1px solid var(--pq-glass-line)" }}>
                <span className="pq-muted flex items-center"><Clock className="w-4 h-4 mr-2 pq-faint" aria-hidden="true"/> Clinic Time</span>
                <span className="font-extrabold">{formatTime(schedule.openingTime)} – {formatTime(schedule.closingTime)}</span>
              </div>
              <div className="flex justify-between items-center pt-1">
                <span className="pq-muted flex items-center"><Clock className="w-4 h-4 mr-2" style={{ color: "var(--pq-alert)" }} aria-hidden="true"/> Late Limit</span>
                <span className="font-extrabold">{schedule.lateLimit || 3} penalties</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              className="pq-btn-secondary w-full sm:w-1/2 order-2 sm:order-1"
            >
              {cancelText}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={loading}
              className="pq-btn-live w-full sm:w-1/2 order-1 sm:order-2"
            >
              {loading ? "Processing..." : confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
