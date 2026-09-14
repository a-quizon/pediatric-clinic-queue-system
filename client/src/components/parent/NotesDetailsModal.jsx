import React from 'react';
import { X, MapPin, CalendarDays, FileText, Activity } from 'lucide-react';
import { getReservationChildDisplayName, getReservationChildren } from '../../utils/reservationPatients';

export default function NotesDetailsModal({ isOpen, onClose, reservation, schedule }) {
  if (!isOpen || !reservation || !schedule) return null;

  return (
    <div className="pq-modal-scrim">
      <div className="pq-glass-modal w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center p-5" style={{ borderBottom: "1px solid var(--pq-glass-line)" }}>
          <h2 className="text-lg font-bold flex items-center">
            <Activity className="w-5 h-5 mr-2" style={{ color: "var(--pq-mark-blue)" }} />
            Consultation Details
          </h2>
          <button onClick={onClose} className="pq-icon-btn" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto space-y-6">
          <div>
            <div className="text-xs pq-muted font-bold mb-1">Patient</div>
            <div className="text-xl font-bold">{getReservationChildDisplayName(reservation)}</div>
            {getReservationChildren(reservation).length > 0 && (
              <div className="text-sm pq-muted mt-1">
                {getReservationChildren(reservation)
                  .map((child) => [child.age, child.sex].filter(Boolean).join(" • "))
                  .filter(Boolean)
                  .join(" · ")}
              </div>
            )}
          </div>

          <div className="pq-row flex-col items-stretch p-4 space-y-3">
            <div className="flex items-center text-sm">
              <MapPin className="w-4 h-4 pq-faint mr-2" />
              <span className="pq-muted w-24">Branch:</span>
              <span className="font-bold">{schedule.branch || "Unknown"}</span>
            </div>
            <div className="flex items-center text-sm">
              <CalendarDays className="w-4 h-4 pq-faint mr-2" />
              <span className="pq-muted w-24">Date:</span>
              <span className="font-bold">
                {schedule.clinicDate ? new Date(schedule.clinicDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "N/A"}
              </span>
            </div>
          </div>

          <div className="pq-note pq-note-info">
            <h3 className="font-bold mb-3 flex items-center text-sm">
              <FileText className="w-4 h-4 mr-2" />
              Doctor's Notes
            </h3>
            <div className="pq-row p-4 text-sm whitespace-pre-wrap leading-relaxed min-h-[100px]">
              {reservation.doctorNotes || <span className="pq-faint italic">No notes provided for this consultation.</span>}
            </div>
          </div>
        </div>

        <div className="p-5 flex gap-3 justify-end" style={{ borderTop: "1px solid var(--pq-glass-line)" }}>
          <button 
            onClick={onClose}
            className="pq-btn-secondary w-full"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
