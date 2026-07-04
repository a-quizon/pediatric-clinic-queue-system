import React, { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { Activity, Clock, CalendarPlus, Ticket, User, ChevronRight, CheckCircle2, History, MapPin, AlertCircle } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { subscribeToAllReservations } from "../../services/reservationService";
import { getSchedules, subscribeToAllSchedules } from "../../services/scheduleService";

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
    return allReservations.find(r => r.parentId === user.uid && ["reserved", "waiting", "checked_in", "in_consultation"].includes(r.status));
  }, [allReservations, user]);

  const schedule = activeReservation ? schedules[activeReservation.scheduleId] : null;

  const getPermanentQueueNumber = (resId, scheduleId) => {
    const scheduleRes = allReservations
      .filter(r => r.scheduleId === scheduleId)
      .sort((a, b) => a.createdAt - b.createdAt);
    const index = scheduleRes.findIndex(r => r.id === resId);
    return index >= 0 ? index + 1 : null;
  };

  const permanentQueueNumber = activeReservation ? getPermanentQueueNumber(activeReservation.id, activeReservation.scheduleId) : null;

  const { nowServing, patientsAhead, queueLine, nowServingText } = useMemo(() => {
    if (!activeReservation) return { nowServing: null, patientsAhead: 0, queueLine: [], nowServingText: "—" };
    
    const scheduleRes = allReservations
      .filter(r => r.scheduleId === activeReservation.scheduleId)
      .sort((a, b) => a.createdAt - b.createdAt);
    
    // Assign permanent queue numbers
    const resWithPNum = scheduleRes.map((r, idx) => ({ ...r, pNum: idx + 1 }));
    
    const inConsultation = resWithPNum.find(r => r.status === "in_consultation");
    
    const activeLine = resWithPNum
      .filter(r => ["reserved", "waiting", "checked_in", "in_consultation"].includes(r.status))
      .sort((a, b) => (a.queuePosition || 999) - (b.queuePosition || 999));
    
    let servingText = "Waiting";
    if (inConsultation) {
      servingText = `Queue #${inConsultation.pNum}`;
    } else if (activeLine.length > 0) {
      servingText = `Next: #${activeLine[0].pNum}`;
    } else {
      servingText = "—";
    }

    let ahead = 0;
    if (activeReservation.status === "in_consultation") {
      ahead = 0;
    } else {
      const myIndex = activeLine.findIndex(r => r.id === activeReservation.id);
      ahead = myIndex >= 0 ? myIndex : 0;
    }

    return { nowServing: inConsultation || null, patientsAhead: ahead, queueLine: activeLine, nowServingText: servingText };
  }, [allReservations, activeReservation]);

  const getStatusDisplay = (status) => {
    switch (status) {
      case 'reserved': 
      case 'waiting': 
        return { text: 'Awaiting Arrival', color: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500' };
      case 'checked_in': 
        return { text: 'Checked In', color: 'bg-blue-100 text-blue-700', dot: 'bg-blue-500' };
      case 'in_consultation': 
        return { text: 'In Consultation', color: 'bg-green-100 text-green-700', dot: 'bg-green-500' };
      default: 
        return { text: 'Unknown', color: 'bg-gray-100 text-gray-700', dot: 'bg-gray-500' };
    }
  };

  const statusDisplay = activeReservation ? getStatusDisplay(activeReservation.status) : null;
  const estimatedWaitTime = patientsAhead * 15; // 15 mins per patient placeholder

  const maxSegments = 5;
  const activeSegments = activeReservation && activeReservation.status === "in_consultation" 
    ? 5 
    : Math.max(1, maxSegments - Math.min(patientsAhead, maxSegments - 1));

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-6 relative">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Welcome Back</h1>
        <p className="text-gray-500 mt-1">
          Manage your clinic reservations and monitor your queue status.
        </p>
      </div>

      {/* Informational Notice */}
      {activeReservation && schedule && schedule.queueStatus === 'not_started' && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-blue-800 flex items-start text-sm font-medium animate-in fade-in max-w-md mx-auto mb-4">
          <AlertCircle className="w-5 h-5 text-blue-500 mr-3 flex-shrink-0" />
          <p>
            You may reserve your slot now. Please wait until the doctor starts today's clinic queue before proceeding to the secretary for QR Code validation.
          </p>
        </div>
      )}
      {activeReservation && schedule && schedule.queueStatus === 'paused' && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 text-orange-800 flex items-start text-sm font-medium animate-in fade-in max-w-md mx-auto mb-4">
          <AlertCircle className="w-5 h-5 text-orange-500 mr-3 flex-shrink-0" />
          <p>
            The clinic queue is temporarily paused. Please wait until the doctor resumes today's clinic.
          </p>
        </div>
      )}
      {activeReservation && schedule && schedule.queueStatus === 'closed' && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-amber-800 flex items-start text-sm font-medium animate-in fade-in max-w-md mx-auto mb-4">
          <AlertCircle className="w-5 h-5 text-amber-500 mr-3 flex-shrink-0" />
          <p>
            The clinic queue is now closed to new reservations. Your existing reservation remains valid and consultations are continuing normally.
          </p>
        </div>
      )}
      {activeReservation && schedule && schedule.queueStatus !== 'not_started' && (activeReservation.status === "reserved" || activeReservation.status === "waiting") && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-amber-800 flex items-start text-sm font-medium animate-in fade-in max-w-md mx-auto mb-4">
          <AlertCircle className="w-5 h-5 text-amber-500 mr-3 flex-shrink-0" />
          <p>
            Please validate your QR Code or Reservation Code with the secretary before your turn. Failure to validate before your queue is called may result in a penalty.
          </p>
        </div>
      )}

      {activeReservation && schedule ? (
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden max-w-md mx-auto animate-in fade-in slide-in-from-bottom-4">
          <div className="p-6 sm:p-8">
            <div className="flex justify-between items-start mb-8">
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Patient</p>
                <div className="flex items-center">
                  <h2 className="text-xl font-black text-gray-800">{activeReservation.childName || "N/A"}</h2>
                  <CheckCircle2 className="w-5 h-5 text-blue-500 ml-2" />
                </div>
              </div>
              <div className={`px-3 py-1.5 rounded-full text-xs font-bold flex items-center shadow-sm ${statusDisplay.color}`}>
                <div className={`w-2 h-2 rounded-full mr-2 animate-pulse ${statusDisplay.dot}`}></div>
                {statusDisplay.text}
              </div>
            </div>

            <div className="text-center mb-8">
                  <div className="text-gray-400 text-sm font-bold uppercase tracking-wider mb-2">Your Queue Number</div>
                  {activeReservation.status === "in_consultation" ? (
                    <div className="text-5xl font-black text-blue-500 tracking-tight mb-2">IN CLINIC</div>
                  ) : (
                    <div className="text-7xl font-black text-blue-500 tracking-tighter mb-2">#{permanentQueueNumber}</div>
                  )}
                  <p className="text-sm font-medium text-gray-500 mt-2">
                {schedule.branch} • Dr. {schedule.doctorName || "Doctor"}
              </p>
            </div>

            {schedule.status === 'completed' || schedule.queueStatus === 'completed' ? (
              <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100 text-center">
                <CheckCircle2 className="w-8 h-8 text-green-500 mx-auto mb-3" />
                <h3 className="font-bold text-gray-800 mb-2">Today's clinic session has ended.</h3>
                <p className="text-sm text-gray-500">
                  The doctor has completed all consultations for this session. Thank you for your visit!
                </p>
              </div>
            ) : schedule.queueStatus === 'not_started' ? (
              <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100 text-center">
                <Clock className="w-8 h-8 text-blue-400 mx-auto mb-3" />
                <h3 className="font-bold text-gray-800 mb-2">Queue Not Started</h3>
                <p className="text-sm text-gray-500">
                  The clinic queue hasn't started yet. You have successfully reserved your slot. Real-time queue updates will appear once the doctor starts today's clinic.
                </p>
              </div>
            ) : (
              <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100">
                {schedule.queueStatus === 'active' && !nowServing && (
                  <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-green-800 flex items-center text-xs font-bold mb-4">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse mr-2"></div>
                    Queue Open — Waiting for the first consultation to begin.
                  </div>
                )}

                <div className="flex justify-between items-end mb-4">
                  <div>
                    <p className="text-xs font-bold text-gray-500 mb-1">Now Serving</p>
                    <p className="text-2xl font-black text-gray-800">{nowServingText}</p>
                  </div>
                  {activeReservation.status !== "in_consultation" && (
                    <div className="text-right">
                      <p className="text-xs font-bold text-gray-500 mb-1">Est. Wait</p>
                      <p className="text-lg font-black text-blue-500">~{estimatedWaitTime} mins</p>
                    </div>
                  )}
                </div>

                {/* Segmented Progress Bar */}
                <div className="flex gap-1.5 h-2.5 mb-4">
                  {Array.from({ length: maxSegments }).map((_, index) => (
                    <div 
                      key={index} 
                      className={`flex-1 rounded-full ${index < activeSegments ? 'bg-blue-500' : 'bg-gray-200'}`}
                    ></div>
                  ))}
                </div>
                
                <div className="text-center mb-5">
                  <p className="text-xs font-bold text-gray-400">
                    {activeReservation.status === "in_consultation" 
                      ? "You are currently being served" 
                      : `${patientsAhead} patient${patientsAhead === 1 ? '' : 's'} ahead of you`}
                  </p>
                </div>

                {/* Queue Line Display */}
                {queueLine.length > 0 && (
                  <div className="pt-4 border-t border-gray-200">
                    <div className="flex justify-between items-center mb-3">
                      <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Queue Line ({queueLine.length})</h4>
                      <span className="text-[11px] text-gray-400 font-medium">Real-time order</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-1">
                      {queueLine.map((patient) => {
                        const isMe = patient.id === activeReservation.id;
                        const isServing = patient.status === 'in_consultation';
                        const isCheckedIn = patient.status === 'checked_in';
                        return (
                          <div 
                            key={patient.id} 
                            className={`p-2 rounded-xl border flex items-center justify-between text-xs font-bold ${
                              isMe 
                                ? 'bg-blue-50 border-blue-200 text-blue-800 shadow-sm' 
                                : isServing 
                                ? 'bg-green-50 border-green-200 text-green-800' 
                                : 'bg-white border-gray-200 text-gray-700'
                            }`}
                          >
                            <span className="flex items-center min-w-0">
                              <span className={`w-5 h-5 rounded flex items-center justify-center font-black mr-1.5 text-[10px] flex-shrink-0 ${
                                isMe ? 'bg-blue-600 text-white' : isServing ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-700'
                              }`}>
                                #{patient.pNum}
                              </span>
                              <span className="truncate">
                                {isMe ? 'You' : patient.childName || `Patient #${patient.pNum}`}
                              </span>
                            </span>
                            <span className="text-[9px] uppercase font-bold tracking-tight opacity-75 ml-1 flex-shrink-0">
                              {isServing ? 'In Clinic' : isCheckedIn ? 'Checked In' : 'Waiting'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
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
            <Link to={`/parent/reservations/${activeReservation.id}/qr`} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-blue-100 transition-all group flex flex-col justify-between h-full">
              <div>
                <div className="bg-blue-50 w-12 h-12 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Ticket className="w-6 h-6 text-blue-600" />
                </div>
                <h3 className="font-bold text-gray-800 mb-1">View Ticket</h3>
                <p className="text-gray-500 text-sm mb-4">Show your QR Code at the clinic counter.</p>
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