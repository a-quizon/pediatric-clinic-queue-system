import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Ticket as TicketIcon, Clock, MapPin, CalendarDays, ChevronRight, Activity } from "lucide-react";
import { subscribeToAllSchedules } from "../../services/scheduleService";
import { subscribeToParentReservations } from "../../services/reservationService";
import { getBranchConfigurations } from "../../services/branchConfigurationService";
import { useAuth } from "../../hooks/useAuth";

export default function MyReservation() {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [schedules, setSchedules] = useState({});
  const [allReservations, setAllReservations] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubSchedules = subscribeToAllSchedules((data) => {
      setSchedules(data || {});
    });

    let unsubReservations = () => {};
    if (user) {
      unsubReservations = subscribeToParentReservations(user.uid, (data) => {
        setAllReservations(data || []);
        setLoading(false);
      });
    }

    getBranchConfigurations().then(setBranches);

    return () => {
      unsubSchedules();
      unsubReservations();
    };
  }, [user]);

  // Filter for active/pending reservations
  const activeReservations = useMemo(() => {
    if (!user) return [];
    
    // 1. Get all reservations belonging to the parent
    const myRes = allReservations.filter(r => r.parentId === user.uid);
    
    // 2. Filter for active/pending/expired statuses (preserving business logic)
    const eligibleStatuses = [
      "reserved", "waiting", "validation_open", "waiting_for_window",
      "checked_in", "in_consultation", "with_doctor",
      "expired", "validation_expired"
    ];
    
    const eligible = myRes.filter(r => eligibleStatuses.includes(r.status));
    
    // 3. Sort chronologically by clinicDate, then openingTime
    eligible.sort((a, b) => {
      const scheduleA = schedules[a.scheduleId];
      const scheduleB = schedules[b.scheduleId];
      
      // If schedules aren't loaded yet, preserve order
      if (!scheduleA || !scheduleB) return 0;
      
      const dateA = new Date(scheduleA.clinicDate);
      const dateB = new Date(scheduleB.clinicDate);
      
      if (dateA.getTime() !== dateB.getTime()) {
        return dateA.getTime() - dateB.getTime();
      }
      
      // If same date, sort by openingTime (string comparison works for HH:mm)
      return scheduleA.openingTime.localeCompare(scheduleB.openingTime);
    });
    
    return eligible;
  }, [allReservations, user, schedules]);

  const formatTime = (time) => {
    if (!time) return '';
    const [hours, minutes] = time.split(':');
    const h = parseInt(hours, 10);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const formattedH = h % 12 || 12;
    return `${formattedH}:${minutes} ${ampm}`;
  };

  return (
    <div className="space-y-6 pb-8 relative">
      <div>
        <p className="text-gray-500 mt-1 text-sm">
          View your active clinic reservations, check-in arrival passes, and real-time queue status.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : activeReservations.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 animate-in fade-in slide-in-from-bottom-4">
          {activeReservations.map((res) => {
            const schedule = schedules[res.scheduleId];
            if (!schedule) return null;

            // Determine if the queue session is actively started
            const isQueueStarted = ['active', 'paused', 'closed'].includes(schedule.queueStatus);

            return (
              <div 
                key={res.id} 
                onClick={() => navigate(`/parent/reservations/${res.id}/qr`)}
                className={`rounded-2xl border shadow-sm hover:shadow-md transition-all p-5 flex items-center justify-between cursor-pointer group ${
                  isQueueStarted 
                    ? "bg-green-50 border-green-300 hover:border-green-400" 
                    : "bg-white border-gray-200 hover:border-blue-300"
                }`}
              >
                <div className="flex-1 pr-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className={`text-lg font-bold flex items-center ${isQueueStarted ? 'text-green-900' : 'text-gray-800'}`}>
                      <MapPin className={`w-5 h-5 mr-1.5 shrink-0 ${isQueueStarted ? 'text-green-600' : 'text-blue-600'}`} />
                      {schedule.branch}
                    </h3>
                    
                    {isQueueStarted && (
                      <span className="flex items-center text-xs font-bold text-green-700 bg-green-200/50 px-2.5 py-1 rounded-full shrink-0 shadow-sm border border-green-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 mr-1.5 animate-pulse"></span>
                        Queue Started
                      </span>
                    )}
                  </div>

                  <div className="space-y-1.5 text-sm">
                    <div className="flex items-center">
                      <CalendarDays className={`w-4 h-4 mr-2 ${isQueueStarted ? 'text-green-600' : 'text-gray-400'}`} />
                      <span className={isQueueStarted ? 'text-green-800' : 'text-gray-600'}>
                        {new Date(schedule.clinicDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </span>
                    </div>
                    
                    <div className="flex items-center">
                      <Clock className={`w-4 h-4 mr-2 ${isQueueStarted ? 'text-green-600' : 'text-gray-400'}`} />
                      <span className={isQueueStarted ? 'text-green-800' : 'text-gray-600'}>
                        {formatTime(schedule.openingTime)} - {formatTime(schedule.closingTime)}
                      </span>
                    </div>

                    <div className="flex items-center mt-3 pt-3 border-t border-black/5">
                      <TicketIcon className={`w-4 h-4 mr-2 ${isQueueStarted ? 'text-green-600' : 'text-gray-400'}`} />
                      <span className={isQueueStarted ? 'text-green-800' : 'text-gray-500'}>
                        QR: <span className={`font-bold font-mono tracking-wider ${isQueueStarted ? 'text-green-900' : 'text-gray-800'}`}>{res.reservationCode}</span>
                      </span>
                    </div>
                  </div>
                </div>

                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-transform group-hover:translate-x-1 ${
                  isQueueStarted ? 'bg-green-100 text-green-700' : 'bg-blue-50 text-blue-600'
                }`}>
                  <ChevronRight className="w-5 h-5" />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Empty State */
        <div className="flex flex-col items-center justify-center min-h-[60vh] w-full">
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-10 sm:p-14 text-center max-w-md mx-auto animate-in fade-in w-full">
            <div className="mx-auto w-20 h-20 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-6 shadow-2xs">
              <TicketIcon className="w-10 h-10" />
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-gray-800 mb-2">No Active Reservations</h2>
            <p className="text-gray-500 text-sm max-w-xs mx-auto mb-8 leading-relaxed">
              You don&apos;t have an active reservation yet. Reserve a queue slot to get started.
            </p>
            <button
              onClick={() => navigate("/parent/reserve")}
              className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-extrabold rounded-2xl transition-all shadow-md hover:shadow-lg flex items-center justify-center text-sm sm:text-base focus:outline-none"
            >
              Reserve Queue
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
