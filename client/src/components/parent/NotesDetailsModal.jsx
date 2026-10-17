import React from "react";
import { X, MapPin, CalendarDays, FileText, Activity } from "lucide-react";
import { getReservationChildDisplayName, getReservationChildren } from "../../utils/reservationPatients";
import { presentChildForRole } from "../../utils/pediatricAge";
import { useHistoryOverlay } from "../../hooks/useHistoryOverlay";
import ModalScrim from "../common/ModalScrim";

export default function NotesDetailsModal({ isOpen, onClose, reservation, schedule }) {
  useHistoryOverlay(Boolean(isOpen && reservation && schedule), onClose);
  if (!isOpen || !reservation || !schedule) return null;

  return (
    <ModalScrim onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="pq-modal pq-modal--md" role="dialog" aria-modal="true">
        <div className="pq-modal-header flex justify-between items-center p-5" style={{ borderBottom: "1px solid var(--pq-glass-line)" }}>
          <h2 className="text-lg font-bold flex items-center min-w-0 pr-2">
            <Activity className="w-5 h-5 mr-2 shrink-0" style={{ color: "var(--pq-mark-blue)" }} />
            <span className="truncate">Consultation Details</span>
          </h2>
          <button type="button" onClick={onClose} className="pq-icon-btn shrink-0" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="pq-modal-body p-6 pq-scroll-y space-y-6">
          <div>
            <div className="text-xs pq-muted font-bold mb-1">Patient</div>
            <div className="text-xl font-bold break-words">{getReservationChildDisplayName(reservation)}</div>
            {getReservationChildren(reservation).length > 0 && (
              <div className="text-sm pq-muted mt-1">
                {getReservationChildren(reservation)
                  .map((child) => {
                    const presented = presentChildForRole(child, "parent");
                    return [presented.birthdateDisplay, child.sex].filter(Boolean).join(" • ");
                  })
                  .filter(Boolean)
                  .join(" · ")}
              </div>
            )}
          </div>

          <div className="pq-row flex-col items-stretch p-4 space-y-3">
            <div className="flex items-center text-sm min-w-0">
              <MapPin className="w-4 h-4 pq-faint mr-2 shrink-0" />
              <span className="pq-muted w-24 shrink-0">Branch:</span>
              <span className="font-bold truncate">{schedule.branch || "Unknown"}</span>
            </div>
            <div className="flex items-center text-sm min-w-0">
              <CalendarDays className="w-4 h-4 pq-faint mr-2 shrink-0" />
              <span className="pq-muted w-24 shrink-0">Date:</span>
              <span className="font-bold">
                {schedule.clinicDate
                  ? new Date(schedule.clinicDate).toLocaleDateString("en-US", {
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })
                  : "N/A"}
              </span>
            </div>
          </div>

          <div className="pq-note pq-note-info">
            <h3 className="font-bold mb-3 flex items-center text-sm">
              <FileText className="w-4 h-4 mr-2" />
              Doctor&apos;s Notes
            </h3>
            <div className="pq-row p-4 text-sm whitespace-pre-wrap leading-relaxed min-h-[100px] break-words">
              {reservation.doctorNotes || (
                <span className="pq-faint italic">No notes provided for this consultation.</span>
              )}
            </div>
          </div>
        </div>

        <div className="pq-modal-footer p-5 flex gap-3 justify-end" style={{ borderTop: "1px solid var(--pq-glass-line)" }}>
          <button type="button" onClick={onClose} className="pq-btn-secondary w-full">
            Close
          </button>
        </div>
      </div>
    </ModalScrim>
  );
}
