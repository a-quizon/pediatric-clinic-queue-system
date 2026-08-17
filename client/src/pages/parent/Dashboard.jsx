import React, { useState, useEffect, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import { Activity, Clock, CalendarPlus, Ticket, User, ChevronRight, CheckCircle2, History, MapPin, AlertCircle, Stethoscope, Users, Bell, Building2 } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { subscribeToParentReservations, subscribeToScheduleReservations, ACTIVE_RESERVATION_STATUSES } from "../../services/reservationService";
import { getSchedules, subscribeToAllSchedules } from "../../services/scheduleService";
import { getBranchConfigurations } from "../../services/branchConfigurationService";
import { isReservationExpired, getRemainingValidationTime, formatRemainingTime } from "../../services/timeService";
import ReservationStatusBadge from "../../components/common/ReservationStatusBadge";
import { computeReservationState, computeAheadOfYou, QUEUE_STATES } from "../../services/queueEngine";

export default function Dashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [schedules, setSchedules] = useState({});
  const [parentReservations, setParentReservations] = useState([]);
  const [scheduleReservations, setScheduleReservations] = useState([]);
  const [branches, setBranches] = useState([]);

  useEffect(() => {
    const unsubSchedules = subscribeToAllSchedules((data) => {
      setSchedules(data || {});
    });

    let unsubParent = () => {};
    let unsubSchedule = () => {};
    let currentScheduleId = null;

    if (user) {
      unsubParent = subscribeToParentReservations(user.uid, (data) => {
        const parentData = data || [];
        setParentReservations(parentData);
        setLoading(false);

        const active = parentData.find(r => ACTIVE_RESERVATION_STATUSES.includes(r.status));
        const newScheduleId = active ? active.scheduleId : null;

        if (newScheduleId !== currentScheduleId) {
          unsubSchedule();
          setScheduleReservations([]); // Clear stale schedule data
          currentScheduleId = newScheduleId;

          if (newScheduleId) {
            unsubSchedule = subscribeToScheduleReservations(newScheduleId, (scheduleData) => {
              setScheduleReservations(scheduleData || []);
            });
          }
        }
      });
    }

    getBranchConfigurations().then(setBranches);

    return () => {
      unsubSchedules();
      unsubParent();
      unsubSchedule();
    };
  }, [user]);

  const activeReservation = useMemo(() => {
    if (!user) return null;
    const active = parentReservations.find(r => ACTIVE_RESERVATION_STATUSES.includes(r.status));
    if (!active) return null;

    const sched = schedules[active.scheduleId];
    if (sched && (sched.status === 'completed' || sched.queueStatus === 'completed' || sched.queueStatus === 'ended')) {
      return null;
    }

    return active;
  }, [parentReservations, schedules, user]);

  const schedule = activeReservation ? schedules[activeReservation.scheduleId] : null;

  const todayStr = useMemo(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, []);

  const todaySchedule = useMemo(() => {
    const allScheds = Object.values(schedules || {});
    const activeSession = allScheds.find(s => ['active', 'paused', 'closed'].includes(s.queueStatus));
    if (activeSession) return activeSession;
    const publishedToday = allScheds.find(s => s.clinicDate === todayStr && s.status === 'published' && s.queueStatus !== 'ended' && s.queueStatus !== 'completed');
    if (publishedToday) return publishedToday;
    return null;
  }, [schedules, todayStr]);

  const childName = activeReservation?.childName || "N/A";
  const nameSizeClass = childName.length > 24
    ? "text-base sm:text-lg"
    : childName.length > 16
    ? "text-lg sm:text-xl"
    : "text-xl sm:text-2xl";

  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (activeReservation?.status !== "validation_open") return;
    const interval = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, [activeReservation?.status]);

  const getPermanentQueueNumber = (resId, scheduleId) => {
    if (scheduleReservations.length === 0) return null;
    const scheduleRes = [...scheduleReservations].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    const index = scheduleRes.findIndex(r => r.id === resId);
    return index >= 0 ? index + 1 : null;
  };

  const permanentQueueNumber = activeReservation ? getPermanentQueueNumber(activeReservation.id, activeReservation.scheduleId) : null;

  const { nowServing, patientsAhead, nowServingText, completedCount, progressPercent, queueState, activeLine } = useMemo(() => {
    if (!activeReservation || scheduleReservations.length === 0) {
      return { nowServing: null, patientsAhead: 0, nowServingText: "—", completedCount: 0, progressPercent: 0, queueState: null, activeLine: [] };
    }
    
    const scheduleRes = [...scheduleReservations].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    
    // Assign permanent queue numbers
    const resWithPNum = scheduleRes.map((r, idx) => ({ ...r, pNum: idx + 1 }));
    
    const inConsultation = resWithPNum.find(r => r.status === "in_consultation" || r.status === "with_doctor");
    const completedList = resWithPNum.filter(r => r.status === "consultation_completed");
    const compCount = completedList.length;
    
    const activeLine = resWithPNum
      .filter(r => ACTIVE_RESERVATION_STATUSES.includes(r.status))
      .sort((a, b) => {
        if (a.queueOrder !== undefined && b.queueOrder !== undefined) {
          return a.queueOrder - b.queueOrder;
        }
        return (a.sortTimestamp || a.createdAt || 0) - (b.sortTimestamp || b.createdAt || 0);
      });
    
    let servingText = "—";
    if (!schedule || schedule.queueStatus === 'not_started') {
      servingText = "—";
    } else if (schedule.status === 'completed' || schedule.queueStatus === 'completed') {
      servingText = "Completed";
    } else if (inConsultation) {
      servingText = `Queue #${inConsultation.pNum}`;
    } else if (compCount > 0) {
      servingText = "Waiting for next consultation";
    } else {
      servingText = "Waiting for the first consultation";
    }

    const ahead = computeAheadOfYou(activeReservation, scheduleReservations);

    const myPNum = permanentQueueNumber || 1;
    let percent = 0;
    if (["in_consultation", "with_doctor", "consultation_completed"].includes(activeReservation.status)) {
      percent = 100;
    } else if (myPNum > 1) {
      percent = Math.min(100, Math.max(0, Math.round((compCount / (myPNum - 1)) * 100)));
    } else {
      percent = compCount > 0 ? 100 : 0;
    }

    return { 
      nowServing: inConsultation || null, 
      patientsAhead: ahead, 
      nowServingText: servingText,
      completedCount: compCount,
      progressPercent: percent,
      queueState: computeReservationState(activeReservation, scheduleReservations),
      activeLine
    };
  }, [scheduleReservations, activeReservation, permanentQueueNumber, schedule]);

  const getStatusDisplay = (status) => {
    switch (status) {
      case 'validation_open':
        return { text: 'Validation Open', color: 'bg-green-100 text-green-700 border-green-200' };
      case 'waiting_for_window':
        return { text: 'Waiting for Window', color: 'bg-amber-100 text-amber-700 border-amber-200' };
      case 'reserved': 
      case 'waiting': 
        return { text: 'Awaiting Arrival', color: 'bg-gray-100 text-gray-700 border-gray-200' };
      case 'checked_in': 
        return { text: 'Checked In', color: 'bg-green-100 text-green-700 border-green-200' };
      case 'in_consultation': 
        return { text: 'In Consultation', color: 'bg-blue-100 text-blue-700 border-blue-200' };
      case 'consultation_completed': 
        return { text: 'Completed', color: 'bg-slate-100 text-slate-700 border-slate-200' };
      case 'cancelled':
        return { text: 'Cancelled', color: 'bg-red-100 text-red-700 border-red-200' };
      case 'expired':
      case 'validation_expired':
        return { text: 'Validation Expired', color: 'bg-red-100 text-red-700 border-red-200' };
      default: 
        return { text: 'Unknown', color: 'bg-gray-100 text-gray-700 border-gray-200' };
    }
  };

  const getClinicQueueStatusDisplay = () => {
    if (!schedule) return null;
    if (schedule.status === 'completed' || schedule.queueStatus === 'completed') {
      return { text: 'ENDED', badgeClass: 'bg-slate-100 text-slate-700 border-slate-200' };
    }
    if (schedule.queueStatus === 'paused') {
      return { text: 'PAUSED', badgeClass: 'bg-amber-100 text-amber-700 border-amber-200' };
    }
    if (schedule.queueStatus === 'closed') {
      return { text: 'CLOSED', badgeClass: 'bg-red-100 text-red-700 border-red-200' };
    }
    if (schedule.queueStatus === 'active') {
      return { text: 'OPEN', badgeClass: 'bg-green-100 text-green-700 border-green-200' };
    }
    return { text: 'NOT STARTED', badgeClass: 'bg-amber-100 text-amber-700 border-amber-200' };
  };

  const isExpired = useMemo(() => {
    return activeReservation && isReservationExpired(activeReservation, schedule);
  }, [activeReservation, schedule]);

  const effectiveStatus = activeReservation ? (isExpired ? "expired" : activeReservation.status) : null;
  const clinicStatusDisplay = getClinicQueueStatusDisplay();

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-6 relative">

      {/* Real-Time Queue Monitoring Redesign */}
      {activeReservation && schedule ? (
        <div className="space-y-4 max-w-lg mx-auto animate-in fade-in slide-in-from-bottom-4">
          
          {/* 1. Top Clinic Information */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center shrink-0 border border-blue-100">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-bold text-gray-800 text-sm leading-tight">
                  {schedule.branch || "Velasquez Pediatric Clinic"}
                  {!schedule.branch?.toLowerCase().includes('clinic') && " Clinic"}
                </h2>
                <span className="text-[11px] font-semibold text-blue-600 block leading-tight mt-0.5">
                  {schedule.branch?.toLowerCase().includes('branch') ? schedule.branch : `${schedule.branch} Branch`}
                </span>
                <span className="text-[10px] text-gray-500 block truncate max-w-[150px] sm:max-w-[200px] leading-tight mt-0.5">
                  {branches.find(b => b.name === schedule.branch)?.clinicAddress || "Magalang Road, Angeles City, Pampanga"}
                </span>
              </div>
            </div>
            
            <div className="border-l border-gray-100 pl-4 py-1 text-right">
              <div className="flex items-center justify-end gap-1 mb-0.5">
                <Clock className="w-3.5 h-3.5 text-blue-600" />
                <span className="text-[11px] font-bold text-blue-600">Clinic Hours</span>
              </div>
              <div className="text-[10px] font-semibold text-gray-600 leading-tight">
                {new Date(schedule.clinicDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </div>
              <div className="text-[10px] text-gray-500 leading-tight">
                {schedule.openingTime ? `${schedule.openingTime}` : "8:00 AM - 5:00 PM"}
              </div>
            </div>
          </div>

          {/* 2. Top Queue Summary Cards */}
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Card 1 - My Queue Number */}
            <div className="flex-1 bg-gradient-to-b from-blue-700 to-blue-900 rounded-2xl p-5 text-white shadow-md relative overflow-hidden flex flex-col items-center text-center">
              <span className="text-[10px] font-bold uppercase tracking-widest text-blue-200 mb-1 z-10">My Queue Number</span>
              <div className="text-6xl font-black tracking-tighter mb-1 z-10">
                {permanentQueueNumber || "-"}
              </div>
              <span className="text-xs text-blue-100 font-medium mb-4 z-10">
                Your turn is approaching
              </span>
              
              <div className="z-10">
                <ReservationStatusBadge status={queueState || effectiveStatus} className="shadow-xs px-3 py-1 bg-blue-900/50 border-blue-500/30 text-white backdrop-blur-sm" />
              </div>
              
              {/* Subtle background decoration */}
              <div className="absolute -bottom-6 -right-6 w-32 h-32 bg-white/5 rounded-full blur-2xl"></div>
              <div className="absolute -top-6 -left-6 w-24 h-24 bg-blue-400/20 rounded-full blur-xl"></div>
            </div>

            {/* Card 2 - Patients Ahead */}
            <div className="flex-1 bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col items-center justify-center text-center">
              <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Patients Ahead</span>
              <div className="text-6xl font-black text-gray-800 tracking-tighter mb-1">
                {["in_consultation", "with_doctor"].includes(activeReservation.status) || queueState === QUEUE_STATES.WITH_DOCTOR || activeReservation.status === "consultation_completed"
                    ? "0"
                    : patientsAhead}
              </div>
              <span className="text-xs text-gray-500 font-medium mb-3">
                patients ahead of you
              </span>
              <div className="w-10 h-10 bg-orange-50 text-orange-500 rounded-full flex items-center justify-center mt-1">
                <Users className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* 3. Current Consultation / Now Serving */}
          <div className="mt-2">
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest block mb-2 ml-2">Current Consultation</span>
            <div className="bg-green-50 border border-green-100 rounded-2xl p-4 flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center shrink-0">
                  <Stethoscope className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-xs font-bold text-green-600 block mb-0.5">Now Serving</span>
                  <div className="text-2xl font-black text-gray-800 leading-none">
                    {nowServing ? `Queue #${nowServing.pNum}` : "—"}
                  </div>
                </div>
              </div>
              {nowServing && (
                <div className="bg-green-100/80 text-green-700 text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full flex items-center gap-1.5 border border-green-200">
                  IN PROGRESS
                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
                </div>
              )}
            </div>
          </div>

          {/* 4. Waiting Queue */}
          <div className="mt-4">
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest block mb-2 ml-2">Waiting Queue</span>
            
            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
              {activeLine.length > 0 ? (
                activeLine.map((r) => {
                  const isYou = r.id === activeReservation.id;
                  const isNowServing = ["in_consultation", "with_doctor"].includes(r.status);
                  
                  if (isNowServing) return null;

                  return (
                    <div 
                      key={r.id} 
                      className={`flex items-center justify-between p-3.5 rounded-xl border transition-all ${
                        isYou 
                          ? "bg-blue-50/80 border-blue-200 shadow-sm relative overflow-hidden" 
                          : "bg-white border-gray-100 shadow-2xs"
                      }`}
                    >
                      {isYou && (
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500"></div>
                      )}
                      
                      <div className="flex items-center gap-4 pl-1">
                        <div className={`w-8 text-center text-xl font-black ${isYou ? "text-blue-700" : "text-gray-800"}`}>
                          {r.pNum}
                        </div>
                        <div className={`text-sm font-semibold ${isYou ? "text-blue-600" : "text-gray-600"}`}>
                          {isYou ? "You" : "Waiting"}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {isYou ? (
                          <div className="bg-blue-100/80 text-blue-800 text-[10px] font-black uppercase px-2.5 py-1 rounded-full border border-blue-200 flex items-center gap-1.5">
                            {r.status === 'checked_in' ? 'CHECKED IN' : 'WAITING'}
                            <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                          </div>
                        ) : (
                          <span className="bg-gray-100 text-gray-500 text-[10px] font-black uppercase px-3 py-1 rounded-full border border-gray-200">
                            WAITING
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center p-4 text-sm text-gray-500 bg-white rounded-xl border border-gray-100 shadow-2xs">
                  No one is currently waiting.
                </div>
              )}
            </div>
            
            {activeLine.length > 5 && (
              <div className="text-center mt-2">
                <span className="text-[10px] text-gray-400 font-semibold">Scroll for more patients</span>
              </div>
            )}
          </div>

          {/* 5. Reminders / Warnings */}
          <div className="pt-2">
            {schedule.queueStatus === 'not_started' && (
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-3.5 flex items-start gap-3 shadow-2xs">
                <div className="w-8 h-8 bg-blue-100 text-blue-500 rounded-full flex items-center justify-center shrink-0">
                  <Bell className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-gray-800 mb-0.5">Clinic hasn't started yet.</h4>
                  <p className="text-[11px] text-gray-600">Please check in at the clinic upon arrival.</p>
                </div>
              </div>
            )}
            
            {schedule.queueStatus === 'paused' && (
              <div className="bg-orange-50 border border-orange-100 rounded-xl p-3.5 flex items-start gap-3 shadow-2xs">
                <div className="w-8 h-8 bg-orange-100 text-orange-500 rounded-full flex items-center justify-center shrink-0">
                  <AlertCircle className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-gray-800 mb-0.5">Queue Paused</h4>
                  <p className="text-[11px] text-gray-600">The clinic queue is temporarily paused.</p>
                </div>
              </div>
            )}
            
            {schedule.queueStatus === 'closed' && (
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-3.5 flex items-start gap-3 shadow-2xs">
                <div className="w-8 h-8 bg-amber-100 text-amber-500 rounded-full flex items-center justify-center shrink-0">
                  <AlertCircle className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-gray-800 mb-0.5">Queue Closed</h4>
                  <p className="text-[11px] text-gray-600">Existing reservations will be served.</p>
                </div>
              </div>
            )}
            
            {schedule.queueStatus !== 'not_started' && (activeReservation.status === "reserved" || activeReservation.status === "waiting" || activeReservation.status === "checked_in") && (
              <div className="bg-amber-50/50 border border-amber-100 rounded-xl p-3.5 flex items-start gap-3 shadow-2xs mt-2">
                <div className="w-8 h-8 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center shrink-0">
                  <Bell className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-gray-800 mb-0.5">We'll notify you when your turn is near.</h4>
                  <p className="text-[11px] text-gray-600">Please keep your phone with you.</p>
                </div>
              </div>
            )}
          </div>
          
          <div className="text-center mt-3 mb-1">
            <span className="text-[10px] text-gray-400 font-medium">
              Real-time updates may vary depending on internet connection.
            </span>
          </div>
        </div>
      ) : (
        /* Today's Clinic Status Card (Public Overview when no active reservation) */
        <div className="bg-white rounded-3xl border border-gray-100 shadow-lg overflow-hidden max-w-lg mx-auto animate-in fade-in slide-in-from-bottom-4">
          <div className="bg-gray-50/80 border-b border-gray-100 px-6 sm:px-8 py-5 flex justify-between items-center">
            <div className="text-left">
              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest block mb-0.5">Public Status</span>
              <h2 className="text-xl sm:text-2xl font-black text-gray-800">Today&apos;s Clinic Status</h2>
            </div>
            {todaySchedule && (
              <span className="inline-block px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border shadow-xs bg-blue-100 text-blue-700 border-blue-200">
                {todaySchedule.branch || "Angeles"}
              </span>
            )}
          </div>

          <div className="p-6 sm:p-8 space-y-6">
            {todaySchedule ? (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                  <div className="p-3.5 bg-gray-50/80 rounded-2xl border border-gray-100">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Status</span>
                    <span className="text-xs sm:text-sm font-black text-gray-800">
                      {['active', 'paused', 'closed'].includes(todaySchedule.queueStatus) ? 'In Progress' : 'Scheduled'}
                    </span>
                  </div>

                  <div className="p-3.5 bg-gray-50/80 rounded-2xl border border-gray-100">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Branch</span>
                    <span className="text-xs sm:text-sm font-black text-gray-800">{todaySchedule.branch || 'Angeles'}</span>
                  </div>

                  <div className="p-3.5 bg-gray-50/80 rounded-2xl border border-gray-100">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Queue</span>
                    <span className={`text-xs sm:text-sm font-black ${todaySchedule.queueStatus === 'active' ? 'text-green-600' : todaySchedule.queueStatus === 'closed' ? 'text-red-600' : 'text-gray-800'}`}>
                      {todaySchedule.queueStatus === 'active' ? 'Open' : todaySchedule.queueStatus === 'paused' ? 'Paused' : todaySchedule.queueStatus === 'closed' ? 'Closed' : 'Not Started'}
                    </span>
                  </div>

                  <div className="p-3.5 bg-gray-50/80 rounded-2xl border border-gray-100">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Reservations</span>
                    <span className={`text-xs sm:text-sm font-black ${todaySchedule.queueStatus === 'closed' ? 'text-red-600' : 'text-green-600'}`}>
                      {todaySchedule.queueStatus === 'closed' ? 'Closed' : 'Available'}
                    </span>
                  </div>
                </div>

                <div className="bg-blue-50/60 border border-blue-100 rounded-2xl p-4 text-center">
                  <p className="text-xs font-semibold text-blue-900">
                    {todaySchedule.queueStatus === 'closed'
                      ? "Today's clinic is currently serving existing reservations."
                      : todaySchedule.queueStatus === 'active'
                      ? "Today's clinic session is live and serving patients."
                      : todaySchedule.queueStatus === 'paused'
                      ? "Today's clinic session is temporarily paused."
                      : "Today's clinic session is available for reservation."}
                  </p>
                </div>
              </>
            ) : (
              <div className="py-6 text-center space-y-3">
                <div className="mx-auto w-14 h-14 bg-gray-100 text-gray-400 rounded-2xl flex items-center justify-center">
                  <Clock className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-800">No Active Clinic Session</h3>
                  <p className="text-xs text-gray-500 mt-1">No clinic session is currently active today.</p>
                </div>
              </div>
            )}

            <div className="text-center pt-2">
              <Link
                to="/parent/reserve"
                className="inline-flex items-center justify-center px-8 py-3.5 bg-blue-600 text-white font-bold text-sm rounded-xl hover:bg-blue-700 transition-colors shadow-sm"
              >
                Make Reservation
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="pt-6">
        <h2 className="text-lg font-bold text-gray-800 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          
          {activeReservation ? (
            <Link to="/parent/reservations" className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-blue-100 transition-all group flex flex-col justify-between h-full">
              <div>
                <div className="bg-blue-50 w-12 h-12 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Ticket className="w-6 h-6 text-blue-600" />
                </div>
                <h3 className="font-bold text-gray-800 mb-1">My Reservation</h3>
                <p className="text-gray-500 text-sm mb-4">View your active reservation and queue status.</p>
              </div>
              <div className="flex items-center text-blue-600 text-sm font-semibold mt-auto">
                Open <ChevronRight className="w-4 h-4 ml-1" />
              </div>
            </Link>
          ) : (
            <Link to="/parent/reserve" className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-blue-100 transition-all group flex flex-col justify-between h-full">
              <div>
                <div className="bg-blue-50 w-12 h-12 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <CalendarPlus className="w-6 h-6 text-blue-600" />
                </div>
                <h3 className="font-bold text-gray-800 mb-1">Reserve Queue</h3>
                <p className="text-gray-500 text-sm mb-4">View available clinic schedules and reserve a slot.</p>
              </div>
              <div className="flex items-center text-blue-600 text-sm font-semibold mt-auto">
                Open <ChevronRight className="w-4 h-4 ml-1" />
              </div>
            </Link>
          )}

          <Link to="/parent/reservations?tab=notes" className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-blue-100 transition-all group flex flex-col justify-between h-full">
            <div>
              <div className="bg-blue-50 w-12 h-12 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <History className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="font-bold text-gray-800 mb-1">Reservation History</h3>
              <p className="text-gray-500 text-sm mb-4">View past consultations and doctor's notes.</p>
            </div>
            <div className="flex items-center text-blue-600 text-sm font-semibold mt-auto">
              Open <ChevronRight className="w-4 h-4 ml-1" />
            </div>
          </Link>

          <Link to="/parent/profile" className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-blue-100 transition-all group flex flex-col justify-between h-full">
            <div>
              <div className="bg-gray-50 w-12 h-12 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform border border-gray-100">
                <User className="w-6 h-6 text-gray-600" />
              </div>
              <h3 className="font-bold text-gray-800 mb-1">Profile</h3>
              <p className="text-gray-500 text-sm mb-4">Manage your account information and preferences.</p>
            </div>
            <div className="flex items-center text-gray-600 text-sm font-semibold mt-auto group-hover:text-blue-600 transition-colors">
              Settings <ChevronRight className="w-4 h-4 ml-1" />
            </div>
          </Link>
        </div>
      </div>

    </div>
  );
}