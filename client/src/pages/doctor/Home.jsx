import React, { useState, useEffect, useMemo } from "react";
import { useAuth } from "../../hooks/useAuth";
import { useNavigate, Link } from "react-router-dom";
import { subscribeToAllSchedules } from "../../services/scheduleService";
import { subscribeToAllReservations } from "../../services/reservationService";
import { getBranchConfigurations } from "../../services/branchConfigurationService";
import { 
  CalendarDays, Users, User, ChevronRight, Activity, 
  MapPin, Clock, CalendarCheck, CheckCircle2, Lock, FileText, XCircle, AlertTriangle, X 
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

  const [hiddenSchedules, setHiddenSchedules] = useState([]);
  const [hideConfirmModal, setHideConfirmModal] = useState({ isOpen: false, schedule: null });

  const scheduleList = useMemo(() => {
    return Object.entries(schedules).map(([id, val]) => ({ id, ...val }));
  }, [schedules]);

  const dashboardSchedules = useMemo(() => {
    const todayStr = new Date().toLocaleDateString('en-CA');
    const todayFallback = new Date().toDateString();
    
    // 1. Current Schedules (Published, Active, Paused)
    const current = scheduleList.filter(s => 
      !hiddenSchedules.includes(s.id) &&
      (s.status === 'published' || s.queueStatus === 'active' || s.queueStatus === 'paused') &&
      s.status !== 'completed' && s.queueStatus !== 'completed' && s.queueStatus !== 'ended'
    ).sort((a, b) => {
       const dateA = new Date(a.clinicDate).getTime();
       const dateB = new Date(b.clinicDate).getTime();
       if (dateA !== dateB) return dateA - dateB;
       return (a.openingTime || '').localeCompare(b.openingTime || '');
    });

    // 2. Completed Today
    const completedToday = scheduleList.filter(s => 
      !hiddenSchedules.includes(s.id) &&
      (s.clinicDate === todayStr || new Date(s.clinicDate).toDateString() === todayFallback) &&
      (s.status === 'completed' || s.queueStatus === 'completed' || s.queueStatus === 'ended')
    ).sort((a, b) => {
       const dateA = new Date(a.clinicDate).getTime();
       const dateB = new Date(b.clinicDate).getTime();
       if (dateA !== dateB) return dateA - dateB;
       return (a.openingTime || '').localeCompare(b.openingTime || '');
    });

    return [...current, ...completedToday];
  }, [scheduleList, hiddenSchedules]);

  const [selectedSchedule, setSelectedSchedule] = useState(null);
  const [selectionMode, setSelectionMode] = useState('automatic');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest('.custom-schedule-dropdown')) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const getDefaultSchedule = (schedules) => {
    if (schedules.length === 0) return null;
    const active = schedules.find(s => s.queueStatus === 'active');
    if (active) return active;
    const paused = schedules.find(s => s.queueStatus === 'paused');
    if (paused) return paused;
    const published = schedules.find(s => s.status === 'published' && s.queueStatus !== 'completed' && s.queueStatus !== 'ended');
    if (published) return published;
    return schedules[0];
  };

  useEffect(() => {
    if (dashboardSchedules.length === 0) {
      if (selectedSchedule) setSelectedSchedule(null);
      return;
    }

    if (!selectedSchedule) {
      setSelectedSchedule(getDefaultSchedule(dashboardSchedules));
      setSelectionMode('automatic');
      return;
    }

    const currentLatest = dashboardSchedules.find(s => s.id === selectedSchedule.id);

    if (currentLatest) {
      if (JSON.stringify(currentLatest) !== JSON.stringify(selectedSchedule)) {
        setSelectedSchedule(currentLatest);
      }

      const isCompleted = currentLatest.status === 'completed' || currentLatest.queueStatus === 'completed' || currentLatest.queueStatus === 'ended';
      
      if (selectionMode === 'automatic' && isCompleted) {
        const topSchedule = getDefaultSchedule(dashboardSchedules);
        if (topSchedule && topSchedule.id !== currentLatest.id) {
          setSelectedSchedule(topSchedule);
        }
      }
    } else {
      setSelectedSchedule(getDefaultSchedule(dashboardSchedules));
      setSelectionMode('automatic');
    }
  }, [dashboardSchedules, selectedSchedule, selectionMode]);

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

  const renderBadge = (schedule) => {
    if (!schedule) return null;
    if (schedule.queueStatus === 'active') {
      return (
        <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-bold text-[10px] shadow-sm border border-green-200 flex items-center">
          <div className="w-1.5 h-1.5 rounded-full bg-green-500 mr-1"></div> Active
        </span>
      );
    }
    if (schedule.queueStatus === 'paused') {
      return (
        <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full font-bold text-[10px] shadow-sm border border-amber-200 flex items-center">
          <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1"></div> Paused
        </span>
      );
    }
    if (schedule.status === 'published' && schedule.queueStatus !== 'completed' && schedule.queueStatus !== 'ended') {
      return (
        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full font-bold text-[10px] shadow-sm border border-blue-200 flex items-center">
          <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mr-1"></div> Published
        </span>
      );
    }
    if (schedule.status === 'completed' || schedule.queueStatus === 'completed' || schedule.queueStatus === 'ended') {
      return (
        <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded-full font-bold text-[10px] shadow-sm border border-gray-200 flex items-center">
          <div className="w-1.5 h-1.5 rounded-full bg-gray-500 mr-1"></div> Completed
        </span>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6 pb-6">

      {/* Desktop side-by-side, Mobile stacked */}
      <div className="flex flex-col lg:flex-row gap-6">
        
        {/* 2. Today's Statistics */}
        {dashboardSchedules.length > 0 ? (
          <div className="flex-[2] bg-white rounded-3xl p-6 md:p-8 border border-gray-200 shadow-sm flex flex-col justify-between">
            <div className="flex justify-between items-center mb-6 w-full">
              
              {/* Single Source Dropdown */}
              <div className="w-full relative custom-schedule-dropdown">
                <button
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="w-full flex justify-between items-center text-left bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer shadow-sm transition-colors hover:bg-gray-100"
                >
                  <div className="flex flex-col w-full">
                    {/* First Line: Branch Name + Badge */}
                    <div className="flex items-center w-full mb-1.5">
                      <span className="text-lg font-bold text-gray-800 truncate mr-3">
                        {selectedSchedule?.branch || 'Select Schedule'}
                      </span>
                      {selectedSchedule && (
                        <div className="flex-shrink-0 mr-4">
                          {renderBadge(selectedSchedule)}
                        </div>
                      )}
                    </div>
                    
                    {/* Second Line: Date & Time */}
                    {selectedSchedule && (
                      <div className="text-sm text-gray-500 font-medium">
                        {selectedSchedule.clinicDate} • {formatTime(selectedSchedule.openingTime)}
                      </div>
                    )}
                  </div>
                  
                  {/* Dropdown Arrow: Centered vertically across the entire button */}
                  <svg className={`w-5 h-5 text-gray-500 transition-transform duration-200 flex-shrink-0 ml-2 ${isDropdownOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {isDropdownOpen && (
                  <div className="absolute z-50 mt-2 w-full bg-white border border-gray-100 rounded-xl shadow-lg overflow-y-auto max-h-96 flex flex-col">
                    
                    {/* Current Schedules Group */}
                    {dashboardSchedules.filter(s => !(s.status === 'completed' || s.queueStatus === 'completed' || s.queueStatus === 'ended')).length > 0 && (
                      <div className="px-3 py-2 text-xs font-bold text-gray-500 bg-gray-50 border-b border-gray-100 uppercase tracking-wider sticky top-0 z-10">
                        Current Schedules
                      </div>
                    )}
                    {dashboardSchedules.filter(s => !(s.status === 'completed' || s.queueStatus === 'completed' || s.queueStatus === 'ended')).map(schedule => (
                      <button
                        key={schedule.id}
                        onClick={() => {
                          setSelectedSchedule(schedule);
                          setSelectionMode('manual');
                          setIsDropdownOpen(false);
                        }}
                        className={`w-full flex flex-col text-left px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-0 ${selectedSchedule?.id === schedule.id ? 'bg-blue-50/50' : ''}`}
                      >
                        <div className="flex items-center w-full mb-1.5">
                          <span className={`font-medium truncate mr-3 text-base ${selectedSchedule?.id === schedule.id ? 'text-blue-700' : 'text-gray-800'}`}>
                            {schedule.branch}
                          </span>
                          <div className="flex-shrink-0 mr-4">
                            {renderBadge(schedule)}
                          </div>
                        </div>
                        
                        <div className="text-xs text-gray-500 font-medium">
                          {schedule.clinicDate} • {formatTime(schedule.openingTime)}
                        </div>
                      </button>
                    ))}

                    {/* Completed Today Group */}
                    {dashboardSchedules.filter(s => s.status === 'completed' || s.queueStatus === 'completed' || s.queueStatus === 'ended').length > 0 && (
                      <div className="px-3 py-2 text-xs font-bold text-gray-500 bg-gray-50 border-y border-gray-100 uppercase tracking-wider sticky top-0 z-10">
                        Completed Today
                      </div>
                    )}
                    {dashboardSchedules.filter(s => s.status === 'completed' || s.queueStatus === 'completed' || s.queueStatus === 'ended').map(schedule => (
                      <div key={schedule.id} className="relative group w-full border-b border-gray-100 last:border-0">
                        <button
                          onClick={() => {
                            setSelectedSchedule(schedule);
                            setSelectionMode('manual');
                            setIsDropdownOpen(false);
                          }}
                          className={`w-full flex flex-col text-left px-4 py-3 hover:bg-gray-50 transition-colors ${selectedSchedule?.id === schedule.id ? 'bg-blue-50/50' : ''}`}
                        >
                          <div className="flex items-center w-full mb-1.5 pr-8">
                            <span className={`font-medium truncate mr-3 text-base ${selectedSchedule?.id === schedule.id ? 'text-blue-700' : 'text-gray-800'}`}>
                              {schedule.branch}
                            </span>
                            <div className="flex-shrink-0 flex items-center">
                              {renderBadge(schedule)}
                            </div>
                          </div>
                          <div className="text-xs text-gray-500 font-medium">
                            {schedule.clinicDate} • {formatTime(schedule.openingTime)}
                          </div>
                        </button>
                        {/* Dismiss Icon */}
                        <div
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            setHideConfirmModal({ isOpen: true, schedule }); 
                            setIsDropdownOpen(false); 
                          }}
                          className="absolute right-3 top-4 p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg cursor-pointer transition-colors opacity-0 md:group-hover:opacity-100"
                          title="Hide this completed schedule"
                        >
                          <X className="w-4 h-4" />
                        </div>
                      </div>
                    ))}
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

      {/* Hide Confirm Modal */}
      {hideConfirmModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 text-center">
              <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-2">Hide completed session?</h3>
              <p className="text-sm text-gray-500 mb-2">You've already reviewed this completed clinic session.</p>
              <p className="text-sm text-gray-500 mb-6">You can still access its full summary anytime from the Schedules section. Would you like to hide it from the Dashboard?</p>
              
              <div className="flex gap-3">
                <button 
                  onClick={() => setHideConfirmModal({ isOpen: false, schedule: null })}
                  className="flex-1 py-2.5 bg-gray-50 text-gray-700 font-bold rounded-xl hover:bg-gray-100 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => {
                    setHiddenSchedules(prev => [...prev, hideConfirmModal.schedule.id]);
                    setHideConfirmModal({ isOpen: false, schedule: null });
                  }}
                  className="flex-1 py-2.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors"
                >
                  Hide from Dashboard
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
