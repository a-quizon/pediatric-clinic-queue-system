import React from 'react';
import { Calendar, Clock, MapPin, Users, CheckCircle2, AlertCircle, PlayCircle } from 'lucide-react';

export default function ScheduleCard({ schedule, availableSlots, onEdit, onDelete, onPublish, onComplete }) {
  const isCompleted = schedule.status === 'completed';
  const isDraft = schedule.status === 'draft';
  const isPublished = schedule.status === 'published';

  const formatTime = (time) => {
    if (!time) return '';
    const [hours, minutes] = time.split(':');
    const h = parseInt(hours, 10);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const formattedH = h % 12 || 12;
    return `${formattedH}:${minutes} ${ampm}`;
  };

  return (
    <div className={`bg-white rounded-2xl border p-5 transition-all ${
      isCompleted 
        ? "border-gray-100 opacity-70" 
        : "border-gray-200 shadow-sm hover:shadow-md hover:border-blue-100"
    }`}>
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className={`text-lg font-bold flex items-center ${isCompleted ? "text-gray-600" : "text-gray-800"}`}>
            <MapPin className="w-5 h-5 mr-2 text-gray-400" />
            {schedule.branch} Branch
          </h3>
        </div>
        <div className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center ${
          isCompleted ? "bg-gray-100 text-gray-600" :
          isPublished ? "bg-green-50 text-green-700" :
          "bg-amber-50 text-amber-700"
        }`}>
          {isCompleted && <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />}
          {isPublished && <PlayCircle className="w-3.5 h-3.5 mr-1.5" />}
          {isDraft && <AlertCircle className="w-3.5 h-3.5 mr-1.5" />}
          <span className="capitalize">{schedule.status}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-y-3 mb-5">
        <div className="flex items-center text-sm">
          <Calendar className="w-4 h-4 mr-2 text-gray-400" />
          <span className="text-gray-600">{schedule.clinicDate}</span>
        </div>
        <div className="flex items-center text-sm">
          <Users className="w-4 h-4 mr-2 text-gray-400" />
          <span className="text-gray-600">Cap: {schedule.slotCapacity}</span>
        </div>
        <div className="flex items-center text-sm">
          <Clock className="w-4 h-4 mr-2 text-gray-400" />
          <span className="text-gray-600">Hours: {formatTime(schedule.openingTime)} - {formatTime(schedule.closingTime)}</span>
        </div>
        <div className="flex items-center text-sm">
          <Users className="w-4 h-4 mr-2 text-gray-400" />
          <span className="text-gray-600">Available: <span className="font-bold">{availableSlots !== undefined ? availableSlots : schedule.slotCapacity}</span></span>
        </div>
      </div>

      {!isCompleted && (
        <div className="flex items-center gap-2 pt-4 border-t border-gray-50">
          <button 
            onClick={() => onEdit(schedule)} 
            className="flex-1 py-2 bg-gray-50 text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-100 transition-colors"
          >
            Edit
          </button>
          
          {isDraft && (
            <>
              <button 
                onClick={() => onDelete(schedule.id)} 
                className="flex-1 py-2 bg-red-50 text-red-600 text-sm font-semibold rounded-xl hover:bg-red-100 transition-colors"
              >
                Delete
              </button>
              <button 
                onClick={() => onPublish(schedule.id)} 
                className="flex-1 py-2 bg-blue-50 text-blue-600 text-sm font-semibold rounded-xl hover:bg-blue-100 transition-colors"
              >
                Publish
              </button>
            </>
          )}

          {isPublished && (
            <button 
              onClick={() => onComplete(schedule.id)} 
              className="flex-1 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors shadow-sm"
            >
              Complete
            </button>
          )}
        </div>
      )}
    </div>
  );
}
