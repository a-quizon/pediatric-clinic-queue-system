import React from 'react';
import { X, MapPin, CalendarDays, FileText, Activity } from 'lucide-react';

export default function NotesDetailsModal({ isOpen, onClose, reservation, schedule }) {
  if (!isOpen || !reservation || !schedule) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center p-5 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-800 flex items-center">
            <Activity className="w-5 h-5 text-blue-600 mr-2" />
            Consultation Details
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-lg hover:bg-gray-50">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Patient Header */}
          <div>
            <div className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-1">Patient</div>
            <div className="text-xl font-bold text-gray-800">{reservation.childName || "N/A"}</div>
            {reservation.age && reservation.sex && (
              <div className="text-sm text-gray-500 mt-1">{reservation.age} • {reservation.sex}</div>
            )}
          </div>

          {/* Details Grid */}
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 space-y-3">
            <div className="flex items-center text-sm">
              <MapPin className="w-4 h-4 text-gray-400 mr-2" />
              <span className="text-gray-500 w-24">Branch:</span>
              <span className="font-bold text-gray-800">{schedule.branch || "Unknown"}</span>
            </div>
            <div className="flex items-center text-sm">
              <CalendarDays className="w-4 h-4 text-gray-400 mr-2" />
              <span className="text-gray-500 w-24">Date:</span>
              <span className="font-bold text-gray-800">
                {schedule.clinicDate ? new Date(schedule.clinicDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "N/A"}
              </span>
            </div>
          </div>

          {/* Doctor Notes */}
          <div className="bg-blue-50/50 rounded-xl p-5 border border-blue-100">
            <h3 className="font-bold text-blue-800 mb-3 flex items-center text-sm uppercase tracking-wider">
              <FileText className="w-4 h-4 text-blue-600 mr-2" />
              Doctor's Notes
            </h3>
            <div className="bg-white rounded-lg p-4 border border-blue-100 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed shadow-sm min-h-[100px]">
              {reservation.doctorNotes || <span className="text-gray-400 italic">No notes provided for this consultation.</span>}
            </div>
          </div>
        </div>

        <div className="p-5 border-t border-gray-100 bg-gray-50 flex gap-3 justify-end">
          <button 
            onClick={onClose}
            className="w-full py-2.5 text-blue-600 font-bold bg-blue-50 border border-blue-100 rounded-xl hover:bg-blue-100 transition-colors shadow-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
