import React, { useState, useEffect, useMemo } from "react";
import { useAuth } from "../../hooks/useAuth";
import { useNavigate, Link } from "react-router-dom";
import { subscribeToAllSchedules } from "../../services/scheduleService";
import { subscribeToAllReservations } from "../../services/reservationService";
import { getBranchConfigurations } from "../../services/branchConfigurationService";
import { 
  CalendarDays, Users, User, ChevronRight, Activity, 
  MapPin, Clock, CalendarCheck, CheckCircle2, Lock, FileText, XCircle, AlertTriangle 
} from "lucide-react";
import QueueControlCenter from "../../components/doctor/QueueControlCenter";

export default function Home() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [schedules, setSchedules] = useState({});
  const [reservations, setReservations] = useState([]);
  const [branches, setBranches] = useState([]);

  useEffect(() => {
    const unsubSchedules = subscribeToAllSchedules((data) => {
      setSchedules(data || {});
    });

    const unsubReservations = subscribeToAllReservations((data) => {
      setReservations(data || []);
    });

    getBranchConfigurations().then(setBranches);

    return () => {
      unsubSchedules();
      unsubReservations();
    };
  }, []);

  const scheduleList = useMemo(() => {
    return Object.entries(schedules).map(([id, val]) => ({ id, ...val }));
  }, [schedules]);

  const todayPublishedSchedules = useMemo(() => {
    const todayStr = new Date().toLocaleDateString('en-CA');
    const todayFallback = new Date().toDateString();
    
    const validSchedules = scheduleList.filter(s => 
      (s.clinicDate === todayStr || new Date(s.clinicDate).toDateString() === todayFallback) && 
      (s.status === 'published' || s.status === 'completed' || s.queueStatus === 'active' || s.queueStatus === 'paused' || s.queueStatus === 'completed')
    );

    const getPriority = (s) => {
       if (s.queueStatus === 'active') return 1;
       if (s.queueStatus === 'paused') return 2;
       if (s.status === 'published') return 3;
       if (s.status === 'completed' || s.queueStatus === 'completed') return 4;
       return 5;
    };

    return validSchedules.sort((a, b) => {
       const priorityA = getPriority(a);
       const priorityB = getPriority(b);
       if (priorityA !== priorityB) {
          return priorityA - priorityB;
       }
       return (a.openingTime || '').localeCompare(b.openingTime || '');
    });
  }, [scheduleList]);

  const [selectedSchedule, setSelectedSchedule] = useState(null);
  const [selectionMode, setSelectionMode] = useState('automatic');

  useEffect(() => {
    if (todayPublishedSchedules.length === 0) {
      if (selectedSchedule) setSelectedSchedule(null);
      return;
    }

    if (!selectedSchedule) {
      setSelectedSchedule(todayPublishedSchedules[0]);
      setSelectionMode('automatic');
      return;
    }

    const currentLatest = todayPublishedSchedules.find(s => s.id === selectedSchedule.id);

    if (currentLatest) {
      if (JSON.stringify(currentLatest) !== JSON.stringify(selectedSchedule)) {
        setSelectedSchedule(currentLatest);
      }

      const isCompleted = currentLatest.status === 'completed' || currentLatest.queueStatus === 'completed' || currentLatest.queueStatus === 'ended';
      
      if (selectionMode === 'automatic' && isCompleted) {
        const topSchedule = todayPublishedSchedules[0];
        if (topSchedule.id !== currentLatest.id) {
          setSelectedSchedule(topSchedule);
        }
      }
    } else {
      setSelectedSchedule(todayPublishedSchedules[0]);
      setSelectionMode('automatic');
    }
  }, [todayPublishedSchedules, selectedSchedule, selectionMode]);

  // Identify active or published schedule for Today's Clinic
  const activeOrPublishedSchedule = useMemo(() => {
    // 1. Schedule with queueStatus === "active"
    const active = scheduleList.find(s => s.queueStatus === 'active');
    if (active) return active;
    
    // 2. Schedule with queueStatus === "paused"
    const paused = scheduleList.find(s => s.queueStatus === 'paused');
    if (paused) return paused;
    
    // 3. Schedule with status === "published"
    const published = scheduleList.find(s => s.status === 'published');
    if (published) return published;

    // 4. The most recently completed schedule for today
    const todayStr = new Date().toLocaleDateString('en-CA');
    const completedToday = scheduleList.filter(s => s.status === 'completed' && s.clinicDate === todayStr);
    
    if (completedToday.length > 0) {
      completedToday.sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0));
      return completedToday[0];
    }
    
    return null;
  }, [scheduleList]);

  const activeBranch = useMemo(() => {
    if (!activeOrPublishedSchedule) return null;
    return branches.find(b => b.name === activeOrPublishedSchedule.branch);
  }, [activeOrPublishedSchedule, branches]);

  const isCompletedSession = useMemo(() => {
    if (!activeOrPublishedSchedule) return false;
    const { status, queueStatus } = activeOrPublishedSchedule;
    return status === 'completed' || queueStatus === 'completed' || queueStatus === 'ended';
  }, [activeOrPublishedSchedule]);

  // Compute Today's Statistics based on active or published schedule
  const stats = useMemo(() => {
    if (!selectedSchedule) {
      return { total: 0, waiting: 0, checkedIn: 0, inConsultation: 0, completed: 0, cancelled: 0, forfeited: 0 };
    }
    const schedRes = reservations.filter(r => r.scheduleId === selectedSchedule.id);
    
    return {
      total: schedRes.length,
      waiting: schedRes.filter(r => ["reserved", "waiting", "validation_open", "waiting_for_window", "expired", "validation_expired"].includes(r.status)).length,
      checkedIn: schedRes.filter(r => r.status === "checked_in").length,
      inConsultation: schedRes.filter(r => r.status === "in_consultation").length,
      completed: schedRes.filter(r => ["completed", "consultation_completed"].includes(r.status)).length,
      cancelled: schedRes.filter(r => r.status === "cancelled").length,
      forfeited: schedRes.filter(r => ["forfeited", "penalized", "late_limit_reached"].includes(r.status)).length,
    };
  }, [reservations, selectedSchedule]);

  // Compute Schedule Overview counts
  const scheduleOverview = useMemo(() => {
    const overview = { Draft: 0, Published: 0, Active: 0, Completed: 0 };
    scheduleList.forEach(s => {
      if (s.status === 'draft') overview.Draft++;
      else if (s.status === 'completed' || s.queueStatus === 'completed' || s.queueStatus === 'ended') overview.Completed++;
      else if (s.status === 'published') {
        if (s.queueStatus === 'active' || s.queueStatus === 'paused' || s.queueStatus === 'closed') overview.Active++;
        else overview.Published++;
      }
    });
    return overview;
  }, [scheduleList]);

  const formatTime = (time) => {
    if (!time) return '';
    const [hours, minutes] = time.split(':');
    const h = parseInt(hours, 10);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const formattedH = h % 12 || 12;
    return `${formattedH}:${minutes} ${ampm}`;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="space-y-6 pb-6">

      {/* Desktop side-by-side, Mobile stacked */}
      <div className="flex flex-col lg:flex-row gap-6">
        
        {/* 2. Today's Statistics */}
        {todayPublishedSchedules.length > 0 ? (
          <div className="flex-[2] bg-white rounded-3xl p-6 md:p-8 border border-gray-200 shadow-sm flex flex-col justify-between">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
              <div className="w-full sm:w-auto flex-1 max-w-sm">
                <select
                  value={selectedSchedule?.id || ''}
                  onChange={(e) => {
                    const found = todayPublishedSchedules.find(s => s.id === e.target.value);
                    if (found) {
                      setSelectedSchedule(found);
                      setSelectionMode('manual');
                    }
                  }}
                  className="w-full text-lg font-bold text-gray-800 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500 appearance-none cursor-pointer"
                  style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%234b5563'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'right 1rem center',
                    backgroundSize: '1.25em 1.25em',
                  }}
                >
                  {todayPublishedSchedules.map(schedule => {
                    const isCompleted = schedule.status === 'completed' || schedule.queueStatus === 'completed';
                    return (
                      <option key={schedule.id} value={schedule.id}>
                        {schedule.branch} {isCompleted ? '(Completed)' : ''} • {formatDate(schedule.clinicDate)} • {formatTime(schedule.openingTime)}
                      </option>
                    );
                  })}
                </select>
                {selectedSchedule && (
                  <div className="text-sm text-gray-500 mt-2 ml-1 flex flex-wrap items-center gap-3">
                    <p>{formatDate(selectedSchedule.clinicDate)} • {formatTime(selectedSchedule.openingTime)}</p>
                    {(selectedSchedule.status === 'completed' || selectedSchedule.queueStatus === 'completed') && (
                      <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-bold text-[10px] shadow-sm border border-green-200 flex items-center">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-500 mr-1"></div> Completed
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex-1 flex flex-col gap-4">
              {/* Tier 1: Total Reservations */}
              <div className="text-center bg-blue-50 py-6 rounded-2xl border border-blue-100 flex-shrink-0">
                <div className="text-blue-600 text-sm font-black uppercase tracking-widest mb-1">Total Reservations</div>
                <div className="text-5xl font-black text-blue-900 leading-none">{stats.total}</div>
              </div>

              {/* Tier 2: Waiting, In Consultation, Completed */}
              <div className="grid grid-cols-3 gap-3 flex-shrink-0">
                <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100 flex flex-col items-center justify-center text-center shadow-sm">
                  <span className="text-amber-600 text-[10px] font-bold uppercase tracking-wider mb-2">Waiting</span>
                  <span className="text-2xl font-black text-amber-900 leading-none">{stats.waiting}</span>
                </div>
                <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 flex flex-col items-center justify-center text-center shadow-sm">
                  <span className="text-blue-600 text-[10px] font-bold uppercase tracking-wider mb-2 text-nowrap">In Consult</span>
                  <span className="text-2xl font-black text-blue-900 leading-none">{stats.inConsultation}</span>
                </div>
                <div className="bg-green-50 p-4 rounded-2xl border border-green-100 flex flex-col items-center justify-center text-center shadow-sm">
                  <span className="text-green-600 text-[10px] font-bold uppercase tracking-wider mb-2">Completed</span>
                  <span className="text-2xl font-black text-green-900 leading-none">{stats.completed}</span>
                </div>
              </div>

              {/* Tier 3: Checked In, Cancelled, Forfeited */}
              <div className="grid grid-cols-3 gap-3 flex-shrink-0 mt-auto">
                <div className="bg-gray-50 p-3 rounded-xl flex flex-col items-center justify-center text-center border border-gray-100">
                  <span className="text-gray-500 text-[10px] font-bold uppercase tracking-wider mb-1">Checked In</span>
                  <span className="text-lg font-black text-gray-800 leading-none">{stats.checkedIn}</span>
                </div>
                <div className="bg-gray-50 p-3 rounded-xl flex flex-col items-center justify-center text-center border border-gray-100">
                  <span className="text-gray-500 text-[10px] font-bold uppercase tracking-wider mb-1">Cancelled</span>
                  <span className="text-lg font-black text-gray-800 leading-none">{stats.cancelled}</span>
                </div>
                <div className="bg-gray-50 p-3 rounded-xl flex flex-col items-center justify-center text-center border border-gray-100">
                  <span className="text-gray-500 text-[10px] font-bold uppercase tracking-wider mb-1">Forfeited</span>
                  <span className="text-lg font-black text-gray-800 leading-none">{stats.forfeited}</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-[2] bg-white rounded-3xl p-6 md:p-8 border border-gray-200 shadow-sm flex flex-col justify-center items-center text-center">
            <Activity className="w-16 h-16 text-gray-300 mb-4" />
            <h2 className="text-xl font-bold text-gray-800 mb-2">No Clinic Schedule Today</h2>
            <p className="text-gray-500 max-w-sm">You don't have a published schedule for today. Publish a schedule to begin monitoring today's clinic.</p>
          </div>
        )}

        {/* 3. Schedule Overview */}
        <div className="flex-1 bg-white rounded-3xl p-6 md:p-8 border border-gray-200 shadow-sm flex flex-col">
          <h2 className="text-lg font-bold text-gray-800 mb-6 flex items-center">
            <CalendarDays className="w-5 h-5 mr-2 text-blue-600" />
            Schedule Overview
          </h2>
          <div className="space-y-4 flex-1">
            <div className="flex justify-between items-center p-4 bg-gray-50 rounded-2xl border border-gray-100">
              <span className="font-bold text-gray-600 flex items-center text-sm">
                <div className="w-2.5 h-2.5 rounded-full bg-gray-400 mr-3"></div> Draft
              </span>
              <span className="text-xl font-black text-gray-800">{scheduleOverview.Draft}</span>
            </div>
            <div className="flex justify-between items-center p-4 bg-blue-50 rounded-2xl border border-blue-100">
              <span className="font-bold text-blue-700 flex items-center text-sm">
                <div className="w-2.5 h-2.5 rounded-full bg-blue-500 mr-3"></div> Published
              </span>
              <span className="text-xl font-black text-blue-800">{scheduleOverview.Published}</span>
            </div>
            <div className="flex justify-between items-center p-4 bg-green-50 rounded-2xl border border-green-100">
              <span className="font-bold text-green-700 flex items-center text-sm">
                <div className="w-2.5 h-2.5 rounded-full bg-green-500 mr-3"></div> Active
              </span>
              <span className="text-xl font-black text-green-800">{scheduleOverview.Active}</span>
            </div>
            <div className="flex justify-between items-center p-4 bg-gray-50 rounded-2xl border border-gray-100">
              <span className="font-bold text-gray-600 flex items-center text-sm">
                <div className="w-2.5 h-2.5 rounded-full bg-gray-400 mr-3"></div> Completed
              </span>
              <span className="text-xl font-black text-gray-800">{scheduleOverview.Completed}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Queue Control Access (Mobile Only) */}
      {activeOrPublishedSchedule && activeOrPublishedSchedule.status === 'published' && (
        <div className="block lg:hidden mt-2">
          <button 
            onClick={() => navigate("/doctor/queue")}
            className="px-6 py-4 bg-white border border-gray-200 text-gray-700 font-bold rounded-2xl shadow-sm hover:bg-gray-50 transition-all flex items-center justify-center w-full"
          >
            Open Queue Control <ChevronRight className="w-5 h-5 ml-2" />
          </button>
        </div>
      )}

      {/* 4. Queue Control Center (Desktop Only) */}
      <div className="hidden lg:block mt-6">
        <QueueControlCenter />
      </div>

    </div>
  );
}
