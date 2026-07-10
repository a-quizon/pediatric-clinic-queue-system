import React, { useState, useEffect, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import { Activity, Clock, CalendarPlus, Ticket, User, ChevronRight, CheckCircle2, History, MapPin, AlertCircle } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "../../hooks/useAuth";
import { subscribeToAllReservations } from "../../services/reservationService";
import { getSchedules, subscribeToAllSchedules } from "../../services/scheduleService";
import { isReservationExpired, getRemainingValidationTime, formatRemainingTime } from "../../services/timeService";
import ReservationStatusBadge from "../../components/common/ReservationStatusBadge";

export default function Dashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [schedules, setSchedules] = useState({});
  const [allReservations, setAllReservations] = useState([]);

  useEffect(() => {
    const unsubSchedules = subscribeToAllSchedules((data) => {
      setSchedules(data || {});
    });

    const unsubReservations = subscribeToAllReservations((data) => {
      setAllReservations(data);
      setLoading(false);
    });

    return () => {
      unsubSchedules();
      unsubReservations();
    };
  }, []);

  const activeReservation = useMemo(() => {
    if (!user) return null;
    const myRes = allReservations.filter(r => r.parentId === user.uid);
    const active = myRes.find(r => ["reserved", "waiting", "validation_open", "waiting_for_window", "checked_in", "in_consultation"].includes(r.status));
    if (active) return active;
    return myRes.find(r => ["expired", "validation_expired"].includes(r.status));
  }, [allReservations, user]);

  const schedule = activeReservation ? schedules[activeReservation.scheduleId] : null;

  const prevQueueStatusRef = useRef(null);
  useEffect(() => {
    if (schedule) {
      if (prevQueueStatusRef.current === 'not_started' && schedule.queueStatus === 'active') {
        toast.success("Queue Open\nThe clinic queue is now open.", { duration: 4000 });
      }
      prevQueueStatusRef.current = schedule.queueStatus;
    }
  }, [schedule?.queueStatus]);

  const prevResStatusRef = useRef(null);
  useEffect(() => {
    if (activeReservation) {
      if (prevResStatusRef.current !== 'validation_open' && activeReservation.status === 'validation_open') {
        toast.success("Validation Window Open!\nIt is now your turn. Please proceed to the clinic to validate your QR code.", { duration: 6000 });
      }
      prevResStatusRef.current = activeReservation.status;
    } else {
      prevResStatusRef.current = null;
    }
  }, [activeReservation?.status]);

  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (activeReservation?.status !== "validation_open") return;
    const interval = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, [activeReservation?.status]);

  const getPermanentQueueNumber = (resId, scheduleId) => {
    const scheduleRes = allReservations
      .filter(r => r.scheduleId === scheduleId)
      .sort((a, b) => a.createdAt - b.createdAt);
    const index = scheduleRes.findIndex(r => r.id === resId);
    return index >= 0 ? index + 1 : null;
  };

  const permanentQueueNumber = activeReservation ? getPermanentQueueNumber(activeReservation.id, activeReservation.scheduleId) : null;

  const { nowServing, patientsAhead, nowServingText, completedCount, progressPercent } = useMemo(() => {
    if (!activeReservation) return { nowServing: null, patientsAhead: 0, nowServingText: "—", completedCount: 0, progressPercent: 0 };
    
    const scheduleRes = allReservations
      .filter(r => r.scheduleId === activeReservation.scheduleId)
      .sort((a, b) => a.createdAt - b.createdAt);
    
    // Assign permanent queue numbers
    const resWithPNum = scheduleRes.map((r, idx) => ({ ...r, pNum: idx + 1 }));
    
    const inConsultation = resWithPNum.find(r => r.status === "in_consultation");
    const completedList = resWithPNum.filter(r => r.status === "consultation_completed");
    const compCount = completedList.length;
    
    const activeLine = resWithPNum
      .filter(r => ["reserved", "waiting", "validation_open", "waiting_for_window", "checked_in", "in_consultation"].includes(r.status))
      .sort((a, b) => (a.queuePosition || 999) - (b.queuePosition || 999));
    
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

    let ahead = 0;
    if (activeReservation.status === "in_consultation" || activeReservation.status === "consultation_completed") {
      ahead = 0;
    } else {
      const myIndex = activeLine.findIndex(r => r.id === activeReservation.id);
      ahead = myIndex >= 0 ? myIndex : 0;
    }

    const myPNum = permanentQueueNumber || 1;
    let percent = 0;
    if (activeReservation.status === "in_consultation" || activeReservation.status === "consultation_completed") {
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
      progressPercent: percent
    };
  }, [allReservations, activeReservation, permanentQueueNumber, schedule]);

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

      {/* Hero Card: Real-Time Monitoring */}
      {activeReservation && schedule ? (
        <div className="space-y-4">
          <div className="bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden max-w-lg mx-auto animate-in fade-in slide-in-from-bottom-4">
            {/* Two-Column Header */}
            <div className="bg-gray-50/80 border-b border-gray-100 px-6 sm:px-8 py-5 flex justify-between items-start sm:items-center">
              <div className="text-left">
                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest block mb-0.5">Patient</span>
                <h2 className="text-xl sm:text-2xl font-black text-gray-800 truncate">{activeReservation.childName || "N/A"}</h2>
                {(user?.fullName || user?.displayName || user?.name) && (
                  <span className="text-xs font-medium text-gray-500 block mt-0.5">Parent: {user?.fullName || user?.displayName || user?.name}</span>
                )}
              </div>

              <div className="text-right flex flex-col items-end">
                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Queue Status</span>
                {clinicStatusDisplay && (
                  <span className={`inline-block px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border shadow-xs ${clinicStatusDisplay.badgeClass}`}>
                    {clinicStatusDisplay.text}
                  </span>
                )}
              </div>
            </div>

            <div className="p-6 sm:p-8 space-y-6 divide-y divide-gray-100 text-center">
              {/* Section 1: NOW SERVING */}
              <div className="pt-2">
                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Now Serving</span>
                <div className="text-3xl sm:text-4xl font-black text-gray-800 tracking-tight">{nowServingText}</div>
              </div>

              {/* Section 2: YOUR QUEUE (Interactive Shortcut to My Reservation when active) */}
              <div className="pt-6">
                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest block mb-2">Your Queue</span>
                <Link 
                  to="/parent/reservations"
                  className="group inline-block focus:outline-none transition-transform active:scale-95"
                >
                  {activeReservation.status === "in_consultation" ? (
                    <div className="text-5xl sm:text-6xl font-black text-blue-600 tracking-tight group-hover:text-blue-700 transition-colors">
                      IN CLINIC
                    </div>
                  ) : (
                    <div className="text-6xl sm:text-7xl font-black text-blue-600 tracking-tighter group-hover:text-blue-700 transition-colors">
                      #{permanentQueueNumber}
                    </div>
                  )}
                </Link>

                {/* Logical Reading Order: Reservation Status -> Validation Window (if open) -> Branch */}
                <div className="mt-3.5 flex flex-col items-center justify-center gap-2">
                  <ReservationStatusBadge status={effectiveStatus} className="shadow-2xs px-3 py-1" />



                  <span className="flex items-center text-gray-600 text-xs sm:text-sm font-semibold mt-1">
                    <MapPin className="w-3.5 h-3.5 mr-1 text-red-500 inline flex-shrink-0" />
                    {schedule.branch}{schedule.branch?.toLowerCase().includes('branch') ? '' : ' Branch'}
                  </span>
                </div>

                <div className="mt-2.5 text-[11px] font-semibold text-gray-500">
                  <Link to="/parent/reservations" className="hover:underline">
                    (Tap Queue #{permanentQueueNumber || ''} to view your reservation)
                  </Link>
                </div>
              </div>

              {/* Section 3: AHEAD OF YOU */}
              <div className="pt-6 pb-2">
                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Ahead of You</span>
                <div className={`text-2xl sm:text-3xl font-black tracking-tight ${activeReservation.status === "consultation_completed" ? "text-gray-400" : "text-orange-500"}`}>
                  {activeReservation.status === "consultation_completed"
                    ? "—"
                    : activeReservation.status === "in_consultation"
                    ? "0 Patients Remaining"
                    : patientsAhead === 0
                    ? "You're Next"
                    : patientsAhead === 1
                    ? "1 Patient Remaining"
                    : `${patientsAhead} Patients Remaining`}
                </div>
              </div>
            </div>
          </div>

          {/* Concise Warning Messages directly below Hero Card */}
          {schedule.queueStatus === 'not_started' && (
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-3.5 text-blue-800 flex items-center text-xs sm:text-sm font-semibold max-w-lg mx-auto animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-blue-500 mr-2.5 flex-shrink-0" />
              <p>The clinic queue hasn't started yet. Check in at the clinic upon arrival.</p>
            </div>
          )}
          {schedule.queueStatus === 'paused' && (
            <div className="bg-orange-50 border border-orange-200 rounded-2xl p-3.5 text-orange-800 flex items-center text-xs sm:text-sm font-semibold max-w-lg mx-auto animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-orange-500 mr-2.5 flex-shrink-0" />
              <p>The clinic queue is temporarily paused.</p>
            </div>
          )}
          {schedule.queueStatus === 'closed' && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 text-amber-800 flex items-center text-xs sm:text-sm font-semibold max-w-lg mx-auto animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-amber-500 mr-2.5 flex-shrink-0" />
              <p>The queue is closed to new reservations. Existing reservations will be served.</p>
            </div>
          )}
          {schedule.queueStatus !== 'not_started' && (activeReservation.status === "reserved" || activeReservation.status === "waiting") && (
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-3.5 text-blue-800 flex items-center text-xs sm:text-sm font-semibold max-w-lg mx-auto animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-blue-600 mr-2.5 flex-shrink-0" />
              <p>Monitor your queue position from home. Travel to the clinic and show your QR Code to Check In when your turn approaches.</p>
            </div>
          )}
        </div>
      ) : (
        /* Empty State */
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-10 sm:p-14 text-center max-w-lg mx-auto animate-in fade-in">
          <div className="mx-auto w-20 h-20 bg-blue-50 text-blue-400 rounded-full flex items-center justify-center mb-6">
            <CalendarPlus className="w-10 h-10" />
          </div>
          <h2 className="text-2xl font-black text-gray-800 mb-3">No Active Reservation</h2>
          <p className="text-gray-500 mb-8 max-w-xs mx-auto">
            You currently do not have an active queue position. Book an appointment to get started.
          </p>
          <Link 
            to="/parent/reserve" 
            className="inline-flex items-center justify-center px-8 py-3.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors shadow-sm"
          >
            Make Reservation
          </Link>
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