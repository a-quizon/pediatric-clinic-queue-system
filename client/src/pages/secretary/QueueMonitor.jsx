import React, { useState, useEffect } from "react";
import { Users, AlertTriangle, Monitor, Clock, Maximize, Minimize, ChevronDown } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { subscribeToPublishedSchedules } from "../../services/scheduleService";
import { subscribeToScheduleReservations } from "../../services/reservationService";
import { sortActiveQueue } from "../../services/queueEngine";

export default function QueueMonitor() {
  const { user } = useAuth();
  const [schedules, setSchedules] = useState({});
  const [schedulesLoaded, setSchedulesLoaded] = useState(false);
  const [reservations, setReservations] = useState([]);
  const [reservationsLoaded, setReservationsLoaded] = useState(false);
  const [nowTs, setNowTs] = useState(Date.now());
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        }
      }
    } catch (err) {
      console.error("Error attempting to toggle fullscreen:", err);
    }
  };

  useEffect(() => {
    // Keep time updated if we want to show current time
    const timer = setInterval(() => setNowTs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    document.title = "Live Queue Monitor";
    const unsubSchedules = subscribeToPublishedSchedules((data) => {
      const schedulesMap = {};
      data.forEach(s => schedulesMap[s.id] = s);
      setSchedules(schedulesMap);
      setSchedulesLoaded(true);
    });

    return () => unsubSchedules();
  }, []);

  const activeSchedule = Object.values(schedules).find(s =>
    s.branch === user?.assignedBranch && 
    ["active", "paused", "closed"].includes(s.queueStatus)
  );

  useEffect(() => {
    if (!activeSchedule) {
      setReservations([]);
      setReservationsLoaded(true);
      return;
    }

    setReservationsLoaded(false);
    const unsubReservations = subscribeToScheduleReservations(activeSchedule.id, (data) => {
      setReservations(data);
      setReservationsLoaded(true);
    });

    return () => unsubReservations();
  }, [activeSchedule?.id]);

  const loading = !schedulesLoaded || (!!activeSchedule && !reservationsLoaded);

  const formatCurrentTime = () => {
    return new Date(nowTs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-500 mb-4"></div>
        <p className="text-white text-xl font-bold animate-pulse">Loading Live Queue...</p>
      </div>
    );
  }

  if (!activeSchedule) {
    return (
      <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-8 text-center text-white">
        <Monitor className="w-24 h-24 text-gray-700 mb-6" />
        <h1 className="text-5xl font-black mb-4">No Active Queue</h1>
        <p className="text-2xl text-gray-400 max-w-2xl">
          There is currently no active clinic queue running for {user?.assignedBranch || "your branch"}.
        </p>
      </div>
    );
  }

  // Determine Queue Status Banner
  const isPaused = activeSchedule.queueStatus === "paused";
  const isClosed = activeSchedule.queueStatus === "closed";

  const activeReservations = reservations.filter(r => r.scheduleId === activeSchedule.id);
  
  // Now Serving = In Consultation / With Doctor
  const inConsultationPatients = activeReservations.filter(r => 
    r.status === "in_consultation" || r.status === "with_doctor"
  );

  // Waiting Queue
  const waitingQueue = sortActiveQueue(
    activeReservations.filter(r => ["checked_in", "reserved", "waiting"].includes(r.status))
  );

  const getStatusBanner = () => {
    if (isClosed) {
      return (
        <div className="bg-red-600 text-white py-3 px-6 w-full text-center font-black tracking-widest text-2xl uppercase shadow-lg">
          Queue Closed
        </div>
      );
    }
    if (isPaused) {
      return (
        <div className="bg-amber-500 text-white py-3 px-6 w-full text-center font-black tracking-widest text-2xl uppercase shadow-lg">
          Queue Paused
        </div>
      );
    }
    return null; 
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans overflow-hidden select-none">
      {getStatusBanner()}
      
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-8 py-6 flex justify-between items-center shadow-sm">
        <div>
          <h1 className="text-4xl font-black text-gray-900 uppercase tracking-tight">
            {user?.assignedBranch || "Pediatric Clinic"}
          </h1>
          <p className="text-xl text-gray-500 font-bold tracking-wide mt-1">Live Queue Monitor</p>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-4 bg-gray-100 px-6 py-3 rounded-2xl border border-gray-200 shadow-inner">
            <Clock className="w-8 h-8 text-blue-600" />
            <span className="text-3xl font-bold text-gray-800 tracking-wider font-mono">
              {formatCurrentTime()}
            </span>
          </div>
          <button 
            onClick={toggleFullscreen}
            className="p-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-2xl border border-gray-200 shadow-sm transition-all active:scale-95 flex-shrink-0"
            title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
          >
            {isFullscreen ? <Minimize className="w-8 h-8" /> : <Maximize className="w-8 h-8" />}
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col lg:flex-row p-8 gap-8 overflow-hidden">
        
        {/* Left/Main Column: Now Serving */}
        <div className="flex-[3] flex flex-col h-full bg-white rounded-3xl border border-gray-200 shadow-lg overflow-hidden relative">
          <div className="bg-blue-600 text-white p-6 text-center shadow-md z-10">
            <h2 className="text-4xl font-black uppercase tracking-widest flex justify-center items-center gap-4">
              <Users className="w-10 h-10" />
              Now Serving
            </h2>
          </div>
          
          <div className="flex-1 flex flex-col items-center justify-center p-8 bg-gradient-to-b from-blue-50 to-white relative">
            {inConsultationPatients.length > 0 ? (
              <div className="flex flex-wrap justify-center gap-12 w-full max-h-full overflow-y-auto">
                {inConsultationPatients.map(res => (
                  <div key={res.id} className="flex flex-col items-center animate-in zoom-in duration-500">
                    <div className="bg-white border-8 border-blue-600 rounded-[3rem] w-[28rem] h-[28rem] flex flex-col items-center justify-center shadow-2xl relative overflow-hidden">
                       <div className="absolute inset-0 bg-blue-600 opacity-5"></div>
                       <span className="text-3xl uppercase font-black text-blue-600 opacity-80 mb-4 tracking-widest">Queue Number</span>
                       <span className="text-[12rem] font-black text-gray-900 leading-none">
                         {res.queueNumber || res.queuePosition}
                       </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center opacity-60">
                <Users className="w-48 h-48 text-gray-300 mb-8" />
                <p className="text-5xl font-black text-gray-400 tracking-wide">Doctor is Available</p>
                <p className="text-2xl text-gray-400 mt-4 font-bold">Waiting for the next patient</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Next in Queue */}
        <div className="flex-[2] flex flex-col bg-white rounded-3xl border border-gray-200 shadow-lg overflow-hidden h-full">
          <div className="bg-gray-800 text-white p-6 text-center shadow-md z-10">
            <h2 className="text-3xl font-black uppercase tracking-widest">
              Next In Queue
            </h2>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 bg-gray-50/50">
            {waitingQueue.length > 0 ? (
              <div className="flex flex-col gap-4">
                {waitingQueue.slice(0, 10).map((res, index) => (
                  <div 
                    key={res.id} 
                    className={`flex items-center justify-between p-6 rounded-2xl border-2 transition-all ${
                      index === 0 
                        ? "bg-white border-blue-400 shadow-md transform scale-[1.02]" 
                        : "bg-white border-gray-200 shadow-sm"
                    }`}
                  >
                    <div className="flex items-center gap-6 pl-4">
                      <div className="flex flex-col">
                         {index === 0 && (
                           <span className="text-blue-600 font-black text-xl uppercase tracking-widest animate-pulse mb-1">
                             Up Next
                           </span>
                         )}
                         <span className="text-4xl sm:text-5xl font-black text-gray-800 uppercase">
                           Queue #{res.queueNumber || res.queuePosition}
                         </span>
                      </div>
                    </div>
                  </div>
                ))}
                {waitingQueue.length > 10 && (
                  <div className="flex justify-center p-4 mt-2">
                    <ChevronDown className="w-14 h-14 text-gray-400 animate-bounce" />
                  </div>
                )}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center opacity-60">
                <AlertTriangle className="w-24 h-24 text-gray-300 mb-6" />
                <p className="text-3xl font-black text-gray-400 text-center">No Patients Waiting</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
