import React, { useState, useEffect, useMemo } from "react";
import { useAuth } from "../../hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { subscribeToAllSchedules } from "../../services/scheduleService";
import { subscribeToScheduleReservations } from "../../services/reservationService";
import { getBranchConfigurations } from "../../services/branchConfigurationService";
import {
  CalendarDays, ChevronRight, Activity, CheckCircle2, X
} from "lucide-react";
import QueueControlCenter from "../../components/doctor/QueueControlCenter";
import { sortSchedules } from "../../utils/scheduleUtils";
import { PqSpinner } from "../../components/parent/pqUi";
import { useHistoryOverlay } from "../../hooks/useHistoryOverlay";

export default function Home() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [schedules, setSchedules] = useState({});
  const [schedulesLoaded, setSchedulesLoaded] = useState(false);
  const [reservations, setReservations] = useState([]);
  const [reservationsLoaded, setReservationsLoaded] = useState(false);
  const [branches, setBranches] = useState([]);

  useEffect(() => {
    const unsubSchedules = subscribeToAllSchedules((data) => {
      setSchedules(data || {});
      setSchedulesLoaded(true);
    });

    getBranchConfigurations().then(setBranches);

    return () => unsubSchedules();
  }, []);

  const [hiddenSchedules, setHiddenSchedules] = useState([]);
  const [hideConfirmModal, setHideConfirmModal] = useState({ isOpen: false, schedule: null });
  useHistoryOverlay(hideConfirmModal.isOpen, () => setHideConfirmModal({ isOpen: false, schedule: null }));

  const scheduleList = useMemo(() => {
    return Object.entries(schedules).map(([id, val]) => ({ id, ...val }));
  }, [schedules]);

  const dashboardSchedules = useMemo(() => {
    const todayStr = new Date().toLocaleDateString('en-CA');
    const todayFallback = new Date().toDateString();

    const validForDashboard = scheduleList.filter(s => {
      if (hiddenSchedules.includes(s.id)) return false;
      if (s.status === 'draft') return false;
      
      const isCompleted = s.status === 'completed' || s.queueStatus === 'completed' || s.queueStatus === 'ended';
      const isToday = s.clinicDate === todayStr || new Date(s.clinicDate).toDateString() === todayFallback;
      
      // Keep if not completed (Current schedules), OR if completed today
      return !isCompleted || isToday;
    });

    return sortSchedules(validForDashboard);
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

  const selectedScheduleId = selectedSchedule?.id;

  useEffect(() => {
    if (!selectedScheduleId) {
      setReservations([]);
      setReservationsLoaded(true);
      return;
    }

    setReservationsLoaded(false);

    const unsubReservations = subscribeToScheduleReservations(selectedScheduleId, (data) => {
      setReservations(data || []);
      setReservationsLoaded(true);
    });

    return () => unsubReservations();
  }, [selectedScheduleId]);

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
    if (schedule.status === 'completed' || schedule.queueStatus === 'completed' || schedule.queueStatus === 'ended') {
      return (
        <span className="pq-chip">
          <span className="pq-pip" style={{ width: 6, height: 6, animation: "none", boxShadow: "none", background: "var(--pq-ink-faint)" }} /> Completed
        </span>
      );
    }
    if (schedule.queueStatus === 'closed') {
      return (
        <span className="pq-chip pq-chip-alert">
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--pq-alert)" }} /> Closed
        </span>
      );
    }
    if (schedule.queueStatus === 'active') {
      return (
        <span className="pq-chip pq-chip-live">
          <span className="pq-pip" style={{ width: 6, height: 6 }} /> Active
        </span>
      );
    }
    if (schedule.queueStatus === 'paused') {
      return (
        <span className="pq-chip pq-chip-wait">
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--pq-wait)" }} /> Paused
        </span>
      );
    }
    if (schedule.status === 'published') {
      return (
        <span className="pq-chip pq-chip-info">
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--pq-mark-blue)" }} /> Published
        </span>
      );
    }
    return null;
  };


  const loading = !schedulesLoaded || (!!selectedSchedule && !reservationsLoaded);

  return (
    <div className="space-y-6 pb-6">
      <div className="flex flex-col lg:flex-row gap-6">
        {loading ? (
          <div className="flex-[2] pq-glass p-6 md:p-8 flex flex-col justify-center min-h-[400px]">
            <PqSpinner label="Loading today's clinic" />
          </div>
        ) : dashboardSchedules.length > 0 ? (
          <div className="flex-[2] pq-glass p-6 md:p-8 flex flex-col justify-between">
            <div className="flex justify-between items-center mb-6 w-full">
              <div className="w-full relative custom-schedule-dropdown">
                <button
                  type="button"
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  aria-expanded={isDropdownOpen}
                  aria-haspopup="listbox"
                  className="w-full flex justify-between items-center text-left pq-input min-h-[72px]"
                >
                  <div className="flex flex-col w-full min-w-0">
                    <div className="flex items-center w-full mb-1.5 gap-2 min-w-0">
                      <span className="text-lg font-extrabold tracking-tight truncate">
                        {selectedSchedule?.branch || 'Select Schedule'}
                      </span>
                      {selectedSchedule && (
                        <div className="flex-shrink-0">
                          {renderBadge(selectedSchedule)}
                        </div>
                      )}
                    </div>
                    {selectedSchedule && (
                      <div className="text-sm pq-muted font-medium">
                        {selectedSchedule.clinicDate} • {formatTime(selectedSchedule.openingTime)}
                      </div>
                    )}
                  </div>
                  <svg className={`w-5 h-5 pq-faint transition-transform duration-200 flex-shrink-0 ml-2 ${isDropdownOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {isDropdownOpen && (
                  <div
                    className="absolute z-50 mt-2 w-full overflow-y-auto max-h-96 flex flex-col"
                    style={{
                      background: "color-mix(in srgb, #ffffff 92%, var(--pq-paper))",
                      border: "1px solid var(--pq-glass-line)",
                      borderRadius: "var(--pq-radius-sm)",
                      boxShadow: "var(--pq-shadow)",
                    }}
                    role="listbox"
                  >
                    {dashboardSchedules.filter(s => !(s.status === 'completed' || s.queueStatus === 'completed' || s.queueStatus === 'ended')).length > 0 && (
                      <div className="px-3 py-2 text-xs font-extrabold pq-muted uppercase tracking-wider sticky top-0 z-10" style={{ background: "color-mix(in srgb, #ffffff 88%, var(--pq-paper))", borderBottom: "1px solid var(--pq-glass-line)" }}>
                        Current Schedules
                      </div>
                    )}
                    {dashboardSchedules.filter(s => !(s.status === 'completed' || s.queueStatus === 'completed' || s.queueStatus === 'ended')).map(schedule => (
                      <button
                        type="button"
                        key={schedule.id}
                        role="option"
                        aria-selected={selectedSchedule?.id === schedule.id}
                        onClick={() => {
                          setSelectedSchedule(schedule);
                          setSelectionMode('manual');
                          setIsDropdownOpen(false);
                        }}
                        className="w-full flex flex-col text-left px-4 py-3 min-h-[44px] transition-colors"
                        style={{
                          borderBottom: "1px solid var(--pq-glass-line)",
                          background: selectedSchedule?.id === schedule.id ? "color-mix(in srgb, var(--pq-mark-blue) 10%, white)" : "transparent",
                        }}
                      >
                        <div className="flex items-center w-full mb-1.5">
                          <span className={`font-semibold truncate mr-3 text-base ${selectedSchedule?.id === schedule.id ? "" : ""}`} style={{ color: selectedSchedule?.id === schedule.id ? "var(--pq-mark-blue-deep)" : "var(--pq-ink)" }}>
                            {schedule.branch}
                          </span>
                          <div className="flex-shrink-0 mr-4">
                            {renderBadge(schedule)}
                          </div>
                        </div>
                        <div className="text-xs pq-muted font-medium">
                          {schedule.clinicDate} • {formatTime(schedule.openingTime)}
                        </div>
                      </button>
                    ))}

                    {dashboardSchedules.filter(s => s.status === 'completed' || s.queueStatus === 'completed' || s.queueStatus === 'ended').length > 0 && (
                      <div className="px-3 py-2 text-xs font-extrabold pq-muted uppercase tracking-wider sticky top-0 z-10" style={{ background: "color-mix(in srgb, #ffffff 88%, var(--pq-paper))", borderTop: "1px solid var(--pq-glass-line)", borderBottom: "1px solid var(--pq-glass-line)" }}>
                        Completed Today
                      </div>
                    )}
                    {dashboardSchedules.filter(s => s.status === 'completed' || s.queueStatus === 'completed' || s.queueStatus === 'ended').map(schedule => (
                      <div key={schedule.id} className="relative group w-full" style={{ borderBottom: "1px solid var(--pq-glass-line)" }}>
                        <button
                          type="button"
                          role="option"
                          aria-selected={selectedSchedule?.id === schedule.id}
                          onClick={() => {
                            setSelectedSchedule(schedule);
                            setSelectionMode('manual');
                            setIsDropdownOpen(false);
                          }}
                          className="w-full flex flex-col text-left px-4 py-3 min-h-[44px] transition-colors"
                          style={{
                            background: selectedSchedule?.id === schedule.id ? "color-mix(in srgb, var(--pq-mark-blue) 10%, white)" : "transparent",
                          }}
                        >
                          <div className="flex items-center w-full mb-1.5 pr-10">
                            <span className="font-semibold truncate mr-3 text-base" style={{ color: selectedSchedule?.id === schedule.id ? "var(--pq-mark-blue-deep)" : "var(--pq-ink)" }}>
                              {schedule.branch}
                            </span>
                            <div className="flex-shrink-0 flex items-center">
                              {renderBadge(schedule)}
                            </div>
                          </div>
                          <div className="text-xs pq-muted font-medium">
                            {schedule.clinicDate} • {formatTime(schedule.openingTime)}
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            setHideConfirmModal({ isOpen: true, schedule }); 
                            setIsDropdownOpen(false); 
                          }}
                          className="absolute right-2 top-3 pq-icon-btn opacity-100 md:opacity-0 md:group-hover:opacity-100"
                          style={{ width: 36, height: 36, color: "var(--pq-ink-faint)" }}
                          aria-label="Hide this completed schedule"
                          title="Hide this completed schedule"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex-1 flex flex-col gap-4">
              <div className="pq-stat pq-stat-total py-6">
                <span className="pq-stat-label">Total Reservations</span>
                <span className="pq-stat-value">{stats.total}</span>
              </div>

              <div className="grid grid-cols-3 gap-3 flex-shrink-0">
                <div className="pq-stat pq-stat-wait">
                  <span className="pq-stat-label">Waiting</span>
                  <span className="pq-stat-value">{stats.waiting}</span>
                </div>
                <div className="pq-stat pq-stat-info">
                  <span className="pq-stat-label" style={{ whiteSpace: "nowrap" }}>In Consult</span>
                  <span className="pq-stat-value">{stats.inConsultation}</span>
                </div>
                <div className="pq-stat pq-stat-live">
                  <span className="pq-stat-label">Completed</span>
                  <span className="pq-stat-value">{stats.completed}</span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 flex-shrink-0 mt-auto">
                <div className="pq-stat">
                  <span className="pq-stat-label">Checked In</span>
                  <span className="pq-stat-value" style={{ fontSize: "1.125rem" }}>{stats.checkedIn}</span>
                </div>
                <div className="pq-stat">
                  <span className="pq-stat-label">Cancelled</span>
                  <span className="pq-stat-value" style={{ fontSize: "1.125rem" }}>{stats.cancelled}</span>
                </div>
                <div className="pq-stat">
                  <span className="pq-stat-label">Forfeited</span>
                  <span className="pq-stat-value" style={{ fontSize: "1.125rem" }}>{stats.forfeited}</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-[2] pq-glass p-6 md:p-8 flex flex-col justify-center items-center text-center">
            <Activity className="w-16 h-16 mb-4 pq-faint" aria-hidden="true" />
            <h2 className="text-xl font-extrabold tracking-tight mb-2">No Clinic Schedule Today</h2>
            <p className="pq-muted max-w-sm">You don't have a published schedule for today. Publish a schedule to begin monitoring today's clinic.</p>
          </div>
        )}

        <div className="flex-1 pq-glass p-6 md:p-8 flex flex-col">
          <h2 className="text-lg font-extrabold tracking-tight mb-6 flex items-center">
            <CalendarDays className="w-5 h-5 mr-2" style={{ color: "var(--pq-mark-blue)" }} aria-hidden="true" />
            Schedule Overview
          </h2>
          <div className="space-y-3 flex-1">
            {[
              { label: "Draft", count: scheduleOverview.Draft },
              { label: "Published", count: scheduleOverview.Published, tone: "info" },
              { label: "Active", count: scheduleOverview.Active, tone: "live" },
              { label: "Completed", count: scheduleOverview.Completed },
            ].map((row) => (
              <div key={row.label} className={`pq-row ${row.tone === "live" ? "pq-now" : ""}`} style={row.tone === "info" ? { background: "color-mix(in srgb, var(--pq-mark-blue) 10%, white)", borderColor: "color-mix(in srgb, var(--pq-mark-blue) 18%, white)" } : undefined}>
                <span className="font-bold text-sm flex items-center" style={{ color: row.tone === "live" ? "var(--pq-live)" : row.tone === "info" ? "var(--pq-mark-blue-deep)" : "var(--pq-ink-soft)" }}>
                  <span
                    className="w-2.5 h-2.5 rounded-full mr-3"
                    style={{ background: row.tone === "live" ? "var(--pq-live)" : row.tone === "info" ? "var(--pq-mark-blue)" : "var(--pq-ink-faint)" }}
                  />
                  {row.label}
                </span>
                <span className="pq-num text-xl" style={{ color: row.tone === "live" ? "var(--pq-live)" : row.tone === "info" ? "var(--pq-mark-blue-deep)" : "var(--pq-ink)" }}>{row.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {activeOrPublishedSchedule && activeOrPublishedSchedule.status === 'published' && (
        <div className="block lg:hidden mt-2">
          <button 
            type="button"
            onClick={() => navigate("/doctor/queue")}
            className="pq-btn-secondary w-full"
          >
            Open Queue Control <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      )}

      <div className="hidden lg:block mt-6">
        <QueueControlCenter />
      </div>

      {hideConfirmModal.isOpen && (
        <div className="pq-modal-scrim z-[100]">
          <div className="pq-modal w-full max-w-sm overflow-hidden" role="dialog" aria-modal="true" aria-labelledby="hide-session-title">
            <div className="p-6 text-center">
              <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: "color-mix(in srgb, var(--pq-mark-blue) 12%, white)", color: "var(--pq-mark-blue)" }}>
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 id="hide-session-title" className="text-xl font-extrabold tracking-tight mb-2">Hide completed session?</h3>
              <p className="text-sm pq-muted mb-2">You've already reviewed this completed clinic session.</p>
              <p className="text-sm pq-muted mb-6">You can still access its full summary anytime from the Schedules section. Would you like to hide it from the Dashboard?</p>
              
              <div className="flex gap-3">
                <button 
                  type="button"
                  onClick={() => setHideConfirmModal({ isOpen: false, schedule: null })}
                  className="pq-btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button 
                  type="button"
                  onClick={() => {
                    setHiddenSchedules(prev => [...prev, hideConfirmModal.schedule.id]);
                    setHideConfirmModal({ isOpen: false, schedule: null });
                  }}
                  className="pq-btn-primary flex-1"
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
