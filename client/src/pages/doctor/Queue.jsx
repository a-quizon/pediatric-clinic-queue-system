import React, { useState, useEffect, useMemo } from "react";
import { subscribeToPublishedSchedules, updateQueueStatus, completeSchedule } from "../../services/scheduleService";
import { subscribeToAllReservations, startConsultation, completeConsultation, expireReservation } from "../../services/reservationService";
import { getNextEligiblePatient } from "../../services/queueEligibilityService";
import { isReservationExpired } from "../../services/timeService";
import { Activity, Play, Pause, Square, CheckCircle, User, AlertCircle, FileText, X, Clock, MapPin, Users, CheckCircle2, Lock } from "lucide-react";
import ScheduleConfirmModal from "../../components/schedule/ScheduleConfirmModal";
import toast from "react-hot-toast";

export default function Queue() {
  const [schedules, setSchedules] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);

  const [isCompleteModalOpen, setIsCompleteModalOpen] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [doctorNotes, setDoctorNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [isCloseQueueModalOpen, setIsCloseQueueModalOpen] = useState(false);
  const [isEndSessionModalOpen, setIsEndSessionModalOpen] = useState(false);

  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
  const [infoPatient, setInfoPatient] = useState(null);

  useEffect(() => {
    const unsubSchedules = subscribeToPublishedSchedules((data) => {
      setSchedules(data);
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

  const [tick, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!schedules || !reservations) return;
    const active = schedules.find(s => s.status === 'published' && s.queueStatus === 'active');
    if (!active || !active.queueStartedAt) return;
    reservations.forEach(r => {
      if (r.scheduleId === active.id && (r.status === 'reserved' || r.status === 'waiting')) {
        if (isReservationExpired(r, active)) {
          expireReservation(r.id);
        }
      }
    });
  }, [tick, schedules, reservations]);

  const activeSchedule = useMemo(() => {
    return schedules.find(s => s.status === 'published' && (s.queueStatus === 'active' || s.queueStatus === 'paused' || s.queueStatus === 'closed'));
  }, [schedules]);
  
  const scheduleReservations = useMemo(() => {
    if (!activeSchedule) return [];
    const res = reservations.filter(r => r.scheduleId === activeSchedule.id);
    const sortedAll = [...res].sort((a, b) => a.createdAt - b.createdAt);
    return res.map(r => {
      const idx = sortedAll.findIndex(item => item.id === r.id);
      const permNum = idx >= 0 ? idx + 1 : (r.queuePosition || 1);
      return {
        ...r,
        queuePosition: permNum,
        permanentQueueNumber: permNum
      };
    });
  }, [reservations, activeSchedule]);

  const {
    checkedInQueue,
    waitingValidationQueue,
    inConsultation,
    completedConsultations,
    stats
  } = useMemo(() => {
    const waitingValidation = scheduleReservations.filter(r => r.status === "reserved" || r.status === "waiting" || r.status === "expired" || r.status === "validation_expired")
      .sort((a, b) => (a.queuePosition || 999) - (b.queuePosition || 999));
      
    const checkedIn = scheduleReservations.filter(r => r.status === "checked_in")
      .sort((a, b) => (a.queuePosition || 999) - (b.queuePosition || 999));

    const inCons = scheduleReservations.find(r => r.status === "in_consultation");

    const completed = scheduleReservations.filter(r => r.status === "consultation_completed")
      .sort((a, b) => (b.consultationCompletedAt || 0) - (a.consultationCompletedAt || 0));

    const reservedCount = scheduleReservations.filter(r => ["reserved", "waiting", "checked_in", "in_consultation", "expired", "validation_expired"].includes(r.status)).length;
    
    return {
      waitingValidationQueue: waitingValidation,
      checkedInQueue: checkedIn,
      inConsultation: inCons,
      completedConsultations: completed,
      stats: {
        checkedIn: checkedIn.length,
        waitingValidation: waitingValidation.length,
        inConsultationCount: inCons ? 1 : 0,
        completedCount: completed.length,
        availableSlots: activeSchedule ? Math.max(0, activeSchedule.slotCapacity - reservedCount) : 0
      }
    };
  }, [scheduleReservations, activeSchedule]);

  const canEndSession = waitingValidationQueue.length === 0 && checkedInQueue.length === 0 && !inConsultation;

  const nextEligiblePatient = useMemo(() => {
    const result = getNextEligiblePatient(scheduleReservations);
    if (result.eligible) {
      return result.patient;
    }
    if (result.blocked) {
      return { blocked: true, message: result.waitingMessage };
    }
    return null;
  }, [scheduleReservations]);

  const handleQueueControl = async (status) => {
    if (!activeSchedule) return;
    if (status === 'closed') {
      setIsCloseQueueModalOpen(true);
      return;
    }
    try {
      await updateQueueStatus(activeSchedule.id, status);
      toast.success(`Queue status updated to ${status}`);
    } catch (err) {
      console.error(err);
      toast.error("Failed to update queue status");
    }
  };

  const confirmCloseQueue = async () => {
    try {
      await updateQueueStatus(activeSchedule.id, 'closed');
      toast.success("Queue closed to new reservations.");
      setIsCloseQueueModalOpen(false);
    } catch (err) {
      console.error(err);
      toast.error("Failed to close queue");
    }
  };

  const handleEndSessionClick = () => {
    if (!canEndSession) {
      toast.error("All remaining patients must be completed before ending the clinic session.");
      return;
    }
    setIsEndSessionModalOpen(true);
  };

  const confirmEndSession = async () => {
    try {
      await updateQueueStatus(activeSchedule.id, 'completed');
      await completeSchedule(activeSchedule.id);
      toast.success("Clinic session ended successfully.");
      setIsEndSessionModalOpen(false);
    } catch (err) {
      console.error(err);
      toast.error("Failed to end clinic session");
    }
  };

  const handleStartConsultation = async (res) => {
    if (inConsultation) {
      toast.error("You already have an active consultation. Please complete it first.");
      return;
    }
    const currentQueueStatus = activeSchedule?.queueStatus || 'not_started';
    if (currentQueueStatus === "not_started") {
      toast.error("Cannot start consultation. The queue has not started yet.");
      return;
    }
    if (currentQueueStatus === "paused") {
      toast.error("Cannot start consultation while queue is paused.");
      return;
    }
    if (currentQueueStatus === "ended" || currentQueueStatus === "completed") {
      toast.error("Cannot start consultation. The queue has ended.");
      return;
    }
    try {
      await startConsultation(res.id);
      toast.success("Consultation started.");
    } catch (err) {
      console.error(err);
      toast.error("Failed to start consultation.");
    }
  };

  const handleOpenCompleteModal = (res) => {
    const currentQueueStatus = activeSchedule?.queueStatus || 'not_started';
    if (currentQueueStatus === "paused") {
      toast.error("Cannot complete consultation while queue is paused.");
      return;
    }
    if (currentQueueStatus === "ended" || currentQueueStatus === "completed") {
      toast.error("Cannot complete consultation. The queue has ended.");
      return;
    }
    setSelectedPatient(res);
    setDoctorNotes("");
    setIsCompleteModalOpen(true);
  };

  const handleComplete = async () => {
    if (!selectedPatient) return;
    setIsSubmitting(true);
    try {
      await completeConsultation(selectedPatient.id, doctorNotes.trim());
      toast.success("Consultation completed successfully.");
      setIsCompleteModalOpen(false);
      setSelectedPatient(null);
    } catch (err) {
      console.error(err);
      toast.error("Failed to complete consultation.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getQueueStatusBadge = (status) => {
    const s = status || "not_started";
    switch(s) {
      case 'not_started': return <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full font-bold text-xs flex items-center shadow-sm border border-gray-200"><div className="w-2 h-2 rounded-full bg-gray-400 mr-2"></div>Not Started</span>;
      case 'active': return <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full font-bold text-xs flex items-center shadow-sm border border-green-200"><div className="w-2 h-2 rounded-full bg-green-500 mr-2 animate-pulse"></div>Active</span>;
      case 'paused': return <span className="px-3 py-1 bg-amber-100 text-amber-700 rounded-full font-bold text-xs flex items-center shadow-sm border border-amber-200"><div className="w-2 h-2 rounded-full bg-amber-500 mr-2"></div>Paused</span>;
      case 'closed': return <span className="px-3 py-1 bg-amber-100 text-amber-800 rounded-full font-bold text-xs flex items-center shadow-sm border border-amber-300"><div className="w-2 h-2 rounded-full bg-amber-500 mr-2"></div>Queue Closed</span>;
      case 'ended': 
      case 'completed': return <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full font-bold text-xs flex items-center shadow-sm border border-red-200"><div className="w-2 h-2 rounded-full bg-red-500 mr-2"></div>{s === 'ended' ? 'Ended' : 'Completed'}</span>;
      default: return null;
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!activeSchedule) {
    return (
      <div className="space-y-6 pb-6 text-center py-20 bg-white rounded-2xl border border-gray-100 shadow-sm mt-6">
        <Activity className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-gray-800 mb-2">No Clinic Queue is Currently Active</h2>
        <p className="text-gray-500 max-w-md mx-auto mb-6">You don't have an active clinic session running. Go to Schedule Management and click Start Queue on a published schedule to begin today's clinic.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-black text-gray-800">Queue Control Center</h1>
          <p className="text-gray-500 text-sm">Manage real-time patient flow and monitor today's active clinic session.</p>
        </div>
      </div>

      {/* Active Queue Session Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-black text-gray-800 flex items-center">
              <MapPin className="w-5 h-5 mr-2 text-blue-600" />
              {activeSchedule.branch}
            </h2>
            <div className="text-gray-500 text-sm mt-1 flex flex-wrap items-center gap-x-4 gap-y-1">
              <span className="flex items-center">
                <Clock className="w-4 h-4 mr-1.5" />
                {new Date(activeSchedule.clinicDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </span>
              <span className="flex items-center font-medium text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-lg border border-blue-100">
                Validation Window: <strong className="ml-1">{activeSchedule.validationWindow || 15} mins</strong>
              </span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            {getQueueStatusBadge(activeSchedule.queueStatus)}
            {activeSchedule.queueStatusUpdatedAt && (
              <div className="text-sm text-gray-500">
                Updated: {new Date(activeSchedule.queueStatusUpdatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            )}
            <div className="flex items-center gap-2">
              {activeSchedule.queueStatus === 'active' && (
                <>
                  <button onClick={() => handleQueueControl('paused')} className="p-2 bg-amber-50 text-amber-600 hover:bg-amber-100 rounded-lg transition-colors border border-amber-100" title="Pause Queue">
                    <Pause className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleQueueControl('closed')} className="p-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg transition-colors border border-red-100" title="Close Queue to New Reservations">
                    <Lock className="w-4 h-4" />
                  </button>
                </>
              )}
              {activeSchedule.queueStatus === 'paused' && (
                <>
                  <button onClick={() => handleQueueControl('active')} className="p-2 bg-green-50 text-green-600 hover:bg-green-100 rounded-lg transition-colors border border-green-100" title="Resume Queue">
                    <Play className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleQueueControl('closed')} className="p-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg transition-colors border border-red-100" title="Close Queue to New Reservations">
                    <Lock className="w-4 h-4" />
                  </button>
                </>
              )}
              {(activeSchedule.queueStatus === 'active' || activeSchedule.queueStatus === 'paused' || activeSchedule.queueStatus === 'closed') && (
                <button 
                  onClick={handleEndSessionClick}
                  className={`px-4 py-2 font-bold rounded-xl text-sm transition-all flex items-center shadow-sm ${
                    canEndSession 
                      ? 'bg-red-600 text-white hover:bg-red-700 cursor-pointer' 
                      : 'bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed'
                  }`}
                  title={!canEndSession ? "Finish all remaining consultations to end session" : "End Clinic Session"}
                >
                  <Square className="w-4 h-4 mr-2" /> End Clinic Session
                </button>
              )}
              {(activeSchedule.queueStatus === 'ended' || activeSchedule.queueStatus === 'completed') && (
                <span className="font-bold text-gray-500 px-3 py-1.5 bg-gray-100 rounded-xl">Clinic Session Ended</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Informational Banner when Queue is Closed */}
      {activeSchedule.queueStatus === 'closed' && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 text-amber-800 flex items-start text-sm shadow-sm mb-6">
          <Lock className="w-5 h-5 text-amber-600 mr-3 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-bold text-amber-900 mb-1">Queue Closed</h4>
            <p className="text-amber-700 leading-relaxed">
              No new reservations are being accepted. Existing reserved patients may still validate, check in, and complete their consultations.
            </p>
          </div>
        </div>
      )}
          {/* Stats Grid - Removed In Consult Stat */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 text-center">
              <div className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-1">Checked In</div>
              <div className="text-2xl font-black text-gray-800">{stats.checkedIn}</div>
            </div>
            <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 text-center">
              <div className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-1">Reserved</div>
              <div className="text-2xl font-black text-gray-800">{stats.waitingValidation}</div>
            </div>
            <div className="bg-green-50 p-4 rounded-xl border border-green-100 text-center">
              <div className="text-green-600 text-xs font-bold uppercase tracking-wider mb-1">Completed</div>
              <div className="text-2xl font-black text-green-700">{stats.completedCount}</div>
            </div>
            <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 text-center">
              <div className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-1">Slots Available</div>
              <div className="text-2xl font-black text-gray-800">{stats.availableSlots}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Workflows */}
            <div className="lg:col-span-5 space-y-6">
              
              {/* Current Consultation */}
              <div className="bg-white rounded-2xl shadow-sm border border-blue-200 overflow-hidden">
                <div className="bg-blue-600 px-5 py-3 flex justify-between items-center">
                  <h3 className="font-bold text-white flex items-center">
                    <Activity className="w-4 h-4 mr-2" /> Current Consultation
                  </h3>
                  {inConsultation && (
                    <span className="bg-white/20 text-white text-xs px-2.5 py-1 rounded-full font-bold">
                      Queue #{inConsultation.queuePosition}
                    </span>
                  )}
                </div>
                
                {inConsultation ? (
                  <div 
                    className="p-6 cursor-pointer hover:bg-blue-50/50 transition-colors"
                    onClick={() => {
                      setInfoPatient(inConsultation);
                      setIsInfoModalOpen(true);
                    }}
                  >
                    <div className="mb-6">
                      <div className="flex justify-between items-start">
                        <div className="text-2xl font-black text-gray-800 mb-1">{inConsultation.childName || "N/A"}</div>
                        <span className="text-xs text-blue-600 font-bold bg-blue-100 px-2 py-1 rounded-lg">View Details</span>
                      </div>
                      <div className="text-sm text-gray-500 flex items-center">
                        <User className="w-4 h-4 mr-1.5" /> Parent: {inConsultation.parentEmail}
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
                      <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                        <div className="text-gray-400 font-bold text-xs uppercase mb-1">Checked In At</div>
                        <div className="font-semibold text-gray-700">
                          {inConsultation.checkedInAt ? new Date(inConsultation.checkedInAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : "N/A"}
                        </div>
                      </div>
                      <div className="bg-blue-50 p-3 rounded-xl border border-blue-100">
                        <div className="text-blue-500 font-bold text-xs uppercase mb-1">Started At</div>
                        <div className="font-semibold text-blue-700">
                          {inConsultation.consultationStartedAt ? new Date(inConsultation.consultationStartedAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : "N/A"}
                        </div>
                      </div>
                    </div>
                    
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenCompleteModal(inConsultation);
                      }}
                      className="w-full py-3.5 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 transition-colors flex items-center justify-center shadow-sm relative z-10"
                    >
                      <CheckCircle className="w-5 h-5 mr-2" /> Complete Consultation
                    </button>
                  </div>
                ) : (
                  <div className="p-10 text-center text-gray-400">
                    <Activity className="w-10 h-10 mx-auto mb-3 opacity-50" />
                    <p className="font-medium">No patient currently in consultation.</p>
                  </div>
                )}
              </div>

              {/* Next Eligible Patient */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="bg-gray-50 px-5 py-3 border-b border-gray-100">
                  <h3 className="font-bold text-gray-700 flex items-center">
                    <Users className="w-4 h-4 mr-2" /> Next Eligible Patient
                  </h3>
                </div>
                
                <div className="p-6">
                  {nextEligiblePatient && nextEligiblePatient.blocked ? (
                    <div className="bg-amber-50 rounded-xl border border-amber-200 p-5 flex flex-col items-center text-center text-amber-700">
                      <AlertCircle className="w-8 h-8 mb-3 text-amber-500" />
                      <div className="font-bold text-base mb-1">Not Ready for Consultation</div>
                      <div className="text-sm font-medium">{nextEligiblePatient.message || "Waiting for the next parent to validate their QR Code."}</div>
                    </div>
                  ) : nextEligiblePatient ? (
                    <div>
                      <div className="flex justify-between items-start mb-6">
                        <div>
                          <div className="text-xl font-black text-gray-800 mb-1">{nextEligiblePatient.childName || "N/A"}</div>
                          <span className="bg-green-100 text-green-700 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">
                            Checked In
                          </span>
                        </div>
                        <div className="bg-blue-50 text-blue-600 w-12 h-12 rounded-xl flex items-center justify-center border border-blue-100">
                          <span className="font-black">#{nextEligiblePatient.queuePosition}</span>
                        </div>
                      </div>
                      
                      <div className="flex items-center text-sm text-gray-500 mb-6 bg-gray-50 p-3 rounded-xl border border-gray-100">
                        <Clock className="w-4 h-4 mr-2 text-gray-400" />
                        Checked In: {nextEligiblePatient.checkedInAt ? new Date(nextEligiblePatient.checkedInAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : "N/A"}
                      </div>
                      
                      <button 
                        onClick={() => handleStartConsultation(nextEligiblePatient)}
                        className="w-full py-3.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors flex items-center justify-center shadow-sm"
                      >
                        <Play className="w-5 h-5 mr-2" /> Start Consultation
                      </button>
                    </div>
                  ) : (
                    <div className="py-6 text-center text-gray-400">
                      <p className="font-medium">Queue is currently empty.</p>
                    </div>
                  )}
                </div>
              </div>

            </div>

            {/* Right Column: Queues */}
            <div className="lg:col-span-7 space-y-6">
              
              {/* Checked In Queue */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
                <h3 className="font-bold text-gray-800 mb-4 flex items-center">
                  <CheckCircle2 className="w-4 h-4 mr-2 text-green-600" /> 
                  Checked In Queue <span className="ml-2 bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-xs">{checkedInQueue.length}</span>
                </h3>
                
                {checkedInQueue.length > 0 ? (
                  <div className="space-y-3">
                    {checkedInQueue.map(res => (
                      <div key={res.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                        <div className="flex items-center">
                          <div className="w-10 h-10 bg-white border border-gray-200 rounded-lg flex items-center justify-center font-black text-gray-700 mr-4 shadow-sm">
                            {res.queuePosition}
                          </div>
                          <div>
                            <div className="font-bold text-gray-800">{res.childName || "N/A"}</div>
                            <div className="text-xs text-gray-500">Checked in: {res.checkedInAt ? new Date(res.checkedInAt).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : 'N/A'}</div>
                          </div>
                        </div>
                        <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded">Checked In</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 text-sm text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                    No patients currently checked in.
                  </div>
                )}
              </div>

              {/* Waiting Validation */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
                <h3 className="font-bold text-gray-800 mb-4 flex items-center">
                  <Clock className="w-4 h-4 mr-2 text-amber-500" /> 
                  Waiting Validation <span className="ml-2 bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-xs">{waitingValidationQueue.length}</span>
                </h3>
                
                {waitingValidationQueue.length > 0 ? (
                  <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                    {waitingValidationQueue.map(res => {
                      const expired = isReservationExpired(res, activeSchedule);
                      return (
                        <div key={res.id} className="flex items-center justify-between p-3 bg-white rounded-xl border border-gray-100">
                          <div className="flex items-center">
                            <div className="w-8 h-8 bg-gray-50 rounded-lg flex items-center justify-center font-bold text-gray-500 mr-3 text-sm">
                              #{res.queuePosition}
                            </div>
                            <div>
                              <div className="font-semibold text-gray-700 text-sm">{res.childName || res.parentEmail}</div>
                            </div>
                          </div>
                          {expired ? (
                            <span className="text-[10px] font-bold text-red-600 bg-red-50 px-2 py-1 rounded uppercase border border-red-100">Validation Expired</span>
                          ) : (
                            <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded uppercase">Waiting Val</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-4 text-sm text-gray-400">
                    No patients waiting for validation.
                  </div>
                )}
              </div>

              {/* Completed */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
                <h3 className="font-bold text-gray-800 mb-4 flex items-center">
                  <CheckCircle className="w-4 h-4 mr-2 text-gray-500" /> 
                  Recently Completed <span className="ml-2 bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-xs">{completedConsultations.length}</span>
                </h3>
                
                {completedConsultations.length > 0 ? (
                  <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                    {completedConsultations.map(res => (
                      <div key={res.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100 opacity-75">
                        <div className="flex items-center">
                          <div className="font-semibold text-gray-700 text-sm">{res.childName || "N/A"}</div>
                        </div>
                        <div className="flex items-center gap-3">
                          {res.doctorNotes && (
                            <span className="flex items-center text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded uppercase">
                              <FileText className="w-3 h-3 mr-1" /> Notes
                            </span>
                          )}
                          <span className="text-xs text-gray-400">{res.consultationCompletedAt ? new Date(res.consultationCompletedAt).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : ''}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4 text-sm text-gray-400">
                    No completed consultations yet.
                  </div>
                )}
              </div>

            </div>
          </div>

      {/* Complete Modal */}
      {isCompleteModalOpen && selectedPatient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-5 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-800 flex items-center">
                <CheckCircle className="w-5 h-5 mr-2 text-green-600" />
                Complete Consultation
              </h2>
              <button onClick={() => setIsCompleteModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-lg hover:bg-gray-50">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto">
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 mb-6 flex justify-between items-center">
                <div>
                  <div className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-1">Patient</div>
                  <div className="font-bold text-gray-800 text-lg">{selectedPatient.childName}</div>
                </div>
                <div className="bg-white border border-gray-200 px-3 py-1.5 rounded-lg text-sm font-bold text-gray-600 shadow-sm">
                  #{selectedPatient.queuePosition}
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Doctor's Notes (Optional)</label>
                <p className="text-xs text-gray-500 mb-3">Add any medical notes, prescriptions, or follow-up instructions. These will be visible to the parent.</p>
                <textarea 
                  value={doctorNotes}
                  onChange={(e) => setDoctorNotes(e.target.value)}
                  placeholder="Enter consultation notes here..."
                  rows={5}
                  className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all resize-none"
                ></textarea>
              </div>
            </div>

            <div className="p-5 border-t border-gray-100 bg-gray-50 flex gap-3 justify-end">
              <button 
                onClick={() => setIsCompleteModalOpen(false)}
                disabled={isSubmitting}
                className="px-5 py-2.5 text-gray-600 font-semibold bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button 
                onClick={handleComplete}
                disabled={isSubmitting}
                className="px-5 py-2.5 text-white font-bold bg-green-600 rounded-xl hover:bg-green-700 transition-colors flex items-center shadow-sm disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Completing...
                  </>
                ) : "Complete Session"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Info Modal */}
      {isInfoModalOpen && infoPatient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-5 border-b border-gray-100 bg-gray-50">
              <h2 className="text-lg font-bold text-gray-800 flex items-center">
                <FileText className="w-5 h-5 mr-2 text-blue-600" />
                Patient Details
              </h2>
              <button onClick={() => setIsInfoModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-lg hover:bg-gray-200">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <div className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-1">Patient</div>
                  <div className="text-2xl font-black text-gray-800">{infoPatient.childName || "N/A"}</div>
                </div>
                <div className="bg-blue-50 text-blue-600 border border-blue-100 px-4 py-2 rounded-xl text-lg font-black shadow-sm">
                  #{infoPatient.queuePosition}
                </div>
              </div>
              
              <div className="space-y-4">
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                  <div className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-1">Parent</div>
                  <div className="font-semibold text-gray-800">{infoPatient.parentEmail || "N/A"}</div>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                    <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">Branch</div>
                    <div className="font-semibold text-gray-800 text-sm">{activeSchedule?.branch || "N/A"}</div>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                    <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">Date</div>
                    <div className="font-semibold text-gray-800 text-sm">{activeSchedule ? new Date(activeSchedule.clinicDate).toLocaleDateString() : "N/A"}</div>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                    <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">Checked In</div>
                    <div className="font-semibold text-gray-800 text-sm">{infoPatient.checkedInAt ? new Date(infoPatient.checkedInAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : "N/A"}</div>
                  </div>
                  <div className="bg-blue-50 p-3 rounded-xl border border-blue-100">
                    <div className="text-[10px] text-blue-500 font-bold uppercase tracking-wider mb-1">Consult Started</div>
                    <div className="font-semibold text-blue-700 text-sm">{infoPatient.consultationStartedAt ? new Date(infoPatient.consultationStartedAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : "N/A"}</div>
                  </div>
                </div>

                <div className="bg-amber-50 p-4 rounded-xl border border-amber-100">
                  <div className="text-xs text-amber-600 font-bold uppercase tracking-wider mb-2 flex items-center">
                    <AlertCircle className="w-4 h-4 mr-1.5" /> Concern / Reason for Visit
                  </div>
                  <div className="font-medium text-amber-900 text-sm whitespace-pre-wrap">
                    {infoPatient.concern || "No concern provided by parent."}
                  </div>
                </div>
              </div>
            </div>

            <div className="p-5 border-t border-gray-100 flex justify-end">
              <button 
                onClick={() => setIsInfoModalOpen(false)}
                className="px-6 py-2.5 text-white font-bold bg-gray-800 rounded-xl hover:bg-gray-900 transition-colors shadow-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Close Queue Confirmation Modal */}
      {isCloseQueueModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-5 border-b border-gray-100 bg-amber-50">
              <h2 className="text-lg font-bold text-amber-800 flex items-center">
                <Lock className="w-5 h-5 mr-2 text-amber-600" />
                Close Queue to New Reservations?
              </h2>
              <button onClick={() => setIsCloseQueueModalOpen(false)} className="text-amber-400 hover:text-amber-600 transition-colors p-1 rounded-lg hover:bg-amber-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6">
              <p className="text-gray-700 font-medium text-center">
                Are you sure you want to close this queue to new reservations?
              </p>
              <p className="text-gray-500 text-sm text-center mt-2">
                No new reservations will be accepted. However, existing reservations remain valid and ongoing consultations will continue normally.
              </p>
            </div>

            <div className="p-5 border-t border-gray-100 flex justify-end gap-3 bg-gray-50">
              <button 
                onClick={() => setIsCloseQueueModalOpen(false)}
                className="px-5 py-2.5 text-gray-700 font-bold bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={confirmCloseQueue}
                className="px-5 py-2.5 text-white font-bold bg-amber-600 rounded-xl hover:bg-amber-700 transition-colors shadow-sm flex items-center"
              >
                <Lock className="w-4 h-4 mr-2" /> Close Queue
              </button>
            </div>
          </div>
        </div>
      )}

      {/* End Session Confirmation Modal */}
      {isEndSessionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-5 border-b border-gray-100 bg-red-50">
              <h2 className="text-lg font-bold text-red-700 flex items-center">
                <Square className="w-5 h-5 mr-2" />
                End Clinic Session?
              </h2>
              <button onClick={() => setIsEndSessionModalOpen(false)} className="text-red-400 hover:text-red-600 transition-colors p-1 rounded-lg hover:bg-red-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6">
              <p className="text-gray-700 font-medium text-center">
                Are you sure you want to end today's clinic session?
              </p>
              <p className="text-gray-500 text-sm text-center mt-2">
                All consultations have been completed. This will mark the schedule as Completed and finalize today's clinic.
              </p>
            </div>

            <div className="p-5 border-t border-gray-100 flex justify-end gap-3 bg-gray-50">
              <button 
                onClick={() => setIsEndSessionModalOpen(false)}
                className="px-5 py-2.5 text-gray-700 font-bold bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={confirmEndSession}
                className="px-5 py-2.5 text-white font-bold bg-red-600 rounded-xl hover:bg-red-700 transition-colors shadow-sm flex items-center"
              >
                <Square className="w-4 h-4 mr-2" /> End Clinic Session
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
