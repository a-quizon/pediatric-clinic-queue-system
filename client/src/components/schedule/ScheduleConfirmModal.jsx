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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-6">
          {/* Header */}
          <div className="flex flex-col items-center text-center mb-5">
            <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mb-3">
              <Icon className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">{title}</h2>
            <div className="text-gray-500 text-sm whitespace-pre-line text-left w-full mt-1">
              {description}
            </div>
          </div>

          {/* Schedule Summary Card */}
          <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6 shadow-sm">
            <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Schedule Summary</div>
            <div className="space-y-2.5 text-sm">
              <div className="flex justify-between items-center pb-2 border-b border-gray-100">
                <span className="text-gray-500 flex items-center"><MapPin className="w-4 h-4 mr-2 text-gray-400"/> Branch</span>
                <span className="font-bold text-gray-800">{schedule.branch}</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-gray-100">
                <span className="text-gray-500 flex items-center"><Calendar className="w-4 h-4 mr-2 text-gray-400"/> Clinic Date</span>
                <span className="font-bold text-gray-800">{formatDate(schedule.clinicDate)}</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-gray-100">
                <span className="text-gray-500">Day</span>
                <span className="font-bold text-gray-800">{formatDay(schedule.clinicDate)}</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-gray-100">
                <span className="text-gray-500 flex items-center"><Clock className="w-4 h-4 mr-2 text-gray-400"/> Clinic Time</span>
                <span className="font-bold text-gray-800">{formatTime(schedule.openingTime)} – {formatTime(schedule.closingTime)}</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-gray-100 pt-1">
                <span className="text-gray-500 flex items-center"><Clock className="w-4 h-4 mr-2 text-blue-500"/> Validation Window</span>
                <span className="font-bold text-blue-600">{schedule.validationWindow || 15} minutes</span>
              </div>
              <div className="flex justify-between items-center pt-1">
                <span className="text-gray-500 flex items-center"><Clock className="w-4 h-4 mr-2 text-indigo-500"/> Active Val. Queue</span>
                <span className="font-bold text-indigo-600">{schedule.activeValidationQueue || 3} patients</span>
              </div>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={onCancel}
              disabled={loading}
              className="w-full sm:w-1/2 py-3 font-bold rounded-xl text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors order-2 sm:order-1"
            >
              {cancelText}
            </button>
            <button
              onClick={onConfirm}
              disabled={loading}
              className={`w-full sm:w-1/2 py-3 font-bold rounded-xl text-white transition-all shadow-sm order-1 sm:order-2 ${
                loading ? "bg-green-400 cursor-not-allowed" : "bg-green-600 hover:bg-green-700"
              }`}
            >
              {loading ? "Processing..." : confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
