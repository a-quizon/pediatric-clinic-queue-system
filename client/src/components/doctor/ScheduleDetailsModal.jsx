import React from 'react';
import { X, MapPin, CalendarDays, Clock, Users, Activity, CheckCircle2, User } from 'lucide-react';

export default function ScheduleDetailsModal({ isOpen, onClose, schedule, reservations = [] }) {
  if (!isOpen || !schedule) return null;

  const formatTime = (time) => {
    if (!time) return '';
    const [hours, minutes] = time.split(':');
    const h = parseInt(hours, 10);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const formattedH = h % 12 || 12;
    return `${formattedH}:${minutes} ${ampm}`;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'reserved': return 'bg-blue-50 text-blue-600';
      case 'waiting': return 'bg-orange-50 text-orange-600';
      case 'validated': return 'bg-green-50 text-green-600';
      default: return 'bg-gray-50 text-gray-600';
    }
  };

  const isCompletedSchedule = schedule.status === 'completed';

  // Filter reservations for this schedule
  const scheduleReservations = reservations.filter(r => r.scheduleId === schedule.id);

  const activeStatuses = ["reserved", "validated", "waiting"];
  
  const displayReservations = isCompletedSchedule 
    ? scheduleReservations.filter(r => r.status === 'completed' || r.status === 'cancelled').sort((a, b) => (a.queuePosition || 0) - (b.queuePosition || 0))
    : scheduleReservations.filter(r => activeStatuses.includes(r.status)).sort((a, b) => (a.queuePosition || 0) - (b.queuePosition || 0));

  const activeCount = scheduleReservations.filter(r => activeStatuses.includes(r.status)).length;
  const availableSlots = schedule.slotCapacity - activeCount;

  // Completed Stats
  const totalReservations = scheduleReservations.length;
  const patientsCheckedUp = scheduleReservations.filter(r => r.status === 'completed').length;
  const cancelledReservations = scheduleReservations.filter(r => r.status === 'cancelled').length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex justify-between items-center p-5 border-b border-gray-100 bg-gray-50">
          <h2 className="text-lg font-bold text-gray-800 flex items-center">
            <Activity className="w-5 h-5 mr-2 text-blue-600" />
            Schedule Details & Queue
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-lg hover:bg-gray-200">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto flex-1">
          {/* Schedule Statistics */}
          {!isCompletedSchedule ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                <div className="text-xs text-gray-500 mb-1 flex items-center"><Users className="w-3.5 h-3.5 mr-1"/> Capacity</div>
                <div className="text-xl font-bold text-gray-800">{schedule.slotCapacity}</div>
              </div>
              <div className="bg-white p-4 rounded-xl border border-blue-100 shadow-sm">
                <div className="text-xs text-blue-500 mb-1 flex items-center"><CheckCircle2 className="w-3.5 h-3.5 mr-1"/> Reserved</div>
                <div className="text-xl font-bold text-blue-600">{activeCount}</div>
              </div>
              <div className="bg-white p-4 rounded-xl border border-green-100 shadow-sm">
                <div className="text-xs text-green-500 mb-1 flex items-center"><Activity className="w-3.5 h-3.5 mr-1"/> Available</div>
                <div className="text-xl font-bold text-green-600">{availableSlots}</div>
              </div>
              <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                <div className="text-xs text-gray-500 mb-1">Status</div>
                <div className="text-sm font-bold text-gray-800 capitalize mt-1">{schedule.status}</div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                <div className="text-xs text-gray-500 mb-1 flex items-center"><Users className="w-3.5 h-3.5 mr-1"/> Total</div>
                <div className="text-xl font-bold text-gray-800">{totalReservations}</div>
              </div>
              <div className="bg-white p-4 rounded-xl border border-green-100 shadow-sm">
                <div className="text-xs text-green-500 mb-1 flex items-center"><CheckCircle2 className="w-3.5 h-3.5 mr-1"/> Checked Up</div>
                <div className="text-xl font-bold text-green-600">{patientsCheckedUp}</div>
              </div>
              <div className="bg-white p-4 rounded-xl border border-red-100 shadow-sm">
                <div className="text-xs text-red-500 mb-1 flex items-center"><X className="w-3.5 h-3.5 mr-1"/> Cancelled</div>
                <div className="text-xl font-bold text-red-600">{cancelledReservations}</div>
              </div>
              <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                <div className="text-xs text-gray-500 mb-1">Status</div>
                <div className="text-sm font-bold text-gray-800 capitalize mt-1">{schedule.status}</div>
              </div>
            </div>
          )}

          <div className="bg-gray-50 rounded-xl p-5 mb-8 border border-gray-100">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="flex items-center text-gray-600">
                <MapPin className="w-4 h-4 mr-2 text-gray-400" />
                <span className="font-semibold">{schedule.branch} Branch</span>
              </div>
              <div className="flex items-center text-gray-600">
                <CalendarDays className="w-4 h-4 mr-2 text-gray-400" />
                <span className="font-semibold">{new Date(schedule.clinicDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</span>
              </div>
              <div className="flex items-center text-gray-600">
                <Clock className="w-4 h-4 mr-2 text-gray-400" />
                <span className="font-semibold">{formatTime(schedule.openingTime)} - {formatTime(schedule.closingTime)}</span>
              </div>
            </div>
          </div>

          {/* Current Reservations List */}
          <div>
            <h3 className="text-md font-bold text-gray-800 mb-4 flex items-center">
              <Users className="w-5 h-5 mr-2 text-gray-500" />
              {isCompletedSchedule ? "Historical Records" : "Current Reservations"}
            </h3>
            
            {displayReservations.length === 0 ? (
              <div className="bg-white rounded-xl border border-dashed border-gray-200 p-8 text-center">
                <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Activity className="w-6 h-6 text-gray-400" />
                </div>
                <p className="text-gray-500 font-medium">{isCompletedSchedule ? "No historical records found." : "No active reservations in the queue yet."}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {displayReservations.map((res) => (
                  <div key={res.id} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="bg-blue-50 w-12 h-12 rounded-lg flex flex-col items-center justify-center flex-shrink-0 border border-blue-100">
                        <span className="text-[10px] text-blue-500 font-bold uppercase leading-none mb-1">Queue</span>
                        <span className="text-lg font-black text-blue-600 leading-none">{res.queuePosition}</span>
                      </div>
                      <div>
                        <div className="font-bold text-gray-800 flex items-center mb-1">
                          <User className="w-4 h-4 mr-1.5 text-gray-400" />
                          {res.parentEmail}
                        </div>
                        <div className="text-xs text-gray-500 flex items-center">
                          <Clock className="w-3 h-3 mr-1" />
                          Reserved: {new Date(res.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}
                        </div>
                      </div>
                    </div>
                    <div className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize whitespace-nowrap self-start sm:self-auto ${getStatusColor(res.status)}`}>
                      {res.status}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        
        <div className="p-5 border-t border-gray-100 bg-white">
          <button 
            onClick={onClose}
            className="w-full py-2.5 text-gray-700 font-bold bg-gray-50 border border-gray-200 rounded-xl hover:bg-gray-100 transition-colors"
          >
            Close Details
          </button>
        </div>
      </div>
    </div>
  );
}
