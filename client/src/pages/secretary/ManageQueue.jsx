import React, { useState, useEffect } from "react";
import { Users, UserCheck, Clock, CheckCircle, Activity, Hash, MapPin, Calendar, CheckCircle2, PlayCircle, AlertTriangle } from "lucide-react";
import { subscribeToAllReservations, startConsultation, sendToDoctor, penalizeReservation, requestCheckInReminder } from "../../services/reservationService";
import { subscribeToPublishedSchedules } from "../../services/scheduleService";
import { computeReservationState, QUEUE_STATES } from "../../services/queueEngine";
import { useAuth } from "../../hooks/useAuth";
import toast from "react-hot-toast";

export default function ManageQueue() {
  const { user } = useAuth();
  const [reservations, setReservations] = useState([]);
  const [schedules, setSchedules] = useState({});
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [requestingCheckIn, setRequestingCheckIn] = useState(false);
  const [nowTs, setNowTs] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNowTs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

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

  // Active queue for today's started schedule
  const activeReservations = reservations.filter(r => r.scheduleId === activeStartedSchedule.id);
  
  // Region 1 data: Current active consultation(s) / with doctor
  const inConsultationPatients = activeReservations.filter(r => r.status === "in_consultation" || r.status === "with_doctor");

  // Region 2 data: Remaining patients waiting in line sorted by current queue order (turn in line)
  const waitingQueue = activeReservations
    .filter(r => ["checked_in", "reserved", "waiting"].includes(r.status))
    .sort((a, b) => {
      if (a.queueOrder !== undefined && b.queueOrder !== undefined) {
        return a.queueOrder - b.queueOrder;
      }
      return (a.sortTimestamp || a.createdAt || 0) - (b.sortTimestamp || b.createdAt || 0);
    });

  const firstUncheckedIdx = waitingQueue.findIndex(
    (r) => r.status === "reserved" || r.status === "waiting"
  );

  const formatTime = (timestamp) => {
    if (!timestamp) return "N/A";
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const renderStatusBadge = (status) => {
    switch (status) {
      case "with_doctor":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-800 border border-purple-200 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-600 animate-pulse" />
            With Doctor
          </span>
        );
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

  const handleSendToDoctor = async (res) => {
    try {
      setActionLoading(res.id);
      await sendToDoctor(res.id);
      toast.success(`Sent ${res.childName || "patient"} to Doctor room`);
    } catch (err) {
      toast.error("Failed to send patient to Doctor");
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

  const getNextEligibleCheckIn = () => {
    const awaitingPatients = activeReservations
      .filter((r) =>
        !["checked_in", "with_doctor", "in_consultation", "completed", "consultation_completed", "cancelled", "forfeited", "penalized", "late_limit_reached"].includes(r.status)
      )
      .sort((a, b) => {
        const timeA = a.sortTimestamp || a.createdAt || 0;
        const timeB = b.sortTimestamp || b.createdAt || 0;
        return timeA - timeB;
      });
    return awaitingPatients[0];
  };

  const nextEligibleRes = getNextEligibleCheckIn();
  const nextEligibleElapsed = nextEligibleRes
    ? nowTs - (nextEligibleRes.checkInRequestedAt || 0)
    : 999999;
  const nextEligibleCooldownSec =
    nextEligibleElapsed < 30000
      ? Math.ceil((30000 - nextEligibleElapsed) / 1000)
      : 0;

  const handleRequestCheckIn = async () => {
    if (!nextEligibleRes) {
      toast.error("All patients in queue are already checked in or processed.");
      return;
    }

    if (nextEligibleCooldownSec > 0) {
      toast.error("Check-in request already sent. Please wait before sending another reminder.");
      return;
    }

    try {
      setRequestingCheckIn(true);
      await requestCheckInReminder(nextEligibleRes.id);
      toast.success(
        `Check-in reminder sent to Queue #${nextEligibleRes.queueNumber || "?"} (${nextEligibleRes.childName || "Patient"})`
      );
    } catch (err) {
      toast.error("Failed to send check-in reminder.");
    } finally {
      setRequestingCheckIn(false);
    }
  };


  return (
    <div className="space-y-6 pb-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-200 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Live Queue Monitor</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Real-time active queue for {activeStartedSchedule.branch || "Today's Clinic Session"}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={handleRequestCheckIn}
            disabled={requestingCheckIn || nextEligibleCooldownSec > 0}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed text-white font-bold text-sm shadow-sm transition-all"
            title={
              nextEligibleCooldownSec > 0
                ? "Check-in request already sent. Please wait before sending another reminder."
                : "Remind the next awaiting patient to proceed to the clinic for QR validation"
            }
          >
            <UserCheck className="w-4 h-4" />
            <span>
              {nextEligibleCooldownSec > 0
                ? `Request Check-In (${nextEligibleCooldownSec}s)`
                : "Request Check-In"}
            </span>
          </button>
          <div className="flex items-center gap-2 bg-gray-100 px-3.5 py-2 rounded-full text-xs font-bold text-gray-700">
            <Users className="w-4 h-4 text-blue-600" />
            <span>{inConsultationPatients.length + waitingQueue.length} Total Active</span>
          </div>
        </div>
      </div>

      {/* REGION 1 — CURRENT CONSULTATION */}
      <div className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
          <Activity className="w-4 h-4 text-blue-600" />
          Current Consultation
        </h2>

        {inConsultationPatients.length > 0 ? (
          inConsultationPatients.map((res) => (
            <div
              key={res.id}
              className="p-4 sm:p-5 rounded-2xl bg-blue-50/70 border-2 border-blue-400 shadow-sm transition-all"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-12 h-12 rounded-xl bg-blue-600 text-white flex flex-col items-center justify-center shrink-0 font-black text-sm border border-blue-600 shadow-xs">
                    <span className="text-[9px] uppercase font-bold leading-none opacity-80 mb-0.5">
                      Queue
                    </span>
                    <span>#{res.queueNumber || res.queuePosition}</span>
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-blue-950 text-base truncate">
                      {res.childName || "Unnamed Patient"}
                    </h3>
                    <div className="text-xs text-blue-700 flex items-center gap-1.5 mt-1">
                      <span>Inside Doctor Room</span>
                      {res.consultationStartedAt && (
                        <span>• Started at {formatTime(res.consultationStartedAt)}</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-blue-200/50 shrink-0">
                  {renderStatusBadge(res.status)}
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="p-5 rounded-2xl bg-gray-50 border border-gray-200 text-center">
            <p className="text-sm font-bold text-gray-700">No active consultation</p>
            <p className="text-xs text-gray-500 mt-0.5">The consultation room is currently empty.</p>
          </div>
        )}
      </div>

      {/* REGION 2 — WAITING QUEUE & REGION 3 — EMPTY STATE */}
      <div className="space-y-3 pt-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-amber-500" />
            Waiting Queue ({waitingQueue.length})
          </h2>
        </div>

        {waitingQueue.length > 0 ? (
          <div className="space-y-3">
            {waitingQueue.map((res, idx) => {
              const isFirstWaiting = idx === 0;
              const canSendToDoctor =
                isFirstWaiting &&
                res.status === "checked_in";
              const canPenalize =
                idx === firstUncheckedIdx && firstUncheckedIdx !== -1;

              return (
                <div
                  key={res.id}
                  className={`p-4 sm:p-5 rounded-2xl border transition-all ${
                    isFirstWaiting
                      ? "bg-white border-blue-300 ring-2 ring-blue-500/10 shadow-sm"
                      : "bg-white border-gray-200 shadow-2xs hover:border-gray-300"
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    {/* Left: Original Queue Number + Patient Name */}
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div
                        className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center shrink-0 font-black text-sm border ${
                          isFirstWaiting
                            ? "bg-gray-900 text-white border-gray-900"
                            : "bg-gray-100 text-gray-700 border-gray-200"
                        }`}
                      >
                        <span className="text-[9px] uppercase font-bold leading-none opacity-80 mb-0.5">
                          Queue
                        </span>
                        <span>#{res.queueNumber || res.queuePosition}</span>
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
                      </div>
                    </div>

                    {/* Right: Status Badge & Action Buttons */}
                    <div className="flex items-center justify-between sm:justify-end gap-3 pt-3 sm:pt-0 border-t sm:border-t-0 border-gray-100 shrink-0">
                      {renderStatusBadge(res.status)}

                      {canSendToDoctor && (
                        <button
                          onClick={() => handleSendToDoctor(res)}
                          disabled={actionLoading === res.id}
                          className="py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 shadow-sm active:scale-95 disabled:opacity-50"
                          title="Send patient to Doctor room"
                        >
                          <PlayCircle className="w-4 h-4" />
                          Send to Doctor
                        </button>
                      )}

                      {canPenalize && (
                        <button
                          onClick={() => handlePenalize(res)}
                          disabled={actionLoading === res.id}
                          className="py-2 px-4 bg-amber-100 hover:bg-amber-200 text-amber-800 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 border border-amber-300 active:scale-95 disabled:opacity-50"
                          title="Penalize absent patient (#1 waiting patient)"
                        >
                          <AlertTriangle className="w-4 h-4" />
                          Penalize
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* REGION 3 — EMPTY STATE */
          <div className="p-8 bg-white rounded-2xl border border-gray-200 text-center">
            <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-2" />
            <p className="text-sm font-bold text-gray-800">No patients waiting in the queue.</p>
          </div>
        )}
      </div>
    </div>
  );
}
