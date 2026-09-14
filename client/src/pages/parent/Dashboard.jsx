import React, { useState, useEffect, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import { Clock, CalendarPlus, Users, Building2, Stethoscope } from "lucide-react";
import { PqSpinner } from "../../components/parent/pqUi";
import { useAuth } from "../../hooks/useAuth";
import { subscribeToParentReservations, subscribeToScheduleReservations, ACTIVE_RESERVATION_STATUSES } from "../../services/reservationService";
import { getSchedules, subscribeToAllSchedules } from "../../services/scheduleService";
import { getBranchConfigurations } from "../../services/branchConfigurationService";
import { isReservationExpired, getRemainingValidationTime, formatRemainingTime } from "../../services/timeService";
import ReservationStatusBadge from "../../components/common/ReservationStatusBadge";
import { computeReservationState, computeAheadOfYou, QUEUE_STATES } from "../../services/queueEngine";
import PushNotificationSettings from "../../components/parent/PushNotificationSettings";
import { getReservationChildDisplayName } from "../../utils/reservationPatients";
import { formatBranchLabel, branchesMatch } from "../../utils/stringUtils";

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

  const childName = getReservationChildDisplayName(activeReservation);
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

  const permanentQueueNumber = activeReservation ? (activeReservation.queueNumber || activeReservation.originalQueueNumber || 1) : null;

  const { nowServing, patientsAhead, nowServingText, completedCount, progressPercent, queueState, activeLine } = useMemo(() => {
    if (!activeReservation || scheduleReservations.length === 0) {
      return { nowServing: null, patientsAhead: 0, nowServingText: "—", completedCount: 0, progressPercent: 0, queueState: null, activeLine: [] };
    }
    
    const scheduleRes = [...scheduleReservations].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    
    // Assign permanent queue numbers based on actual queueNumber
    const resWithPNum = scheduleRes.map((r, idx) => ({ ...r, pNum: r.queueNumber || r.originalQueueNumber || (idx + 1) }));
    
    const inConsultation = resWithPNum.find(r => r.status === "in_consultation" || r.status === "with_doctor");
    const completedList = resWithPNum.filter(r => r.status === "consultation_completed");
    const compCount = completedList.length;
    
    const activeLine = resWithPNum
      .filter(r => ACTIVE_RESERVATION_STATUSES.includes(r.status))
      .sort((a, b) => {
        if (a.queueOrder !== undefined && b.queueOrder !== undefined) {
          return a.queueOrder - b.queueOrder;
        }
        const timeA = a.sortTimestamp || a.createdAt || 0;
        const timeB = b.sortTimestamp || b.createdAt || 0;
        return timeA - timeB;
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
    return <PqSpinner />;
  }

  const waitingKeys = activeLine.filter((r) => !["in_consultation", "with_doctor"].includes(r.status));
  const guideFirst = waitingKeys[0]?.pNum;
  const guideLast = waitingKeys[waitingKeys.length - 1]?.pNum;

  return (
    <div className="space-y-5 pb-6 relative max-w-lg mx-auto">
      <PushNotificationSettings variant="dashboard" />

      {activeReservation && schedule ? (
        <div className="space-y-4">
          <section className="pq-glass overflow-hidden">
            <div className="p-4 flex justify-between items-start gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: "color-mix(in srgb, var(--pq-mark-blue) 12%, white)", color: "var(--pq-mark-blue-deep)" }}>
                  <Building2 className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h2 className="font-bold text-sm leading-tight">
                    {schedule.branch || "Velasquez Pediatric Clinic"}
                    {!schedule.branch?.toLowerCase().includes('clinic') && " Clinic"}
                  </h2>
                  <span className="text-[11px] font-semibold block leading-tight mt-0.5" style={{ color: "var(--pq-mark-blue-deep)" }}>
                    {formatBranchLabel(schedule.branch)}
                  </span>
                  <span className="text-[10px] pq-muted block truncate max-w-[150px] sm:max-w-[200px] leading-tight mt-0.5">
                    {branches.find(b => branchesMatch(b.name, schedule.branch) || b.id === schedule.branchId)?.clinicAddress || "Magalang Road, Angeles City, Pampanga"}
                  </span>
                </div>
              </div>
              <div className="text-right shrink-0 pl-3" style={{ borderLeft: "1px solid var(--pq-glass-line)" }}>
                <div className="flex items-center justify-end gap-1 mb-0.5" style={{ color: "var(--pq-mark-blue-deep)" }}>
                  <Clock className="w-3.5 h-3.5" />
                  <span className="text-[11px] font-bold">Clinic Hours</span>
                </div>
                <div className="text-[10px] font-semibold leading-tight">
                  {new Date(schedule.clinicDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </div>
                <div className="text-[10px] pq-muted leading-tight">
                  {schedule.openingTime ? `${schedule.openingTime}` : "8:00 AM - 5:00 PM"}
                </div>
              </div>
            </div>

            <Link to={`/parent/reservations/${activeReservation.id}/qr`} className="pq-ticket block">
              <div className="pq-ticket-num">
                <div className="text-[11px] font-bold mb-1" style={{ color: "var(--pq-mark-blue-deep)" }}>My Queue Number</div>
                <div className="pq-num text-5xl sm:text-6xl" style={{ color: "var(--pq-mark-blue-deep)" }}>
                  {permanentQueueNumber || "-"}
                </div>
                <p className="text-[10px] sm:text-xs font-medium mt-2 leading-snug">
                  {(() => {
                    if (queueState === QUEUE_STATES.WITH_DOCTOR || activeReservation.status === 'in_consultation' || activeReservation.status === 'with_doctor') return "You're currently with the doctor.";
                    if (queueState === QUEUE_STATES.YOU_ARE_NEXT) return "You're Next — Please be ready.";
                    if (queueState === QUEUE_STATES.ALMOST_NEXT) return "Your turn is approaching.";
                    if (activeReservation.status === 'completed' || activeReservation.status === 'consultation_completed') return "Consultation completed.";
                    return "Please wait for your turn.";
                  })()}
                </p>
                <div className="mt-3 flex justify-center">
                  <ReservationStatusBadge status={queueState || effectiveStatus} className="shadow-xs px-3 py-1 text-[10px] sm:text-xs font-bold" />
                </div>
              </div>
              <div className="pq-ticket-ahead flex flex-col items-center justify-center">
                <div className="text-[11px] font-bold mb-1" style={{ color: "var(--pq-wait)" }}>Patients Ahead</div>
                <div className="pq-num text-5xl sm:text-6xl">
                  {["in_consultation", "with_doctor"].includes(activeReservation.status) || queueState === QUEUE_STATES.WITH_DOCTOR || activeReservation.status === "consultation_completed"
                      ? "0"
                      : patientsAhead}
                </div>
                <div className="flex items-center justify-center gap-1.5 mt-2">
                  <Users className="w-3.5 h-3.5" style={{ color: "var(--pq-wait)" }} />
                  <span className="text-[10px] sm:text-xs font-medium pq-muted">ahead of you</span>
                </div>
              </div>
            </Link>

            <div className="p-4 pt-3">
              <div className="pq-now">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-11 h-11 rounded-full flex items-center justify-center shrink-0" style={{ background: "color-mix(in srgb, var(--pq-live) 16%, white)", color: "var(--pq-live)" }}>
                    <Stethoscope className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold leading-tight">Now Serving</h3>
                    <div className="pq-num text-2xl leading-none mt-0.5">
                      {nowServing ? `Queue #${nowServing.pNum}` : "—"}
                    </div>
                  </div>
                </div>
                {nowServing && (
                  <div className="pq-chip pq-chip-live shrink-0">
                    {['with_doctor', 'in_consultation'].includes(nowServing.status) ? 'WITH DOCTOR' : 'IN PROGRESS'}
                    <span className="pq-pip" />
                  </div>
                )}
              </div>
              {nowServing && activeReservation && nowServing.id === activeReservation.id && (
                <p className="text-center text-xs font-bold mt-2" style={{ color: "var(--pq-live)" }}>You're in consultation</p>
              )}
            </div>

            <div className="px-4 pb-4">
              <div className="flex items-baseline justify-between gap-2 mb-3">
                <h2 className="text-sm font-bold">Waiting Queue</h2>
                {waitingKeys.length > 0 && (
                  <span className="text-[11px] font-semibold pq-muted">#{guideFirst}–#{guideLast}</span>
                )}
              </div>
              {waitingKeys.length > 0 ? (
                <div className="pq-wait-row">
                  {waitingKeys.map((r) => {
                    const isYou = r.id === activeReservation.id;
                    return (
                      <div key={r.id} className={`pq-wait-key ${isYou ? "pq-wait-key-you" : ""}`}>
                        <div className="pq-num text-lg">{r.pNum}</div>
                        <div className="text-[10px] font-semibold mt-0.5">{isYou ? "You" : "In Queue"}</div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm pq-muted text-center py-3">No one is currently waiting.</p>
              )}
            </div>
          </section>

          <p className="text-center text-[10px] pq-faint font-medium">
            Real-time updates may vary depending on internet connection.
          </p>
        </div>
      ) : (
        <section className="pq-glass overflow-hidden">
          <div className="px-6 sm:px-8 py-5">
            <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight">Today&apos;s Clinic Status</h2>
            <p className="text-[11px] font-semibold pq-muted mt-0.5">Public Status</p>
          </div>

          <div className="px-6 sm:px-8 pb-8 space-y-5">
            {todaySchedule ? (
              <>
                <p className="text-sm font-semibold leading-relaxed">
                  {todaySchedule.queueStatus === 'closed'
                    ? "Today's clinic is currently serving existing reservations."
                    : todaySchedule.queueStatus === 'active'
                    ? "Today's clinic session is live and serving patients."
                    : todaySchedule.queueStatus === 'paused'
                    ? "Today's clinic session is temporarily paused."
                    : "Today's clinic session is available for reservation."}
                </p>
                <p className="text-sm pq-muted">
                  {todaySchedule.branch || "Angeles"}
                  {" · "}
                  Queue {todaySchedule.queueStatus === 'active' ? 'Open' : todaySchedule.queueStatus === 'paused' ? 'Paused' : todaySchedule.queueStatus === 'closed' ? 'Closed' : 'Not Started'}
                  {" · Reservations "}
                  {todaySchedule.queueStatus === 'closed' ? 'Closed' : 'Available'}
                </p>
              </>
            ) : (
              <div className="py-2 text-center space-y-3">
                <div className="mx-auto w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: "color-mix(in srgb, var(--pq-ink) 8%, white)", color: "var(--pq-ink-faint)" }}>
                  <Clock className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="text-lg font-bold">No Active Clinic Session</h3>
                  <p className="text-xs pq-muted mt-1">No clinic session is currently active today.</p>
                </div>
              </div>
            )}
            <Link to="/parent/reserve" className="pq-btn-primary w-full">
              <CalendarPlus className="w-4 h-4" />
              Make Reservation
            </Link>
          </div>
        </section>
      )}


    </div>
  );
}