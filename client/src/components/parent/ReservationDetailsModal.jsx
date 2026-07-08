import React from 'react';
import { X, MapPin, CalendarDays, Clock, User, FileText, Activity, Hash } from 'lucide-react';
import ReservationStatusBadge from '../common/ReservationStatusBadge';

export default function ReservationDetailsModal({ isOpen, onClose, reservation, schedule }) {
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
  } else if (status === 'penalized') {
    timelineEvents.push({ label: "Penalized", time: formatDateTime(reservation.penalizedAt) });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200 border border-gray-100">
        {/* Modal Header */}
        <div className="flex justify-between items-center px-6 py-5 border-b border-gray-100 bg-gray-50/50">
          <div>
            <h2 className="text-lg font-bold text-gray-800">Reservation Details</h2>
            <p className="text-xs text-gray-400 mt-0.5">Complete record of your clinic reservation</p>
          </div>
          <button 
            onClick={onClose} 
            className="text-gray-400 hover:text-gray-600 transition-colors p-1.5 rounded-full hover:bg-gray-100 focus:outline-none"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 divide-y divide-gray-100">
          {/* Status Badge Section */}
          <div className="flex items-center justify-between pt-1">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Status</span>
            <ReservationStatusBadge status={status} className="px-3.5 py-1" />
          </div>

          {/* Patient Information */}
          <div className="pt-5 space-y-3">
            <div className="flex items-center text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
              <User className="w-3.5 h-3.5 mr-1.5 text-blue-500" />
              Patient Information
            </div>
            <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100/80 grid grid-cols-3 gap-3 text-sm">
              <div className="col-span-3 sm:col-span-1">
                <span className="text-xs text-gray-400 block mb-0.5">Child Name</span>
                <span className="font-bold text-gray-800 break-words">{reservation.childName || "N/A"}</span>
              </div>
              <div>
                <span className="text-xs text-gray-400 block mb-0.5">Age</span>
                <span className="font-semibold text-gray-700">{reservation.age || "N/A"}</span>
              </div>
              <div>
                <span className="text-xs text-gray-400 block mb-0.5">Sex</span>
                <span className="font-semibold text-gray-700">{reservation.sex || "N/A"}</span>
              </div>
            </div>
          </div>

          {/* Schedule Information */}
          <div className="pt-5 space-y-3">
            <div className="flex items-center text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
              <CalendarDays className="w-3.5 h-3.5 mr-1.5 text-blue-500" />
              Schedule
            </div>
            <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100/80 grid grid-cols-2 gap-y-3 gap-x-4 text-sm">
              <div>
                <span className="text-xs text-gray-400 block mb-0.5 flex items-center">
                  <MapPin className="w-3 h-3 mr-1 text-red-500 inline" /> Branch
                </span>
                <span className="font-bold text-gray-800">{sched.branch || "Unknown Branch"}</span>
              </div>
              <div>
                <span className="text-xs text-gray-400 block mb-0.5 flex items-center">
                  <Clock className="w-3 h-3 mr-1 text-blue-500 inline" /> Time
                </span>
                <span className="font-semibold text-gray-700">
                  {sched.openingTime && sched.closingTime 
                    ? `${formatTime(sched.openingTime)} - ${formatTime(sched.closingTime)}`
                    : "N/A"}
                </span>
              </div>
              <div>
                <span className="text-xs text-gray-400 block mb-0.5">Date</span>
                <span className="font-semibold text-gray-800">{formatDateOnly(sched.clinicDate)}</span>
              </div>
              <div>
                <span className="text-xs text-gray-400 block mb-0.5">Day</span>
                <span className="font-semibold text-gray-700">{formatDayOnly(sched.clinicDate)}</span>
              </div>
            </div>
          </div>

          {/* Queue Information */}
          <div className="pt-5 space-y-3">
            <div className="flex items-center text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
              <Hash className="w-3.5 h-3.5 mr-1.5 text-blue-500" />
              Queue Information
            </div>
            <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100/80 grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-xs text-gray-400 block mb-0.5">Queue Number</span>
                <span className="text-lg font-black text-blue-600">
                  {queueNum ? `Queue #${queueNum}` : "—"}
                </span>
              </div>
              <div>
                <span className="text-xs text-gray-400 block mb-0.5">Reservation Code</span>
                <span className="font-mono font-bold text-gray-800 bg-white px-2.5 py-1 rounded-lg border border-gray-200/80 inline-block text-xs mt-0.5">
                  {reservation.reservationCode || "N/A"}
                </span>
              </div>
            </div>
          </div>

          {/* Reservation Timeline */}
          <div className="pt-5 space-y-3">
            <div className="flex items-center text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
              <Activity className="w-3.5 h-3.5 mr-1.5 text-blue-500" />
              Reservation Timeline
            </div>
            <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100/80 space-y-3 text-xs sm:text-sm">
              {timelineEvents.map((ev, idx) => (
                <div key={idx} className="flex justify-between items-center">
                  <span className="font-semibold text-gray-600 flex items-center">
                    <span className={`w-2 h-2 rounded-full mr-2 ${ev.time ? 'bg-blue-500' : 'bg-gray-300'}`}></span>
                    {ev.label}
                  </span>
                  <span className="font-medium text-gray-500">
                    {ev.time || <span className="text-gray-300 italic">Pending</span>}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Doctor's Notes (Only displayed if notes exist) */}
          {hasNotes && (
            <div className="pt-5 space-y-3">
              <div className="flex items-center text-xs font-bold text-blue-600 uppercase tracking-wider mb-2">
                <FileText className="w-3.5 h-3.5 mr-1.5" />
                Doctor&apos;s Notes
              </div>
              <div className="bg-blue-50/60 rounded-2xl p-4 border border-blue-100 text-sm text-gray-800 whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto shadow-2xs font-medium">
                {reservation.doctorNotes}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/80 flex justify-end">
          <button 
            onClick={onClose}
            className="w-full sm:w-auto px-6 py-2.5 text-gray-700 font-bold bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors shadow-2xs text-sm focus:outline-none"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
