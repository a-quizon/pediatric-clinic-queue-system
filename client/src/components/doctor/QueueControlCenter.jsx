import React, { useState, useEffect, useMemo } from "react";
import { subscribeToPublishedSchedules, updateQueueStatus, completeSchedule } from "../../services/scheduleService";
import { subscribeToScheduleReservations, startConsultation, completeConsultation, expireReservation, ACTIVE_RESERVATION_STATUSES } from "../../services/reservationService";
import { getNextEligiblePatient } from "../../services/queueEligibilityService";
import { isReservationExpired } from "../../services/timeService";
import { sortActiveQueue } from "../../services/queueEngine";
import { Activity, Play, Pause, Square, CheckCircle, User, AlertCircle, FileText, X, Clock, MapPin, Users, CheckCircle2, Lock } from "lucide-react";
import ScheduleConfirmModal from "../../components/schedule/ScheduleConfirmModal";
import ReservationStatusBadge from "../../components/common/ReservationStatusBadge";
import toast from "react-hot-toast";
import { getReservationChildDisplayName, getReservationChildren } from "../../utils/reservationPatients";
import ReservationPatientNames from "../common/ReservationPatientNames";

export default function QueueControlCenter() {
  const [schedules, setSchedules] = useState([]);
  const [schedulesLoaded, setSchedulesLoaded] = useState(false);
  const [reservations, setReservations] = useState([]);
  const [reservationsLoaded, setReservationsLoaded] = useState(false);

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
      setSchedulesLoaded(true);
    });

    return () => unsubSchedules();
  }, []);

  const activeSchedule = useMemo(() => {
    return schedules.find(s => s.status === 'published' && (s.queueStatus === 'active' || s.queueStatus === 'paused' || s.queueStatus === 'closed'));
  }, [schedules]);

  const activeScheduleId = activeSchedule?.id;

  useEffect(() => {
    if (!activeScheduleId) {
      const timeoutId = setTimeout(() => {
        setReservations([]);
      }, 0);
      return () => clearTimeout(timeoutId);
    }

    const timeoutId = setTimeout(() => {
      setReservationsLoaded(false);
    }, 0);

    const unsubReservations = subscribeToScheduleReservations(activeScheduleId, (data) => {
      setReservations(data);
      setReservationsLoaded(true);
    });

    return () => {
      clearTimeout(timeoutId);
      unsubReservations();
    };
  }, [activeScheduleId]);
  
  const scheduleReservations = useMemo(() => {
    if (!activeSchedule) return [];
    return reservations.filter(r => r.scheduleId === activeSchedule.id);
  }, [reservations, activeSchedule]);

  const {
    waitingQueue,
    inConsultation,
  } = useMemo(() => {
    const activeWaitingStatuses = ["checked_in", "reserved", "waiting"];
    const waitingList = sortActiveQueue(
      scheduleReservations.filter(r => activeWaitingStatuses.includes(r.status))
    );

    const inCons = scheduleReservations.find(r => r.status === "in_consultation" || r.status === "with_doctor");
    
    return {
      waitingQueue: waitingList,
      inConsultation: inCons,
    };
  }, [scheduleReservations]);

  const canEndSession = waitingQueue.length === 0 && !inConsultation;

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

  const loading = !schedulesLoaded || (!!activeSchedule && !reservationsLoaded);

  if (loading) {
    return (
      <div className="space-y-6 pb-6 mt-6 animate-pulse">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 h-24"></div>
        <div className="flex flex-col lg:flex-row gap-6 items-stretch">
          <div className="flex-[4] flex flex-col gap-6">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 h-64"></div>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 h-48"></div>
          </div>
          <div className="flex-[3] bg-white rounded-2xl shadow-sm border border-gray-100 h-96"></div>
        </div>
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
      {/* 1. Active Queue Session Card (with embedded controls) */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
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
                Late Limit: <strong className="ml-1">{activeSchedule.lateLimit || 3} penalties</strong>
              </span>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-4">
            {getQueueStatusBadge(activeSchedule.queueStatus)}
            
            <div className="flex items-center gap-2">
              {activeSchedule.queueStatus === 'published' && (
                <button onClick={() => handleQueueControl('active')} className="px-3 py-1.5 bg-green-50 text-green-700 hover:bg-green-100 rounded-lg transition-colors border border-green-200 text-sm font-bold flex items-center shadow-sm">
                  <Play className="w-4 h-4 mr-1.5" /> Start Queue
                </button>
              )}
              {activeSchedule.queueStatus === 'active' && (
                <>
                  <button onClick={() => handleQueueControl('paused')} className="p-2 bg-amber-50 text-amber-600 hover:bg-amber-100 rounded-lg transition-colors border border-amber-200 shadow-sm" title="Pause Queue">
                    <Pause className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleQueueControl('closed')} className="p-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg transition-colors border border-red-200 shadow-sm" title="Close Queue to New Reservations">
                    <Lock className="w-4 h-4" />
                  </button>
                </>
              )}
              {activeSchedule.queueStatus === 'paused' && (
                <>
                  <button onClick={() => handleQueueControl('active')} className="p-2 bg-green-50 text-green-600 hover:bg-green-100 rounded-lg transition-colors border border-green-200 shadow-sm" title="Resume Queue">
                    <Play className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleQueueControl('closed')} className="p-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg transition-colors border border-red-200 shadow-sm" title="Close Queue to New Reservations">
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
                <span className="font-bold text-gray-500 px-3 py-1.5 bg-gray-100 rounded-xl border border-gray-200">Clinic Session Ended</span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 items-stretch">
        {/* 2. Current Consultation */}
        <div className="flex-[4] bg-white rounded-2xl shadow-sm border border-blue-200 overflow-hidden flex flex-col">
        <div className="bg-blue-600 px-5 py-3 flex justify-between items-center">
          <h3 className="font-bold text-white flex items-center">
            <Activity className="w-4 h-4 mr-2" /> Current Consultation
          </h3>
          {inConsultation && (
            <span className="bg-white/20 text-white text-xs px-2.5 py-1 rounded-full font-bold">
              Queue #{inConsultation.queueNumber || inConsultation.queuePosition}
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
              <div className="flex justify-between items-start gap-3">
                <div className="min-w-0 flex-1 mb-1">
                  <ReservationPatientNames
                    reservation={inConsultation}
                    nameClassName="font-black text-gray-800 text-2xl"
                  />
                </div>
                <span className="text-xs text-blue-600 font-bold bg-blue-100 px-2 py-1 rounded-lg border border-blue-200 shrink-0">View Details</span>
              </div>
              <div className="text-sm text-gray-500 flex flex-col gap-1">
                {getReservationChildren(inConsultation).length > 0 ? (
                  getReservationChildren(inConsultation).map((child, index) => (
                    <span key={child.childId || index} className="flex items-center">
                      <User className="w-4 h-4 mr-1.5" />
                      {child.childName}: {child.age || "N/A"} • {child.sex || "N/A"}
                    </span>
                  ))
                ) : (
                  <>
                    <span className="flex items-center"><User className="w-4 h-4 mr-1.5" /> Age: {inConsultation.age || "N/A"}</span>
                    <span className="flex items-center">Sex: {inConsultation.sex || "N/A"}</span>
                  </>
                )}
              </div>
            </div>
            
            <div className="bg-amber-50/50 p-4 rounded-xl border border-amber-100 mb-6">
              <div className="text-xs text-amber-700 font-bold uppercase tracking-wider mb-2 flex items-center">
                <AlertCircle className="w-4 h-4 mr-1.5" /> Concern / Reason for Visit
              </div>
              <div className="font-medium text-amber-900 text-sm whitespace-pre-wrap">
                {inConsultation.concern || "No specific concern provided by the parent."}
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

        {/* 3. Waiting Queue (Read-Only) */}
        <div className="flex-[6] bg-white rounded-2xl shadow-sm border border-gray-200 p-5 flex flex-col">
        <h3 className="font-bold text-gray-800 mb-4 flex items-center">
          <Users className="w-5 h-5 mr-2 text-blue-600" /> 
          Waiting Queue <span className="ml-2 bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs font-bold">{waitingQueue.length}</span>
        </h3>
        
        {waitingQueue.length > 0 ? (
          <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
            {waitingQueue.map(res => {
              const expired = isReservationExpired(res, activeSchedule);
              return (
                <div 
                  key={res.id}
                  className="flex items-start sm:items-center justify-between gap-3 p-4 bg-gray-50 rounded-xl border border-gray-200"
                >
                  <div className="flex items-start min-w-0 flex-1 gap-4">
                    <div className="w-12 h-12 bg-white border border-gray-200 rounded-xl flex items-center justify-center font-black text-gray-700 shadow-sm text-lg shrink-0">
                      {res.queueNumber || res.queuePosition}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="mb-1">
                        <ReservationPatientNames
                          reservation={res}
                          fallback={res.parentEmail || "Unnamed Patient"}
                        />
                      </div>
                      <ReservationStatusBadge status={expired ? "expired" : res.status} />
                    </div>
                  </div>
                  {res.checkedInAt && (
                    <div className="text-right hidden sm:block shrink-0">
                      <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">Checked In</div>
                      <div className="text-sm font-semibold text-gray-600">
                        {new Date(res.checkedInAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-10 text-sm text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200">
            No patients currently in the waiting queue.
          </div>
        )}
        </div>
      </div>

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
            
            <div className="p-6 overflow-y-auto flex-1">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <div className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-1">Patient</div>
                  <div className="text-2xl font-black text-gray-800">{getReservationChildDisplayName(infoPatient)}</div>
                </div>
                <div className="bg-blue-50 text-blue-600 border border-blue-100 px-4 py-2 rounded-xl text-lg font-black shadow-sm">
                  #{infoPatient.queueNumber || infoPatient.queuePosition}
                </div>
              </div>
              
              <div className="space-y-4">
                <div className="space-y-3">
                  {getReservationChildren(infoPatient).length > 0 ? (
                    getReservationChildren(infoPatient).map((child, index) => (
                      <div key={child.childId || index} className="grid grid-cols-2 gap-3">
                        <div className="col-span-2 bg-gray-50 p-3 rounded-xl border border-gray-100">
                          <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">Child</div>
                          <div className="font-semibold text-gray-800 text-sm">{child.childName || "N/A"}</div>
                        </div>
                        <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                          <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">Age</div>
                          <div className="font-semibold text-gray-800 text-sm">{child.age || "N/A"}</div>
                        </div>
                        <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                          <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">Sex</div>
                          <div className="font-semibold text-gray-800 text-sm">{child.sex || "N/A"}</div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                        <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">Age</div>
                        <div className="font-semibold text-gray-800 text-sm">{infoPatient.age || "N/A"}</div>
                      </div>
                      <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                        <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">Sex</div>
                        <div className="font-semibold text-gray-800 text-sm">{infoPatient.sex || "N/A"}</div>
                      </div>
                    </div>
                  )}
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

            <div className="p-5 border-t border-gray-100 flex justify-end shrink-0">
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
                  <div className="font-bold text-gray-800 text-lg">{getReservationChildDisplayName(selectedPatient)}</div>
                </div>
                <div className="bg-white border border-gray-200 px-3 py-1.5 rounded-lg text-sm font-bold text-gray-600 shadow-sm">
                  #{selectedPatient.queueNumber || selectedPatient.queuePosition}
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
