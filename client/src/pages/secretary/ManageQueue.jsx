import React, { useState, useEffect } from "react";
import { Users, UserCheck, Clock, CheckCircle, Activity, Hash, MapPin, Calendar, CheckCircle2, PlayCircle, AlertTriangle } from "lucide-react";
import { subscribeToAllReservations, startConsultation, penalizeReservation } from "../../services/reservationService";
import { subscribeToPublishedSchedules } from "../../services/scheduleService";
import { useAuth } from "../../hooks/useAuth";
import toast from "react-hot-toast";

export default function ManageQueue() {
  const { user } = useAuth();
  const [reservations, setReservations] = useState([]);
  const [schedules, setSchedules] = useState({});
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);

  useEffect(() => {
    const unsubSchedules = subscribeToPublishedSchedules((data) => {
      const schedulesMap = {};
      data.forEach(s => schedulesMap[s.id] = s);
      setSchedules(schedulesMap);
    });

    const unsubReservations = subscribeToAllReservations((data) => {
      setReservations(data);
      setLoading(false);
    });

    return () => {
      unsubSchedules();
      unsubReservations();
    };
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Find active schedule started by the Doctor
  const activeStartedSchedule = Object.values(schedules).find(s =>
    s.status === "published" && ["active", "paused", "closed"].includes(s.queueStatus)
  );

  if (!activeStartedSchedule) {
    return (
      <div className="space-y-6 pb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Manage Queue</h1>
          <p className="text-gray-500 text-sm mt-0.5">Control patient flow and consultations for today&apos;s active clinic session.</p>
        </div>

        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-12 text-center max-w-xl mx-auto my-12 animate-in fade-in">
          <div className="w-16 h-16 bg-amber-50 text-amber-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Clock className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Queue Has Not Started Yet</h2>
          <p className="text-gray-500 text-sm leading-relaxed max-w-md mx-auto">
            Today&apos;s clinic queue has not been started by the Doctor yet. Patients can reserve slots and check in via the Validate section upon arrival, but queue flow control will become active once the Doctor starts the queue.
          </p>
        </div>
      </div>
    );
  }

  // Active queue sorted by dynamic queue position for today's started schedule
  const activeReservations = reservations.filter(r => r.scheduleId === activeStartedSchedule.id);
  
  // Single continuous chronological queue (in consultation -> checked in / waiting in queuePosition order)
  const continuousQueue = activeReservations
    .filter(r => ["in_consultation", "checked_in", "reserved", "waiting"].includes(r.status))
    .sort((a, b) => (a.queuePosition || 999) - (b.queuePosition || 999));

  const inConsultationPatients = activeReservations.filter(r => r.status === "in_consultation");
  const firstWaitingOrCheckedInPatient = continuousQueue.find(r => ["checked_in", "reserved", "waiting"].includes(r.status));
  
  const completedPatients = activeReservations
    .filter(r => ["consultation_completed", "completed", "penalized", "late_limit_reached", "cancelled"].includes(r.status))
    .sort((a, b) => (b.consultationCompletedAt || b.penalizedAt || 0) - (a.consultationCompletedAt || a.penalizedAt || 0));

  const formatTime = (timestamp) => {
    if (!timestamp) return "N/A";
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const renderStatusBadge = (status) => {
    switch (status) {
      case "in_consultation":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />
            In Consultation
          </span>
        );
      case "checked_in":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-800 border border-green-200 shrink-0">
            <UserCheck className="w-3.5 h-3.5" />
            Checked In
          </span>
        );
      case "reserved":
      case "waiting":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200 shrink-0">
            <Clock className="w-3.5 h-3.5" />
            Not Checked In
          </span>
        );
      default:
        return null;
    }
  };

  const handleStartConsultation = async (res) => {
    try {
      setActionLoading(res.id);
      await startConsultation(res.id);
      toast.success(`Consultation started for ${res.childName}`);
    } catch (err) {
      toast.error("Failed to start consultation");
    } finally {
      setActionLoading(null);
    }
  };

  const handlePenalize = async (res) => {
    try {
      setActionLoading(res.id);
      const schedule = schedules[res.scheduleId] || {};
      await penalizeReservation(res.id, schedule, reservations);
      const newPenaltyCount = (res.penaltyCount || 0) + 1;
      const lateLimit = Number(schedule.lateLimit) || 3;
      if (newPenaltyCount >= lateLimit) {
        toast.error(`${res.childName} reached late limit (${lateLimit}) and was removed from the queue.`);
      } else {
        toast.success(`Penalty applied to ${res.childName} (${newPenaltyCount}/${lateLimit}). Moved back in queue.`);
      }
    } catch (err) {
      toast.error("Failed to apply penalty");
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-6 pb-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-200 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Clinic Queue Line</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Real-time chronological queue flow for {activeStartedSchedule.branch || "Today's Clinic Session"}
          </p>
        </div>
        <div className="flex items-center gap-2 bg-gray-100 px-3 py-1.5 rounded-full text-xs font-bold text-gray-700">
          <Users className="w-4 h-4 text-blue-600" />
          <span>{continuousQueue.length} Active in Line</span>
        </div>
      </div>

      {/* Continuous Chronological Waiting Line */}
      <div className="space-y-3">
        {continuousQueue.length > 0 ? (
          continuousQueue.map((res, idx) => {
            const schedule = schedules[res.scheduleId] || {};
            const isFirstInQueue = res.id === firstWaitingOrCheckedInPatient?.id;
            const canStartConsultation =
              isFirstInQueue &&
              res.status === "checked_in" &&
              inConsultationPatients.length === 0;
            const canPenalize =
              isFirstInQueue &&
              (res.status === "reserved" || res.status === "waiting");

            return (
              <div
                key={res.id}
                className={`p-4 sm:p-5 rounded-2xl border transition-all ${
                  res.status === "in_consultation"
                    ? "bg-blue-50/60 border-blue-300 shadow-sm"
                    : isFirstInQueue
                    ? "bg-white border-blue-200 ring-2 ring-blue-500/10 shadow-sm"
                    : "bg-white border-gray-200 shadow-2xs hover:border-gray-300"
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  {/* Left: Queue Number + Patient Detail */}
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div
                      className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center shrink-0 font-black text-sm border ${
                        res.status === "in_consultation"
                          ? "bg-blue-600 text-white border-blue-600"
                          : isFirstInQueue
                          ? "bg-gray-900 text-white border-gray-900"
                          : "bg-gray-100 text-gray-700 border-gray-200"
                      }`}
                    >
                      <span className="text-[9px] uppercase font-bold leading-none opacity-80 mb-0.5">
                        Queue
                      </span>
                      <span>#{res.queuePosition || idx + 1}</span>
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-gray-800 text-base truncate">
                          {res.childName || "Unnamed Patient"}
                        </h3>
                        {res.penaltyCount > 0 && (
                          <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2.5 py-0.5 rounded-full border border-amber-200 uppercase">
                            Late ({res.penaltyCount})
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 flex items-center gap-2 mt-1">
                        <span>
                          Age: {res.age || "N/A"} • {res.sex || "N/A"}
                        </span>
                        {schedule.branch && (
                          <>
                            <span className="text-gray-300">•</span>
                            <span className="flex items-center gap-1 text-gray-600">
                              <MapPin className="w-3 h-3" />
                              {schedule.branch}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Status Badge & Context Action */}
                  <div className="flex items-center justify-between sm:justify-end gap-3 pt-3 sm:pt-0 border-t sm:border-t-0 border-gray-100 shrink-0">
                    {renderStatusBadge(res.status)}

                    {canStartConsultation && (
                      <button
                        onClick={() => handleStartConsultation(res)}
                        disabled={actionLoading === res.id}
                        className="py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 shadow-sm active:scale-95 disabled:opacity-50"
                      >
                        <PlayCircle className="w-4 h-4" />
                        Start Consultation
                      </button>
                    )}

                    {canPenalize && (
                      <button
                        onClick={() => handlePenalize(res)}
                        disabled={actionLoading === res.id}
                        className="py-2 px-4 bg-amber-100 hover:bg-amber-200 text-amber-800 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 border border-amber-300 active:scale-95 disabled:opacity-50"
                        title="Penalize absent patient (#1 in line)"
                      >
                        <AlertTriangle className="w-4 h-4" />
                        Penalize
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center max-w-lg mx-auto">
            <CheckCircle className="w-10 h-10 text-green-500 mx-auto mb-3" />
            <h3 className="text-base font-bold text-gray-800">Active Queue is Empty</h3>
            <p className="text-xs text-gray-500 mt-1">
              No patients are currently waiting in line for today&apos;s active clinic session.
            </p>
          </div>
        )}
      </div>

      {/* Completed & History Sub-section */}
      {completedPatients.length > 0 && (
        <div className="pt-6 border-t border-gray-200 mt-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
              <CheckCircle className="w-4 h-4 text-purple-500" />
              Completed &amp; History ({completedPatients.length})
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {completedPatients.map((res) => {
              const isPenalized =
                res.status === "penalized" || res.status === "late_limit_reached";
              return (
                <div
                  key={res.id}
                  className="bg-gray-50 p-3.5 rounded-xl border border-gray-200 flex items-center justify-between"
                >
                  <div>
                    <div className="font-bold text-gray-700 text-sm">
                      {res.childName || "Unnamed Patient"}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {isPenalized ? "Removed / Penalized" : "Consultation Completed"}
                    </div>
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      isPenalized
                        ? "bg-red-100 text-red-700"
                        : "bg-green-100 text-green-700"
                    }`}
                  >
                    {isPenalized ? "Late Limit" : "Completed"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
