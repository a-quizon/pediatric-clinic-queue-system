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
    return scheduleList.find(s => 
      s.status === 'published' && 
      (s.queueStatus === 'active' || s.queueStatus === 'paused' || s.queueStatus === 'closed' || s.queueStatus === 'not_started')
    );
  }, [scheduleList]);

  // For the Current Active Queue card (only if it has actually started)
  const activeQueue = useMemo(() => {
    return scheduleList.find(s => 
      s.status === 'published' && 
      (s.queueStatus === 'active' || s.queueStatus === 'paused' || s.queueStatus === 'closed')
    );
  }, [scheduleList]);

  const activeBranch = useMemo(() => {
    if (!activeOrPublishedSchedule) return null;
    return branches.find(b => b.name === activeOrPublishedSchedule.branch);
  }, [activeOrPublishedSchedule, branches]);

  // Compute Today's Statistics based on active or published schedule
  const stats = useMemo(() => {
    if (!activeOrPublishedSchedule) {
      return { total: 0, waiting: 0, checkedIn: 0, withDoctor: 0, completed: 0, cancelled: 0, forfeited: 0 };
    }
    const schedRes = reservations.filter(r => r.scheduleId === activeOrPublishedSchedule.id);
    
    return {
      total: schedRes.length,
      waiting: schedRes.filter(r => ["reserved", "waiting", "validation_open", "waiting_for_window", "expired", "validation_expired"].includes(r.status)).length,
      checkedIn: schedRes.filter(r => r.status === "checked_in").length,
      withDoctor: schedRes.filter(r => ["in_consultation", "with_doctor"].includes(r.status)).length,
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

  const actionCards = [
    {
      title: "Schedules",
      description: "Manage your availability",
      icon: CalendarDays,
      path: "/doctor/schedules",
    },
    {
      title: "Queue",
      description: "Monitor patient flow",
      icon: Users,
      path: "/doctor/queue",
    },
    {
      title: "Profile",
      description: "Account settings",
      icon: User,
      path: "/doctor/profile",
    },
  ];

  return (
    <div className="space-y-6 pb-6">
      
      {/* 1. Current Active Queue (Moved to Top) */}
      <div>
        {activeQueue ? (
          <div className="bg-gradient-to-r from-green-600 to-emerald-700 rounded-2xl p-6 md:p-8 text-white shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-black bg-white/20 text-white uppercase tracking-wider">
                  Current Active Queue
                </span>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-green-900/40 text-green-200">
                  Status: {activeQueue.queueStatus === 'closed' ? 'Queue Closed' : activeQueue.queueStatus === 'paused' ? 'Paused' : 'Active'}
                </span>
              </div>
              <h2 className="text-2xl md:text-3xl font-black mb-2">{activeQueue.branch} Branch</h2>
              <div className="text-green-200 text-sm whitespace-pre-line leading-tight mb-4 max-w-lg">
                {branches.find(b => b.name === activeQueue.branch)?.clinicAddress || "No clinic address provided."}
              </div>
              <div className="text-green-100 text-sm flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6">
                <span className="flex items-center"><CalendarDays className="w-4 h-4 mr-1.5" /> <strong className="text-white ml-1">{new Date(activeQueue.clinicDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</strong></span>
                <span className="flex items-center"><Clock className="w-4 h-4 mr-1.5" /> <strong className="text-white ml-1">{formatTime(activeQueue.openingTime)} – {formatTime(activeQueue.closingTime)}</strong></span>
              </div>
            </div>
            <div className="shrink-0 w-full md:w-auto">
              <button 
                onClick={() => navigate("/doctor/queue")}
                className="px-6 py-4 bg-white text-green-700 font-bold rounded-xl shadow-md hover:bg-green-50 transition-all flex items-center justify-center w-full md:w-auto"
              >
                Open Queue Control <Activity className="w-5 h-5 ml-2" />
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-gray-50 rounded-2xl p-8 border border-dashed border-gray-300 flex flex-col items-center justify-center text-center">
            <Activity className="w-12 h-12 text-gray-300 mb-4" />
            <h3 className="text-lg font-bold text-gray-600 mb-1">No Active Queue</h3>
            <p className="text-gray-500 text-sm">Start a published schedule from Schedule Management to manage its queue.</p>
          </div>
        )}
      </div>

      {/* 2. Today's Statistics */}
      {activeOrPublishedSchedule && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex flex-col justify-center">
            <div className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-1 flex items-center">
              <Users className="w-4 h-4 mr-1 text-blue-500" /> Total
            </div>
            <div className="text-2xl font-black text-gray-800">{stats.total}</div>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex flex-col justify-center">
            <div className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-1 flex items-center">
              <Clock className="w-4 h-4 mr-1 text-amber-500" /> Waiting
            </div>
            <div className="text-2xl font-black text-gray-800">{stats.waiting}</div>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex flex-col justify-center">
            <div className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-1 flex items-center">
              <CheckCircle2 className="w-4 h-4 mr-1 text-blue-500" /> Checked In
            </div>
            <div className="text-2xl font-black text-gray-800">{stats.checkedIn}</div>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex flex-col justify-center">
            <div className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-1 flex items-center">
              <Activity className="w-4 h-4 mr-1 text-purple-500" /> With Doctor
            </div>
            <div className="text-2xl font-black text-gray-800">{stats.withDoctor}</div>
          </div>
          <div className="bg-green-50 p-5 rounded-2xl border border-green-100 shadow-sm flex flex-col justify-center">
            <div className="text-green-600 text-xs font-bold uppercase tracking-wider mb-1 flex items-center">
              <FileText className="w-4 h-4 mr-1" /> Completed
            </div>
            <div className="text-2xl font-black text-green-700">{stats.completed}</div>
          </div>
          <div className="bg-red-50 p-5 rounded-2xl border border-red-100 shadow-sm flex flex-col justify-center">
            <div className="text-red-600 text-xs font-bold uppercase tracking-wider mb-1 flex items-center">
              <XCircle className="w-4 h-4 mr-1" /> Cancelled
            </div>
            <div className="text-2xl font-black text-red-700">{stats.cancelled}</div>
          </div>
          <div className="bg-amber-50 p-5 rounded-2xl border border-amber-100 shadow-sm flex flex-col justify-center">
            <div className="text-amber-700 text-xs font-bold uppercase tracking-wider mb-1 flex items-center">
              <AlertTriangle className="w-4 h-4 mr-1" /> Forfeited
            </div>
            <div className="text-2xl font-black text-amber-800">{stats.forfeited}</div>
          </div>
        </div>
      )}

      {/* 3. Schedule Overview */}
      <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
        <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
          <CalendarDays className="w-5 h-5 mr-2 text-blue-600" />
          Schedule Overview
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="flex flex-col p-4 bg-gray-50 rounded-xl border border-gray-100">
            <span className="font-semibold text-gray-600 flex items-center text-sm mb-1">
              <div className="w-2 h-2 rounded-full bg-gray-400 mr-2"></div> Draft
            </span>
            <span className="text-2xl font-black text-gray-800">{scheduleOverview.Draft}</span>
          </div>
          <div className="flex flex-col p-4 bg-blue-50 rounded-xl border border-blue-100">
            <span className="font-semibold text-blue-700 flex items-center text-sm mb-1">
              <div className="w-2 h-2 rounded-full bg-blue-500 mr-2"></div> Published
            </span>
            <span className="text-2xl font-black text-blue-800">{scheduleOverview.Published}</span>
          </div>
          <div className="flex flex-col p-4 bg-green-50 rounded-xl border border-green-100">
            <span className="font-semibold text-green-700 flex items-center text-sm mb-1">
              <div className="w-2 h-2 rounded-full bg-green-500 mr-2"></div> Active
            </span>
            <span className="text-2xl font-black text-green-800">{scheduleOverview.Active}</span>
          </div>
          <div className="flex flex-col p-4 bg-gray-50 rounded-xl border border-gray-100">
            <span className="font-semibold text-gray-600 flex items-center text-sm mb-1">
              <div className="w-2 h-2 rounded-full bg-gray-400 mr-2"></div> Completed
            </span>
            <span className="text-2xl font-black text-gray-800">{scheduleOverview.Completed}</span>
          </div>
        </div>
      </div>

      {/* Queue Control Center (Desktop Only) */}
      <div className="hidden lg:block">
        <QueueControlCenter />
      </div>

      {/* 5. Recent Activity (Quick Actions) */}
      <div>
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4 px-1">
          Recent Activity / Quick Actions
        </h3>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {actionCards.map((card) => (
            <Link 
              key={card.title} 
              to={card.path}
              className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm hover:border-blue-100 hover:shadow-md transition-all flex items-center group"
            >
              <div className="bg-blue-50 p-3 rounded-xl mr-4 group-hover:bg-blue-100 transition-colors">
                <card.icon className="w-6 h-6 text-blue-600" />
              </div>
              <div className="flex-1">
                <h4 className="text-[15px] font-bold text-gray-800 group-hover:text-blue-600 transition-colors">
                  {card.title}
                </h4>
                <p className="text-sm text-gray-500">
                  {card.description}
                </p>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-blue-600 transition-colors" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
