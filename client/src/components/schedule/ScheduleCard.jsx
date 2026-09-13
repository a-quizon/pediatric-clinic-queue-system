import React from 'react';
import { Calendar, Clock, MapPin, Users, CheckCircle2, AlertCircle, Activity, Lock } from 'lucide-react';

export default function ScheduleCard({ 
  schedule, 
  availableSlots, 
  reservedCount, 
  checkedInCount, 
  totalReservations,
  checkedUpCount,
  cancelledCount,
  forfeitedCount,
  onEdit, 
  onDelete, 
  onPublish, 
  onStartQueue,
  onOpenQueueControl,
  onViewDetails,
  isStartQueueDisabled,
  clinicAddress,
  queueControlLabel = "Open Queue Control",
}) {

  let localStatus = 'unknown';
  if (schedule.status === 'draft') localStatus = 'draft';
  else if (schedule.status === 'completed' || schedule.queueStatus === 'completed' || schedule.queueStatus === 'ended') localStatus = 'completed';
  else if (schedule.queueStatus === 'closed') localStatus = 'closed';
  else if (schedule.queueStatus === 'active' || schedule.queueStatus === 'paused') localStatus = 'active';
  else if (schedule.status === 'published') localStatus = 'published';

  const formatTime = (time) => {
    if (!time) return '';
    const [hours, minutes] = time.split(':');
    const h = parseInt(hours, 10);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const formattedH = h % 12 || 12;
    return `${formattedH}:${minutes} ${ampm}`;
  };

  const getStatusConfig = () => {
    switch (localStatus) {
      case 'draft': return { text: 'Draft', chip: 'pq-chip', icon: AlertCircle };
      case 'published': return { text: 'Published', chip: 'pq-chip pq-chip-wait', icon: CheckCircle2 };
      case 'active': return { text: 'Active Queue', chip: 'pq-chip pq-chip-live', icon: Activity };
      case 'closed': return { text: 'Queue Closed', chip: 'pq-chip pq-chip-wait', icon: Lock };
      case 'completed': return { text: 'Completed', chip: 'pq-chip', icon: CheckCircle2 };
      default: return { text: schedule.status, chip: 'pq-chip', icon: AlertCircle };
    }
  };

  const statusConfig = getStatusConfig();
  const StatusIcon = statusConfig.icon;
  const isCompleted = localStatus === 'completed';

  return (
    <div className={`pq-glass p-5 flex flex-col h-full ${isCompleted ? "opacity-80" : ""}`}>
      <div className="mb-4">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <h3 className="text-lg font-extrabold tracking-tight flex items-center min-w-0 flex-1 basis-[10rem]">
            <MapPin className="w-5 h-5 mr-2 pq-faint shrink-0" aria-hidden="true" />
            <span className="truncate">{schedule.branch}</span>
          </h3>
          <div className={`${statusConfig.chip} shrink-0`}>
            {localStatus === "active" ? (
              <span className="pq-pip" style={{ width: 6, height: 6 }} />
            ) : (
              <StatusIcon className="w-3.5 h-3.5" aria-hidden="true" />
            )}
            <span className="capitalize">{statusConfig.text}</span>
          </div>
        </div>
        <p className="text-xs whitespace-pre-line mt-1.5 ml-7 line-clamp-3 pq-muted">
          {clinicAddress || "No clinic address provided."}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-y-3 mb-5">
        <div className="flex items-center text-sm">
          <Calendar className="w-4 h-4 mr-2 pq-faint" aria-hidden="true" />
          <span className="pq-muted">{schedule.clinicDate}</span>
        </div>
        <div className="flex items-center text-sm">
          <Clock className="w-4 h-4 mr-2 pq-faint" aria-hidden="true" />
          <span className="pq-muted">{formatTime(schedule.openingTime)} - {formatTime(schedule.closingTime)}</span>
        </div>

        {localStatus === 'draft' && (
          <>
            <div className="flex items-center text-sm">
              <Users className="w-4 h-4 mr-2 pq-faint" aria-hidden="true" />
              <span className="pq-muted">Capacity: <span className="font-extrabold" style={{ color: "var(--pq-ink)" }}>{schedule.slotCapacity}</span></span>
            </div>
            <div className="flex items-center text-sm">
              <Clock className="w-4 h-4 mr-2 pq-faint" aria-hidden="true" />
              <span className="pq-muted">Late Limit: <span className="font-extrabold" style={{ color: "var(--pq-ink)" }}>{schedule.lateLimit || 3}</span></span>
            </div>
          </>
        )}

        {localStatus === 'published' && (
          <div className="flex items-center text-sm">
            <Users className="w-4 h-4 mr-2 pq-faint" aria-hidden="true" />
            <span className="pq-muted">Reserved: <span className="font-extrabold" style={{ color: "var(--pq-mark-blue-deep)" }}>{reservedCount !== undefined ? reservedCount : 0}</span></span>
          </div>
        )}

        {(localStatus === 'active' || localStatus === 'closed') && (
          <>
            <div className="flex items-center text-sm">
              <Users className="w-4 h-4 mr-2 pq-faint" aria-hidden="true" />
              <span className="pq-muted">Capacity: <span className="font-extrabold" style={{ color: "var(--pq-ink)" }}>{schedule.slotCapacity}</span></span>
            </div>
            <div className="flex items-center text-sm">
              <Users className="w-4 h-4 mr-2 pq-faint" aria-hidden="true" />
              <span className="pq-muted">Reserved: <span className="font-extrabold" style={{ color: "var(--pq-ink)" }}>{reservedCount !== undefined ? reservedCount : 0}</span></span>
            </div>
            <div className="col-span-2 pt-2 mt-1 flex items-center justify-between text-sm" style={{ borderTop: "1px solid var(--pq-glass-line)" }}>
              <div className="flex items-center">
                <CheckCircle2 className="w-4 h-4 mr-2" style={{ color: "var(--pq-live)" }} aria-hidden="true" />
                <span className="pq-muted">Checked In: <span className="font-extrabold" style={{ color: "var(--pq-live)" }}>{checkedInCount !== undefined ? checkedInCount : 0}</span></span>
              </div>
              <div className="flex items-center">
                <Clock className="w-3.5 h-3.5 mr-1" style={{ color: "var(--pq-alert)" }} aria-hidden="true" />
                <span className="text-xs pq-muted">Late Limit: <span className="font-extrabold" style={{ color: "var(--pq-ink)" }}>{schedule.lateLimit || 3}</span></span>
              </div>
            </div>
          </>
        )}

        {localStatus === 'completed' && (
          <div className="col-span-2 grid grid-cols-2 gap-y-2 mt-1 pt-3" style={{ borderTop: "1px solid var(--pq-glass-line)" }}>
            <div className="flex items-center text-sm">
              <Users className="w-4 h-4 mr-2 pq-faint" aria-hidden="true" />
              <span className="pq-muted">Total: <span className="font-extrabold" style={{ color: "var(--pq-ink)" }}>{totalReservations !== undefined ? totalReservations : 0}</span></span>
            </div>
            <div className="flex items-center text-sm">
              <CheckCircle2 className="w-4 h-4 mr-2" style={{ color: "var(--pq-live)" }} aria-hidden="true" />
              <span className="pq-muted">Checked Up: <span className="font-extrabold" style={{ color: "var(--pq-live)" }}>{checkedUpCount !== undefined ? checkedUpCount : 0}</span></span>
            </div>
            <div className="flex items-center text-sm">
              <AlertCircle className="w-4 h-4 mr-2" style={{ color: "var(--pq-alert)" }} aria-hidden="true" />
              <span className="pq-muted">Cancelled: <span className="font-extrabold" style={{ color: "var(--pq-alert)" }}>{cancelledCount !== undefined ? cancelledCount : 0}</span></span>
            </div>
            <div className="flex items-center text-sm">
              <AlertCircle className="w-4 h-4 mr-2 pq-faint" aria-hidden="true" />
              <span className="pq-muted">Forfeited: <span className="font-extrabold" style={{ color: "var(--pq-ink)" }}>{forfeitedCount !== undefined ? forfeitedCount : 0}</span></span>
            </div>
          </div>
        )}
      </div>

      {localStatus !== 'completed' && (
        <div className="mt-auto flex items-center gap-2 pt-4 flex-wrap" style={{ borderTop: "1px solid var(--pq-glass-line)" }}>
          {localStatus === 'draft' && (
            <>
              <button type="button" onClick={(e) => { e.stopPropagation(); onEdit(schedule); }} className="pq-btn-secondary flex-1">Edit</button>
              <button type="button" onClick={(e) => { e.stopPropagation(); onDelete(schedule.id); }} className="pq-btn-danger flex-1">Delete</button>
              <button type="button" onClick={(e) => { e.stopPropagation(); onPublish(schedule); }} className="pq-btn-live flex-1">Publish</button>
            </>
          )}

          {localStatus === 'published' && (
            <button 
              type="button"
              onClick={(e) => { e.stopPropagation(); onStartQueue(schedule); }} 
              disabled={isStartQueueDisabled}
              className="pq-btn-live flex-1"
            >
              Start Queue
            </button>
          )}

          {(localStatus === 'active' || localStatus === 'closed') && (
            <button 
              type="button"
              onClick={(e) => { e.stopPropagation(); onOpenQueueControl(); }} 
              className="pq-btn-live flex-1"
            >
              <Activity className="w-4 h-4" aria-hidden="true" /> {queueControlLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
