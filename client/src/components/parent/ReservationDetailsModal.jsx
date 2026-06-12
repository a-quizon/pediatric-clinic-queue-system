import React from 'react';
import { X, MapPin, CalendarDays, Clock, CheckCircle2, FileText, XCircle } from 'lucide-react';

export default function ReservationDetailsModal({ isOpen, onClose, reservation, schedule }) {
  if (!isOpen || !reservation || !schedule) return null;

  const isCancelled = reservation.status === "cancelled";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center p-5 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-800">Reservation Details</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-lg hover:bg-gray-50">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto">
          {/* Status Badge */}
          <div className="flex justify-between items-center mb-6">
            <div className="font-bold text-gray-800 text-lg">
              {reservation.queuePosition ? `Queue Position #${reservation.queuePosition}` : "Historical Record"}
            </div>
            <div className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize flex items-center ${
              isCancelled ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'
            }`}>
              {isCancelled ? <XCircle className="w-4 h-4 mr-1.5" /> : <CheckCircle2 className="w-4 h-4 mr-1.5" />}
              {reservation.status}
            </div>
          </div>

          {/* Details Grid */}
          <div className="bg-gray-50 rounded-xl p-5 mb-6 border border-gray-100 space-y-4">
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-500 flex items-center"><MapPin className="w-4 h-4 mr-2" />Branch</span>
              <span className="font-bold text-gray-800">{schedule.branch}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-500 flex items-center"><CalendarDays className="w-4 h-4 mr-2" />Clinic Date</span>
              <span className="font-bold text-gray-800">{new Date(schedule.clinicDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</span>
            </div>
            {(reservation.completedAt || reservation.cancelledAt) && (
              <div className="flex justify-between items-center text-sm pt-4 border-t border-gray-200">
                <span className="text-gray-500 flex items-center"><Clock className="w-4 h-4 mr-2" />{isCancelled ? 'Cancelled On' : 'Completed On'}</span>
                <span className="font-medium text-gray-700">{new Date(reservation.completedAt || reservation.cancelledAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</span>
              </div>
            )}
          </div>

          {/* Placeholder for Consultation Notes */}
          <div className="bg-blue-50/50 rounded-xl p-5 border border-blue-100/50">
            <h3 className="font-bold text-gray-800 mb-3 flex items-center text-sm">
              <FileText className="w-4 h-4 text-blue-600 mr-2" />
              Consultation Notes
            </h3>
            <div className="bg-white rounded-lg p-4 border border-blue-100 text-sm text-gray-400 italic text-center">
              Doctor consultation notes will be available here.
            </div>
          </div>
        </div>

        <div className="p-5 border-t border-gray-100 bg-gray-50 flex gap-3 justify-end">
          <button 
            onClick={onClose}
            className="w-full py-2.5 text-gray-600 font-bold bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors shadow-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
