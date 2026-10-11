import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { Clock, CalendarPlus } from "lucide-react";
import { PqSpinner } from "../../components/parent/pqUi";
import { useAuth } from "../../hooks/useAuth";
import { useCurrentParentSession } from "../../hooks/useCurrentParentSession";
import { getBranchConfigurations } from "../../services/branchConfigurationService";
import PushNotificationSettings from "../../components/parent/PushNotificationSettings";
import ParentQueueMonitor from "../../components/parent/ParentQueueMonitor";
import { manilaDateString } from "../../utils/manilaDate";
import { useTourSample } from "../../hooks/useTourPreview";
import { TourSampleQueueMonitor } from "../../components/onboarding/TourSampleViews";

export default function Dashboard() {
  const { user } = useAuth();
  const showSampleQueue = useTourSample("parent-queue-monitor");
  const { session, schedules, scheduleReservations, loading, error } = useCurrentParentSession(user?.uid);
  const [branches, setBranches] = useState([]);

  useEffect(() => {
    getBranchConfigurations().then(setBranches);
  }, []);

  const todayStr = useMemo(() => manilaDateString(), []);

  const todaySchedule = useMemo(() => {
    const allScheds = Object.values(schedules || {});
    const activeSession = allScheds.find(s => ['active', 'paused', 'closed'].includes(s.queueStatus));
    if (activeSession) return activeSession;
    const publishedToday = allScheds.find(s => s.clinicDate === todayStr && s.status === 'published' && s.queueStatus !== 'ended' && s.queueStatus !== 'completed');
    if (publishedToday) return publishedToday;
    return null;
  }, [schedules, todayStr]);

  if (loading) {
    return <PqSpinner />;
  }

  if (showSampleQueue && !session) {
    return (
      <div className="space-y-5 pb-6 relative max-w-lg mx-auto">
        <PushNotificationSettings variant="dashboard" />
        <TourSampleQueueMonitor />
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-6 relative max-w-lg mx-auto">
      <PushNotificationSettings variant="dashboard" />

      {error && (
        <div className="pq-note pq-note-alert text-sm">
          <p className="font-extrabold">Couldn&apos;t load your queue</p>
          <p className="mt-0.5 font-medium">Check your connection. The monitor will update automatically once it reconnects.</p>
        </div>
      )}

      {session ? (
        <ParentQueueMonitor
          key={session.reservation.id}
          session={session}
          scheduleReservations={scheduleReservations}
          branches={branches}
        />
      ) : (
        <section className="pq-glass overflow-hidden" data-tour="parent-queue-monitor">
          <div className="px-6 sm:px-8 py-5">
            <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight">Today&apos;s Clinic Status</h2>
            <p className="text-[11px] font-semibold pq-muted mt-0.5">Public Status</p>
          </div>

          <div className="px-6 sm:px-8 pb-8 space-y-5">
            <p className="text-sm font-semibold">You have no upcoming reservations.</p>
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
            <Link to="/parent/reserve" className="pq-btn-primary w-full" data-tour="parent-book-cta">
              <CalendarPlus className="w-4 h-4" />
              Make Reservation
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
