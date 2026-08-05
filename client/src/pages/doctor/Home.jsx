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

  // Identify active or published schedule for Today's Clinic
  const activeOrPublishedSchedule = useMemo(() => {
    // Look for a published schedule first
    const published = scheduleList.find(s => s.status === 'published');
    if (published) return published;
    
    // Fallback to today's completed schedule so we can show the neutral state
    const todayStr = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD local format
    
    return scheduleList.find(s => s.status === 'completed' && s.clinicDate === todayStr) || 
           scheduleList.find(s => s.status === 'completed' && new Date(s.clinicDate).toDateString() === new Date().toDateString());
  }, [scheduleList]);

  const activeBranch = useMemo(() => {
    if (!activeOrPublishedSchedule) return null;
    return branches.find(b => b.name === activeOrPublishedSchedule.branch);
  }, [activeOrPublishedSchedule, branches]);

  // Compute Today's Statistics based on active or published schedule
  const stats = useMemo(() => {
    if (!activeOrPublishedSchedule) {
      return { total: 0, waiting: 0, checkedIn: 0, completed: 0, cancelled: 0, forfeited: 0 };
    }
    const schedRes = reservations.filter(r => r.scheduleId === activeOrPublishedSchedule.id);
    
    return {
      total: schedRes.length,
      waiting: schedRes.filter(r => ["reserved", "waiting", "validation_open", "waiting_for_window", "expired", "validation_expired"].includes(r.status)).length,
      checkedIn: schedRes.filter(r => r.status === "checked_in").length,
      completed: schedRes.filter(r => ["completed", "consultation_completed"].includes(r.status)).length,
      cancelled: schedRes.filter(r => r.status === "cancelled").length,
      forfeited: schedRes.filter(r => ["forfeited", "penalized", "late_limit_reached"].includes(r.status)).length,
    };
  }, [reservations, activeOrPublishedSchedule]);

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

  // Determine Today's Clinic Card Color
  const getClinicCardStyle = () => {
    if (!activeOrPublishedSchedule) return "";
    
    const status = activeOrPublishedSchedule.status;
    const qStatus = activeOrPublishedSchedule.queueStatus;
    
    if (status === 'completed' || qStatus === 'completed' || qStatus === 'ended') {
      return "bg-slate-600 border-slate-700"; // Neutral color for completed
    }
    
    if (status === 'published') {
      if (qStatus === 'active' || qStatus === 'paused' || qStatus === 'closed') {
        return "bg-green-600 border-green-700"; // Green for active
      }
      return "bg-gray-600 border-gray-700"; // Gray for published but not started
    }
    
    return "bg-gray-600 border-gray-700";
  };

  const getClinicStatusText = () => {
    if (!activeOrPublishedSchedule) return "";
    
    const status = activeOrPublishedSchedule.status;
    const qStatus = activeOrPublishedSchedule.queueStatus;
    
    if (status === 'completed' || qStatus === 'completed' || qStatus === 'ended') return "Completed";
    if (qStatus === 'active') return "Active";
    if (qStatus === 'paused') return "Paused";
    if (qStatus === 'closed') return "Queue Closed";
    if (status === 'published') return "Published";
    
    return "Unknown";
  };

  return (
    <div className="space-y-6 pb-6">
      
      {/* 1. Today's Clinic (Hero Card) */}
      {activeOrPublishedSchedule && (
        <div className={`rounded-3xl p-8 text-white shadow-lg border ${getClinicCardStyle()} flex flex-col md:flex-row md:items-center justify-between gap-6 transition-colors duration-500`}>
          <div className="flex-1">
            <h2 className="text-3xl md:text-4xl font-black mb-2">{activeOrPublishedSchedule.branch} Branch</h2>
            <div className="text-white/80 text-sm whitespace-pre-line leading-relaxed flex items-start max-w-lg mb-6">
              <MapPin className="w-5 h-5 mr-2 shrink-0 mt-0.5" />
              <span>{activeBranch?.clinicAddress || "No clinic address provided."}</span>
            </div>
            <div>
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-bold bg-white/20 text-white uppercase tracking-wider backdrop-blur-sm">
                Status: {getClinicStatusText()}
              </span>
            </div>
          </div>
          <div className="shrink-0 bg-white/10 backdrop-blur-sm p-6 rounded-2xl border border-white/20 min-w-[250px]">
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <div className="bg-white/20 p-2 rounded-lg"><CalendarDays className="w-5 h-5" /></div>
                <div>
                  <div className="text-xs text-white/70 uppercase font-bold tracking-wider">Day</div>
                  <div className="font-semibold text-lg">{new Date(activeOrPublishedSchedule.clinicDate).toLocaleDateString('en-US', { weekday: 'long' })}</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="bg-white/20 p-2 rounded-lg"><CalendarCheck className="w-5 h-5" /></div>
                <div>
                  <div className="text-xs text-white/70 uppercase font-bold tracking-wider">Date</div>
                  <div className="font-semibold text-lg">{new Date(activeOrPublishedSchedule.clinicDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="bg-white/20 p-2 rounded-lg"><Clock className="w-5 h-5" /></div>
                <div>
                  <div className="text-xs text-white/70 uppercase font-bold tracking-wider">Clinic Hours</div>
                  <div className="font-semibold text-lg">{formatTime(activeOrPublishedSchedule.openingTime)} – {formatTime(activeOrPublishedSchedule.closingTime)}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Desktop side-by-side, Mobile stacked */}
      <div className="flex flex-col lg:flex-row gap-6">
        
        {/* 2. Today's Statistics */}
        {activeOrPublishedSchedule && (
          <div className="flex-[2] bg-white rounded-3xl p-6 md:p-8 border border-gray-200 shadow-sm flex flex-col justify-between">
            <h2 className="text-lg font-bold text-gray-800 flex items-center mb-6">
              <Activity className="w-5 h-5 mr-2 text-blue-600" />
              Today's Statistics
            </h2>
            
            <div className="mb-8 text-center bg-blue-50 py-6 rounded-2xl border border-blue-100">
              <div className="text-blue-600 text-sm font-black uppercase tracking-widest mb-1">Total Reservations</div>
              <div className="text-5xl font-black text-blue-900">{stats.total}</div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div className="bg-gray-50 p-4 rounded-2xl flex flex-col items-center justify-center text-center">
                <span className="text-gray-500 text-xs font-bold uppercase mb-1">Waiting</span>
                <span className="text-xl font-black text-gray-800">{stats.waiting}</span>
              </div>
              <div className="bg-gray-50 p-4 rounded-2xl flex flex-col items-center justify-center text-center">
                <span className="text-gray-500 text-xs font-bold uppercase mb-1">Checked In</span>
                <span className="text-xl font-black text-gray-800">{stats.checkedIn}</span>
              </div>
              <div className="bg-green-50 p-4 rounded-2xl flex flex-col items-center justify-center text-center">
                <span className="text-green-600 text-xs font-bold uppercase mb-1">Completed</span>
                <span className="text-xl font-black text-green-700">{stats.completed}</span>
              </div>
              <div className="bg-red-50 p-4 rounded-2xl flex flex-col items-center justify-center text-center">
                <span className="text-red-500 text-xs font-bold uppercase mb-1">Cancelled</span>
                <span className="text-xl font-black text-red-700">{stats.cancelled}</span>
              </div>
              <div className="bg-amber-50 p-4 rounded-2xl flex flex-col items-center justify-center text-center">
                <span className="text-amber-600 text-xs font-bold uppercase mb-1">Forfeited</span>
                <span className="text-xl font-black text-amber-700">{stats.forfeited}</span>
              </div>
            </div>
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
