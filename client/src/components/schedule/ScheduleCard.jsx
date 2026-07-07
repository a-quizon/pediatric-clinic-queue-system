import React from 'react';
import { Calendar, Clock, MapPin, Users, CheckCircle2, AlertCircle, Activity, Lock } from 'lucide-react';

export default function ScheduleCard({ 
  schedule, 
  availableSlots, 
  reservedCount, 
  checkedInCount, 
  onEdit, 
  onDelete, 
  onPublish, 
  onStartQueue,
  onOpenQueueControl,
  onViewDetails,
  isStartQueueDisabled
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
      case 'draft': return { text: 'Draft', color: 'bg-gray-100 text-gray-600', icon: AlertCircle };
      case 'published': return { text: 'Published', color: 'bg-amber-50 text-amber-700', icon: CheckCircle2 };
      case 'active': return { text: 'Active Queue', color: 'bg-green-100 text-green-700', icon: Activity };
      case 'closed': return { text: 'Queue Closed', color: 'bg-amber-100 text-amber-800 border border-amber-300', icon: Lock };
      case 'completed': return { text: 'Completed', color: 'bg-gray-100 text-gray-500', icon: CheckCircle2 };
      default: return { text: schedule.status, color: 'bg-gray-100 text-gray-600', icon: AlertCircle };
    }
  };

  const statusConfig = getStatusConfig();
  const StatusIcon = statusConfig.icon;
  const isCompleted = localStatus === 'completed';

  return (
    <div className={`bg-white rounded-2xl border p-5 transition-all relative ${
      isCompleted ? "border-gray-100 opacity-80" : "border-gray-200 shadow-sm hover:shadow-md hover:border-blue-300"
    }`}>
      {localStatus === 'active' && (
        <div className="absolute -top-3 right-4 bg-green-500 text-white text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full shadow-sm flex items-center animate-pulse">
          <div className="w-1.5 h-1.5 bg-white rounded-full mr-1.5"></div>
          Active Clinic
        </div>
      )}

      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className={`text-lg font-bold flex items-center ${isCompleted ? "text-gray-600" : "text-gray-800"}`}>
            <MapPin className="w-5 h-5 mr-2 text-gray-400" />
            {schedule.branch} Branch
          </h3>
        </div>
        <div className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center ${statusConfig.color}`}>
          <StatusIcon className="w-3.5 h-3.5 mr-1.5" />
          <span className="capitalize">{statusConfig.text}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-y-3 mb-5">
        <div className="flex items-center text-sm">
          <Calendar className="w-4 h-4 mr-2 text-gray-400" />
          <span className="text-gray-600">{schedule.clinicDate}</span>
        </div>
        <div className="flex items-center text-sm">
          <Clock className="w-4 h-4 mr-2 text-gray-400" />
          <span className="text-gray-600">{formatTime(schedule.openingTime)} - {formatTime(schedule.closingTime)}</span>
        </div>
        <div className="flex items-center text-sm">
          <Users className="w-4 h-4 mr-2 text-gray-400" />
          <span className="text-gray-600">Capacity: <span className="font-bold">{schedule.slotCapacity}</span></span>
        </div>
        <div className="flex items-center text-sm">
          <Users className="w-4 h-4 mr-2 text-gray-400" />
          <span className="text-gray-600">Reserved: <span className="font-bold">{reservedCount !== undefined ? reservedCount : (schedule.slotCapacity - (availableSlots || schedule.slotCapacity))}</span></span>
        </div>
        <div className="col-span-2 pt-2 mt-1 border-t border-gray-50 flex items-center justify-between text-sm">
          <div className="flex items-center">
            <CheckCircle2 className="w-4 h-4 mr-2 text-green-500" />
            <span className="text-gray-600">Checked In: <span className="font-bold text-green-600">{checkedInCount !== undefined ? checkedInCount : 0}</span></span>
          </div>
          <div className="flex items-center">
            <Clock className="w-4 h-4 mr-1.5 text-blue-500" />
            <span className="text-gray-600">Validation Window: <span className="font-bold text-gray-800">{schedule.validationWindow || 15}m</span></span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 pt-4 border-t border-gray-50 flex-wrap">
        {localStatus === 'draft' && (
          <>
            <button onClick={(e) => { e.stopPropagation(); onEdit(schedule); }} className="flex-1 py-2 bg-gray-50 text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-100 transition-colors">Edit</button>
            <button onClick={(e) => { e.stopPropagation(); onDelete(schedule.id); }} className="flex-1 py-2 bg-red-50 text-red-600 text-sm font-semibold rounded-xl hover:bg-red-100 transition-colors">Delete</button>
            <button onClick={(e) => { e.stopPropagation(); onPublish(schedule); }} className="flex-1 py-2 bg-green-50 text-green-600 text-sm font-semibold rounded-xl hover:bg-green-100 transition-colors">Publish</button>
          </>
        )}

        {localStatus === 'published' && (
          <>
            <button onClick={(e) => { e.stopPropagation(); onViewDetails(schedule); }} className="flex-1 py-2 bg-gray-50 text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-100 transition-colors">View Details</button>
            <button 
              onClick={(e) => { e.stopPropagation(); onStartQueue(schedule); }} 
              disabled={isStartQueueDisabled}
              className={`flex-1 py-2 text-sm font-semibold rounded-xl transition-all shadow-sm flex items-center justify-center ${
                isStartQueueDisabled ? "bg-gray-100 text-gray-400 cursor-not-allowed" : "bg-green-600 text-white hover:bg-green-700"
              }`}
            >
              Start Queue on this Branch
            </button>
          </>
        )}

        {(localStatus === 'active' || localStatus === 'closed') && (
          <button 
            onClick={(e) => { e.stopPropagation(); onOpenQueueControl(); }} 
            className="flex-1 py-2.5 bg-green-600 text-white text-sm font-semibold rounded-xl hover:bg-green-700 transition-all shadow-sm flex items-center justify-center"
          >
            <Activity className="w-4 h-4 mr-2" /> Open Queue Control
          </button>
        )}

        {localStatus === 'completed' && (
          <>
            <button onClick={(e) => { e.stopPropagation(); onViewDetails(schedule); }} className="flex-1 py-2 bg-gray-50 text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-100 transition-colors">View Summary</button>
          </>
        )}
      </div>
    </div>
  );
}
