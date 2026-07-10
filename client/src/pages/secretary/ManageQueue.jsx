import React, { useState, useEffect } from "react";
import { Users, UserCheck, Clock, CheckCircle, Activity, Hash, MapPin, Calendar, CheckCircle2, PlayCircle, AlertTriangle, UserPlus } from "lucide-react";
import { subscribeToAllReservations, startConsultation, checkInReservation, penalizeReservation } from "../../services/reservationService";
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

  // Active queue sorted by dynamic queue position
  const waitingPatients = reservations.filter(r => r.status === "reserved" || r.status === "waiting").sort((a, b) => (a.queuePosition || 999) - (b.queuePosition || 999));
  const checkedInPatients = reservations.filter(r => r.status === "checked_in").sort((a, b) => (a.queuePosition || 999) - (b.queuePosition || 999));
  const inConsultationPatients = reservations.filter(r => r.status === "in_consultation");
  const completedPatients = reservations.filter(r => ["consultation_completed", "completed", "penalized", "late_limit_reached"].includes(r.status)).sort((a, b) => (b.consultationCompletedAt || b.penalizedAt || 0) - (a.consultationCompletedAt || a.penalizedAt || 0));

  // Determine who is #1 in line across all active patients
  const activeQueue = reservations.filter(r => ["reserved", "checked_in"].includes(r.status)).sort((a, b) => (a.queuePosition || 999) - (b.queuePosition || 999));
  const firstInQueueId = activeQueue.length > 0 ? activeQueue[0].id : null;

  const formatTime = (timestamp) => {
    if (!timestamp) return "N/A";
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
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

  const handleCheckIn = async (res) => {
    try {
      setActionLoading(res.id);
      await checkInReservation(res.id, user?.uid || "secretary");
      toast.success(`${res.childName} checked in successfully`);
    } catch (err) {
      toast.error("Failed to check in patient");
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
    <div className="space-y-6 pb-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Queue Flow Manager</h1>
          <p className="text-gray-500 text-sm mt-1">Manage patient check-ins, queue order, penalties, and start doctor consultations.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* In Consultation */}
        <div className="lg:col-span-1 space-y-4">
          <div className="flex items-center justify-between border-b border-gray-200 pb-2">
            <h2 className="text-lg font-bold text-gray-800 flex items-center">
              <Activity className="w-5 h-5 mr-2 text-blue-500" />
              In Consultation
            </h2>
            <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2 py-0.5 rounded-full">{inConsultationPatients.length}</span>
          </div>

          <div className="space-y-3">
            {inConsultationPatients.length > 0 ? inConsultationPatients.map(res => (
              <div key={res.id} className="bg-blue-50 p-4 rounded-xl border-2 border-blue-200 shadow-sm relative overflow-hidden">
                <div className="flex items-start justify-between mb-2">
                  <div className="font-bold text-blue-900 text-sm">{res.childName}</div>
                  <div className="text-xs font-black text-blue-500 bg-blue-100 px-1.5 py-0.5 rounded">#{res.queuePosition || "?"}</div>
                </div>
                <div className="mb-3">
                  <span className="text-[10px] uppercase font-bold tracking-wider bg-blue-200 text-blue-800 px-2 py-0.5 rounded-md">Currently With Doctor</span>
                </div>
                <div className="text-xs text-blue-700 flex flex-col gap-1">
                  <div className="flex items-center"><PlayCircle className="w-3.5 h-3.5 mr-1" /> Started at {formatTime(res.consultationStartedAt)}</div>
                </div>
              </div>
            )) : (
              <div className="bg-white p-6 rounded-xl border border-gray-200 border-dashed text-center">
                <p className="text-xs text-gray-500 font-medium">Doctor is available</p>
              </div>
            )}
          </div>
        </div>

        {/* Checked In Patients */}
        <div className="lg:col-span-1 space-y-4">
          <div className="flex items-center justify-between border-b border-gray-200 pb-2">
            <h2 className="text-lg font-bold text-gray-800 flex items-center">
              <UserCheck className="w-5 h-5 mr-2 text-green-500" />
              Checked In
            </h2>
            <span className="bg-green-100 text-green-800 text-xs font-bold px-2 py-0.5 rounded-full">{checkedInPatients.length}</span>
          </div>

          <div className="space-y-3">
            {checkedInPatients.length > 0 ? checkedInPatients.map((res, index) => {
              const isFirstInEntireQueue = res.id === firstInQueueId;
              const canStartConsultation = inConsultationPatients.length === 0 && isFirstInEntireQueue;

              return (
                <div key={res.id} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1 h-full bg-green-400"></div>
                  <div className="flex items-start justify-between mb-2">
                    <div className="font-bold text-gray-800 text-sm">{res.childName}</div>
                    <div className="text-xs font-black text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">#{res.queuePosition}</div>
                  </div>
                  <div className="text-xs text-gray-500 flex flex-col gap-1 mt-3 mb-3">
                    <div className="flex items-center"><Clock className="w-3.5 h-3.5 mr-1 text-green-600" /> Checked in at {formatTime(res.checkedInAt)}</div>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                    {canStartConsultation && (
                      <button
                        onClick={() => handleStartConsultation(res)}
                        disabled={actionLoading === res.id}
                        className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1 shadow-sm"
                      >
                        <PlayCircle className="w-3.5 h-3.5" />
                        Start Consultation
                      </button>
                    )}
                    {isFirstInEntireQueue && (
                      <button
                        onClick={() => handlePenalize(res)}
                        disabled={actionLoading === res.id}
                        className="px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-700 text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1 border border-amber-200"
                        title="Penalize absent patient (#1 in line)"
                      >
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Penalize ({res.penaltyCount || 0})
                      </button>
                    )}
                  </div>
                </div>
              );
            }) : (
              <div className="bg-white p-6 rounded-xl border border-gray-200 border-dashed text-center">
                <p className="text-xs text-gray-500 font-medium">No checked-in patients</p>
              </div>
            )}
          </div>
        </div>

        {/* Waiting (Not Yet Checked In) */}
        <div className="lg:col-span-1 space-y-4">
          <div className="flex items-center justify-between border-b border-gray-200 pb-2">
            <h2 className="text-lg font-bold text-gray-800 flex items-center">
              <Clock className="w-5 h-5 mr-2 text-amber-500" />
              Not Checked In
            </h2>
            <span className="bg-amber-100 text-amber-800 text-xs font-bold px-2 py-0.5 rounded-full">{waitingPatients.length}</span>
          </div>

          <div className="space-y-3">
            {waitingPatients.length > 0 ? waitingPatients.map(res => {
              const schedule = schedules[res.scheduleId] || {};
              const isIncomplete = !res.childName || !res.age || !res.sex;
              const isFirstInEntireQueue = res.id === firstInQueueId;

              return (
                <div key={res.id} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1 h-full bg-amber-400"></div>
                  <div className="flex items-start justify-between mb-2">
                    <div className="font-bold text-gray-800 text-sm">{isIncomplete ? <span className="text-amber-600 italic">Incomplete Info</span> : res.childName}</div>
                    <div className="flex items-center gap-1.5 flex-wrap justify-end">
                      {res.penaltyCount > 0 && (
                        <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 uppercase">
                          Late ({res.penaltyCount})
                        </span>
                      )}
                      <div className="text-xs font-black text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">#{res.queuePosition || "?"}</div>
                    </div>
                  </div>
                  <div className="text-xs text-gray-500 flex flex-col gap-1 mt-3 mb-3">
                    <div className="flex items-center"><Hash className="w-3.5 h-3.5 mr-1" /> Code: <b>{res.reservationCode}</b></div>
                    <div className="flex items-center"><MapPin className="w-3.5 h-3.5 mr-1" /> {schedule.branch || "Unknown"}</div>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                    <button
                      onClick={() => handleCheckIn(res)}
                      disabled={actionLoading === res.id || isIncomplete}
                      className="flex-1 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1 shadow-sm"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      Check In
                    </button>
                    {isFirstInEntireQueue && (
                      <button
                        onClick={() => handlePenalize(res)}
                        disabled={actionLoading === res.id}
                        className="px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-700 text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1 border border-amber-200"
                        title="Penalize absent patient (#1 in line)"
                      >
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Penalize
                      </button>
                    )}
                  </div>
                </div>
              );
            }) : (
              <div className="bg-white p-6 rounded-xl border border-gray-200 border-dashed text-center">
                <p className="text-xs text-gray-500 font-medium">No waiting patients</p>
              </div>
            )}
          </div>
        </div>

        {/* Completed & History */}
        <div className="lg:col-span-1 space-y-4">
          <div className="flex items-center justify-between border-b border-gray-200 pb-2">
            <h2 className="text-lg font-bold text-gray-800 flex items-center">
              <CheckCircle className="w-5 h-5 mr-2 text-purple-500" />
              Completed & History
            </h2>
            <span className="bg-purple-100 text-purple-800 text-xs font-bold px-2 py-0.5 rounded-full">{completedPatients.length}</span>
          </div>

          <div className="space-y-3">
            {completedPatients.length > 0 ? completedPatients.map(res => {
              const schedule = schedules[res.scheduleId] || {};
              const isPenalized = res.status === "penalized" || res.status === "late_limit_reached";
              return (
                <div key={res.id} className="bg-gray-50 p-4 rounded-xl border border-gray-200 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-bold text-gray-600 text-sm">{res.childName}</div>
                    {isPenalized ? (
                      <span className="text-[10px] font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded">Late Limit Reached</span>
                    ) : (
                      <span className="text-[10px] font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded">Completed</span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 flex flex-col gap-1">
                    <div className="flex items-center"><Calendar className="w-3.5 h-3.5 mr-1" /> {formatDate(schedule.clinicDate)}</div>
                  </div>
                </div>
              );
            }) : (
              <div className="bg-white p-6 rounded-xl border border-gray-200 border-dashed text-center">
                <p className="text-xs text-gray-500 font-medium">No completed consultations</p>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
