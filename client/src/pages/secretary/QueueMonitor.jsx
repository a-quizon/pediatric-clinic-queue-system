import React, { useState, useEffect } from "react";
import { Users, AlertTriangle, Monitor, Clock, Maximize, Minimize } from "lucide-react";
import { PqBrand, PqSpinner } from "../../components/parent/pqUi";
import { useAuth } from "../../hooks/useAuth";
import { subscribeToPublishedSchedules } from "../../services/scheduleService";
import { subscribeToScheduleReservations } from "../../services/reservationService";
import { sortActiveQueue } from "../../services/queueEngine";
import { scheduleMatchesAssignedBranch } from "../../utils/stringUtils";

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
    scheduleMatchesAssignedBranch(s, user) && 
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
      <div className="pq-shell min-h-screen flex flex-col items-center justify-center">
        <PqSpinner label="Loading live queue" />
      </div>
    );
  }

  if (!activeSchedule) {
    return (
      <div className="pq-shell min-h-screen flex flex-col items-center justify-center p-8 text-center">
        <Monitor className="w-24 h-24 pq-faint mb-6" aria-hidden="true" />
        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight mb-4">No Active Queue</h1>
        <p className="text-xl pq-muted max-w-2xl">
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
        <div className="py-3 px-6 w-full text-center font-extrabold tracking-widest text-2xl uppercase" style={{ background: "var(--pq-alert)", color: "#fff" }}>
          Queue Closed
        </div>
      );
    }
    if (isPaused) {
      return (
        <div className="py-3 px-6 w-full text-center font-extrabold tracking-widest text-2xl uppercase" style={{ background: "var(--pq-wait)", color: "#fff" }}>
          Queue Paused
        </div>
      );
    }
    return null; 
  };

  return (
    <div className="pq-shell min-h-screen flex flex-col overflow-hidden select-none">
      {getStatusBanner()}
      
      <header className="pq-glass-nav px-6 sm:px-8 py-5 flex justify-between items-center rounded-none border-x-0 border-t-0">
        <div className="min-w-0">
          <PqBrand size={40} />
          <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight mt-2 truncate">
            {user?.assignedBranch || "Pediatric Clinic"}
          </h1>
          <p className="text-lg sm:text-xl pq-muted font-semibold mt-1">Live Queue Monitor</p>
        </div>
        <div className="flex items-center gap-4 sm:gap-6">
          <div className="pq-row gap-4 px-5 py-3 min-h-0">
            <Clock className="w-7 h-7" style={{ color: "var(--pq-mark-blue)" }} aria-hidden="true" />
            <span className="text-2xl sm:text-3xl font-extrabold tracking-wider pq-num">
              {formatCurrentTime()}
            </span>
          </div>
          <button 
            type="button"
            onClick={toggleFullscreen}
            className="pq-icon-btn"
            style={{ width: 56, height: 56 }}
            title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
            aria-label={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
          >
            {isFullscreen ? <Minimize className="w-8 h-8" /> : <Maximize className="w-8 h-8" />}
          </button>
        </div>
      </header>

      <main className="flex-1 flex flex-col lg:flex-row p-6 sm:p-8 gap-6 overflow-hidden">
        <section className="flex-[3] flex flex-col h-full pq-glass overflow-hidden">
          <div className="pq-now mx-0 rounded-none" style={{ borderRadius: 0, border: "none", borderBottom: "1px solid color-mix(in srgb, var(--pq-live) 18%, white)" }}>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight flex items-center gap-3" style={{ color: "var(--pq-live)" }}>
              <span className="pq-pip" />
              Now Serving
            </h2>
          </div>
          
          <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-8">
            {inConsultationPatients.length > 0 ? (
              <div className="flex flex-wrap justify-center gap-8 w-full max-h-full overflow-y-auto">
                {inConsultationPatients.map(res => (
                  <div key={res.id} className="flex flex-col items-center">
                    <div
                      className="flex flex-col items-center justify-center"
                      style={{
                        width: "min(28rem, 86vw)",
                        height: "min(28rem, 70vw)",
                        borderRadius: "2rem",
                        background: "color-mix(in srgb, #ffffff 82%, transparent)",
                        border: "1px solid color-mix(in srgb, var(--pq-live) 28%, white)",
                      }}
                    >
                       <span className="text-xl sm:text-2xl uppercase font-extrabold tracking-widest mb-4" style={{ color: "var(--pq-live)" }}>Queue Number</span>
                       <span className="pq-num leading-none" style={{ fontSize: "clamp(5rem, 18vw, 12rem)", color: "var(--pq-ink)" }}>
                         {res.queueNumber || res.queuePosition}
                       </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <Users className="w-24 h-24 sm:w-32 sm:h-32 pq-faint mb-6" aria-hidden="true" />
                <p className="text-3xl sm:text-5xl font-extrabold tracking-tight pq-muted">Doctor is Available</p>
                <p className="text-xl sm:text-2xl pq-faint mt-4 font-semibold">Waiting for the next patient</p>
              </div>
            )}
          </div>
        </section>

        <section className="flex-[2] flex flex-col pq-glass overflow-hidden h-full">
          <div className="p-5 text-center" style={{ borderBottom: "1px solid var(--pq-glass-line)" }}>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Next In Queue
            </h2>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {waitingQueue.length > 0 ? (
              waitingQueue.slice(0, 10).map((res, index) => (
                  <div 
                    key={res.id} 
                    className={`pq-row ${index === 0 ? "pq-row-you" : ""}`}
                    style={index === 0 ? { minHeight: "4.5rem" } : undefined}
                  >
                    <div className="flex items-center gap-4 pl-1">
                      <div className={`pq-queue-plate ${index === 0 ? "pq-queue-plate-next" : ""}`} style={{ width: index === 0 ? "4rem" : "3rem", height: index === 0 ? "4rem" : "3rem", fontSize: index === 0 ? "1.5rem" : "1.125rem" }}>
                        {res.queueNumber || res.queuePosition}
                      </div>
                      <div className="flex flex-col">
                         {index === 0 && (
                           <span className="font-extrabold text-sm uppercase tracking-widest" style={{ color: "var(--pq-mark-blue-deep)" }}>
                             Up Next
                           </span>
                         )}
                         <span className={`font-extrabold tracking-tight ${index === 0 ? "text-2xl sm:text-4xl" : "text-xl sm:text-2xl"}`}>
                           Queue #{res.queueNumber || res.queuePosition}
                         </span>
                      </div>
                    </div>
                  </div>
              ))
            ) : (
              <div className="h-full flex flex-col items-center justify-center">
                <AlertTriangle className="w-16 h-16 pq-faint mb-4" aria-hidden="true" />
                <p className="text-2xl font-extrabold pq-muted text-center">No Patients Waiting</p>
              </div>
            )}
            {waitingQueue.length > 10 && (
              <p className="text-center text-sm font-extrabold pq-muted py-2">+ {waitingQueue.length - 10} more waiting</p>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
