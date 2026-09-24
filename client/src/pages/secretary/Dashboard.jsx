import React, { useState, useEffect } from 'react';
import { Calendar, Clock, Stethoscope, AlertCircle } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { getBranchConfigurations } from "../../services/branchConfigurationService";
import { subscribeToScheduleReservations } from "../../services/reservationService";
import { subscribeToPublishedSchedules } from "../../services/scheduleService";
import { getReservationChildDisplayName } from "../../utils/reservationPatients";
import ManageQueue from "./ManageQueue";
import { branchesMatch, scheduleMatchesAssignedBranch } from "../../utils/stringUtils";
import { manilaDateString } from "../../utils/manilaDate";
import { PqSpinner } from "../../components/parent/pqUi";

export default function Dashboard() {
  const { user } = useAuth();
  const [clinicAddress, setClinicAddress] = useState("");
  const [schedules, setSchedules] = useState({});
  const [schedulesLoaded, setSchedulesLoaded] = useState(false);
  const [reservations, setReservations] = useState([]);
  const [reservationsLoaded, setReservationsLoaded] = useState(false);

  useEffect(() => {
    const fetchAddress = async () => {
      if (user?.assignedBranch || user?.assignedBranchId) {
        const branches = await getBranchConfigurations();
        const branch = branches.find(b =>
          (user.assignedBranchId && b.id === user.assignedBranchId) ||
          branchesMatch(b.name, user.assignedBranch)
        );
        if (branch && branch.clinicAddress) {
          setClinicAddress(branch.clinicAddress);
        }
      }
    };
    fetchAddress();
  }, [user?.assignedBranch, user?.assignedBranchId]);

  useEffect(() => {
    const unsubSchedules = subscribeToPublishedSchedules((data) => {
      const schedulesMap = {};
      data.forEach(s => schedulesMap[s.id] = s);
      setSchedules(schedulesMap);
      setSchedulesLoaded(true);
    });

    return () => {
      unsubSchedules();
    };
  }, []);

  // Identify the most relevant active or published schedule for this branch
  const branchSchedules = Object.values(schedules).filter(s => scheduleMatchesAssignedBranch(s, user));
  
  // Priority 1: Currently active or paused
  let publishedSchedule = branchSchedules.find(s => s.queueStatus === 'active' || s.queueStatus === 'paused');
  
  if (!publishedSchedule) {
    // Priority 2: Published for today
    const todayStr = manilaDateString();
    publishedSchedule = branchSchedules.find(s => s.status === 'published' && s.clinicDate === todayStr && s.queueStatus !== 'completed' && s.queueStatus !== 'ended' && s.queueStatus !== 'closed');
  }

  if (!publishedSchedule) {
    // Priority 3: Any published schedule
    publishedSchedule = branchSchedules.find(s => s.status === 'published' && s.queueStatus !== 'completed' && s.queueStatus !== 'ended' && s.queueStatus !== 'closed');
  }

  useEffect(() => {
    if (!publishedSchedule) {
      setReservations([]);
      return;
    }

    setReservationsLoaded(false);
    const unsubReservations = subscribeToScheduleReservations(publishedSchedule.id, (data) => {
      setReservations(data);
      setReservationsLoaded(true);
    });

    return () => unsubReservations();
  }, [publishedSchedule?.id]);

  const loading = !schedulesLoaded || (!!publishedSchedule && !reservationsLoaded);

  const activeReservations = publishedSchedule ? reservations.filter(r => r.scheduleId === publishedSchedule.id) : [];

  const waitingPatients = activeReservations.filter(r => ["reserved", "waiting", "validation_open", "waiting_for_window"].includes(r.status));
  const checkedInPatients = activeReservations.filter(r => r.status === "checked_in");
  const withDoctorPatients = activeReservations.filter(r => ["with_doctor", "in_consultation"].includes(r.status));
  const completedPatients = activeReservations.filter(r => ["completed", "consultation_completed"].includes(r.status));

  const remainingQueueCount = waitingPatients.length + checkedInPatients.length;

  const stats = [
    { name: "Remaining Queue", value: remainingQueueCount, tone: "info" },
    { name: "Waiting", value: waitingPatients.length, tone: "wait" },
    { name: "Checked In", value: checkedInPatients.length, tone: "live" },
    { name: "Completed", value: completedPatients.length, tone: "default" }
  ];

  const sortedWaitingQueue = activeReservations
    .filter(r => ["checked_in", "reserved", "waiting", "validation_open", "waiting_for_window"].includes(r.status))
    .sort((a, b) => {
      if (a.queueOrder !== undefined && b.queueOrder !== undefined) {
        return a.queueOrder - b.queueOrder;
      }
      return (a.sortTimestamp || a.createdAt || 0) - (b.sortTimestamp || b.createdAt || 0);
    });

  const nextCheckedIn = sortedWaitingQueue.find(r => r.status === "checked_in");
  const nextWaiting = sortedWaitingQueue.find(r => ["reserved", "waiting", "validation_open", "waiting_for_window"].includes(r.status));
  const currentWithDoctor = withDoctorPatients[0];

  let activities = [];
  activeReservations.forEach(res => {
    const name = getReservationChildDisplayName(res, "Patient");
    
    if (res.createdAt) activities.push({ time: res.createdAt, text: `Parent/Guardian reserved a slot.` });
    if (res.checkedInAt) activities.push({ time: res.checkedInAt, text: `${name} checked in` });
    if (res.sentToDoctorAt) activities.push({ time: res.sentToDoctorAt, text: `${name} sent to Doctor` });
    if (res.consultationCompletedAt) activities.push({ time: res.consultationCompletedAt, text: `${name} consultation completed` });
    if (res.cancelledAt) activities.push({ time: res.cancelledAt, text: `${name} cancelled reservation` });
    if (res.forfeitedAt) activities.push({ time: res.forfeitedAt, text: `${name} was forfeited` });
    if (res.penalizedAt || res.lastPenalizedAt) activities.push({ time: res.lastPenalizedAt || res.penalizedAt, text: `${name} penalized` });
  });

  activities.sort((a, b) => b.time - a.time);
  const recentActivities = activities.slice(0, 15);

  const formatTime = (timestamp) => {
    if (!timestamp) return "";
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
  
  const formatTime12h = (time24) => {
    if (!time24) return "";
    const [h, m] = time24.split(":");
    let hours = parseInt(h, 10);
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12 || 12;
    return `${hours}:${m} ${ampm}`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return "";
    return new Date(dateString).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  };

  if (loading) {
    return (
      <div className="pq-glass p-10">
        <PqSpinner label="Loading dashboard" />
      </div>
    );
  }

  const statClass = (tone) => {
    if (tone === "wait") return "pq-stat pq-stat-wait";
    if (tone === "live") return "pq-stat pq-stat-live";
    if (tone === "info") return "pq-stat pq-stat-info";
    return "pq-stat";
  };

  return (
    <div className="space-y-6 pb-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <section className="pq-glass p-6 md:p-8">
          <h2 className="text-lg font-extrabold tracking-tight mb-5 flex items-center gap-2">
            <Calendar className="w-5 h-5" style={{ color: "var(--pq-mark-blue)" }} aria-hidden="true" />
            Published Schedule
          </h2>
          {publishedSchedule ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-6">
              <div>
                <p className="pq-stat-label mb-1">Branch Name</p>
                <p className="text-sm font-extrabold">{publishedSchedule.branch}</p>
              </div>
              <div>
                <p className="pq-stat-label mb-1">Reservation Schedule Status</p>
                <span className={`pq-chip ${publishedSchedule.queueStatus === "active" ? "pq-chip-live" : "pq-chip-info"}`}>
                  {publishedSchedule.queueStatus === "active" ? (
                    <span className="pq-pip" style={{ width: 6, height: 6 }} />
                  ) : null}
                  {publishedSchedule.queueStatus === "active" ? "Active" : "Published"}
                </span>
              </div>
              <div>
                <p className="pq-stat-label mb-1">Clinic Date</p>
                <p className="text-sm font-extrabold">{formatDate(publishedSchedule.clinicDate)}</p>
              </div>
              <div>
                <p className="pq-stat-label mb-1">Clinic Hours</p>
                <p className="text-sm font-extrabold">
                  {formatTime12h(publishedSchedule.openingTime)} - {formatTime12h(publishedSchedule.closingTime)}
                </p>
              </div>
              <div className="sm:col-span-2">
                <p className="pq-stat-label mb-1">Clinic Address</p>
                <p className="text-sm font-medium pq-muted whitespace-pre-line leading-relaxed">{clinicAddress || "No address configured"}</p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <AlertCircle className="w-10 h-10 pq-faint mb-3" aria-hidden="true" />
              <p className="font-extrabold tracking-tight">No Published Schedule</p>
              <p className="text-sm pq-muted mt-1 max-w-[250px]">No reservation schedule is published for your assigned branch yet. Open the calendar to publish days.</p>
            </div>
          )}
        </section>

        <section className="pq-glass p-6 md:p-8 flex flex-col">
          <h2 className="text-lg font-extrabold tracking-tight mb-5 flex items-center gap-2">
            <Stethoscope className="w-5 h-5" style={{ color: "var(--pq-live)" }} aria-hidden="true" />
            With Doctor
          </h2>
          {currentWithDoctor ? (
            <div className="pq-now flex-1">
              <div className="flex items-center gap-4 min-w-0">
                <div className="pq-queue-plate pq-queue-plate-live w-16 h-16 flex-col" aria-hidden="true">
                  <span className="text-[9px] uppercase font-extrabold leading-none opacity-80 mb-0.5">Queue</span>
                  <span className="pq-num text-xl">#{currentWithDoctor.queueNumber || currentWithDoctor.queuePosition}</span>
                </div>
                <div className="min-w-0">
                  <p className="text-xl font-extrabold tracking-tight mb-1 truncate">
                    {getReservationChildDisplayName(currentWithDoctor, "Unnamed Patient")}
                  </p>
                  <p className="text-sm font-semibold" style={{ color: "var(--pq-live)" }}>
                    Consultation Started: {formatTime(currentWithDoctor.consultationStartedAt || currentWithDoctor.sentToDoctorAt)}
                  </p>
                </div>
              </div>
              <span className="pq-pip flex-shrink-0" aria-hidden="true" />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-6 text-center flex-1">
              <div className="w-12 h-12 rounded-full flex items-center justify-center mb-3 pq-faint" style={{ background: "color-mix(in srgb, #ffffff 55%, transparent)", border: "1px solid var(--pq-glass-line)" }}>
                <Stethoscope className="w-6 h-6" aria-hidden="true" />
              </div>
              <p className="font-extrabold tracking-tight">Consultation Room Available</p>
              <p className="text-sm pq-muted mt-1">Waiting for the next patient.</p>
            </div>
          )}
        </section>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {stats.map((stat) => (
          <div key={stat.name} className={statClass(stat.tone)}>
            <span className="pq-stat-label">{stat.name}</span>
            <span className="pq-stat-value">{stat.value}</span>
          </div>
        ))}
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        <div className="hidden lg:block lg:flex-[2.5] min-w-0">
          <ManageQueue hideHeader={true} />
        </div>

        <aside className="lg:flex-1 flex flex-col gap-6 min-w-0">
          <section className="pq-glass p-6 flex flex-col flex-1 min-h-[300px]">
            <h2 className="text-lg font-extrabold tracking-tight mb-4 flex items-center gap-2">
              <Clock className="w-4 h-4" style={{ color: "var(--pq-mark-blue)" }} aria-hidden="true" />
              Recent Activity
            </h2>

            <div className="overflow-y-auto flex-1 pr-1 space-y-2 max-h-[400px]">
              {recentActivities.length === 0 ? (
                <div className="text-center py-10 pq-row block min-h-0">
                  <p className="font-extrabold text-sm">No Activity Yet</p>
                  <p className="text-xs pq-muted mt-1 max-w-[180px] mx-auto">Clinic activity will appear here throughout the day.</p>
                </div>
              ) : (
                recentActivities.map((act, i) => (
                  <div key={`${act.time}-${i}`} className="pq-row items-start">
                    <div className="min-w-0">
                      <p className="text-[10px] font-extrabold pq-faint uppercase tracking-wider mb-0.5">{formatTime(act.time)}</p>
                      <p className="text-sm font-medium break-words">{act.text}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}