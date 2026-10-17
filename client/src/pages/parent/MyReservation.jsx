import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Ticket as TicketIcon, Clock, MapPin, CalendarDays, ChevronRight } from "lucide-react";
import { PqSpinner } from "../../components/parent/pqUi";
import { subscribeToAllSchedules } from "../../services/scheduleService";
import { subscribeToParentReservations } from "../../services/reservationService";
import { getBranchConfigurations } from "../../services/branchConfigurationService";
import { useAuth } from "../../hooks/useAuth";
import { useTourSample } from "../../hooks/useTourPreview";
import { TourSampleLateRules, TourSampleTicket } from "../../components/onboarding/TourSampleViews";
import { manilaDateString } from "../../utils/manilaDate";

export default function MyReservation() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const showSampleTicket = useTourSample(["reservation-list", "ticket-qr", "parent-late-rules"]);
  const showLateRules = useTourSample("parent-late-rules");
  
  const [schedules, setSchedules] = useState({});
  const [allReservations, setAllReservations] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubSchedules = subscribeToAllSchedules((data) => {
      setSchedules(data || {});
    });

    let unsubReservations = () => {};
    if (user) {
      unsubReservations = subscribeToParentReservations(user.uid, (data) => {
        setAllReservations(data || []);
        setLoading(false);
      });
    }

    getBranchConfigurations().then(setBranches);

    return () => {
      unsubSchedules();
      unsubReservations();
    };
  }, [user]);

  // Filter for active/pending reservations (never show past unused or already-expired)
  const activeReservations = useMemo(() => {
    if (!user) return [];
    const today = manilaDateString();
    const myRes = allReservations.filter((r) => r.parentId === user.uid);

    const eligibleStatuses = [
      "reserved",
      "waiting",
      "validation_open",
      "waiting_for_window",
      "checked_in",
      "in_consultation",
      "with_doctor",
    ];

    const eligible = myRes.filter((r) => {
      if (!eligibleStatuses.includes(r.status)) return false;
      const schedule = schedules[r.scheduleId];
      const clinicDate = schedule?.clinicDate || r.clinicDate;
      if (!clinicDate) return true;
      // Hide past unused tickets even before the nightly cleanup job runs
      if (clinicDate < today) return false;
      return true;
    });

    eligible.sort((a, b) => {
      const scheduleA = schedules[a.scheduleId];
      const scheduleB = schedules[b.scheduleId];
      if (!scheduleA || !scheduleB) return 0;
      if (scheduleA.clinicDate !== scheduleB.clinicDate) {
        return scheduleA.clinicDate < scheduleB.clinicDate ? -1 : 1;
      }
      return String(scheduleA.openingTime || "").localeCompare(String(scheduleB.openingTime || ""));
    });

    return eligible;
  }, [allReservations, user, schedules]);

  const formatTime = (time) => {
    if (!time) return '';
    const [hours, minutes] = time.split(':');
    const h = parseInt(hours, 10);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const formattedH = h % 12 || 12;
    return `${formattedH}:${minutes} ${ampm}`;
  };

  if (loading) {
    return (
      <div className="space-y-5 pb-8 relative">
        <p className="pq-muted text-sm">
          View your active clinic reservations, check-in arrival passes, and real-time queue status.
        </p>
        <PqSpinner />
      </div>
    );
  }

  if (showSampleTicket && activeReservations.length === 0) {
    return (
      <div className="space-y-5 pb-8 relative">
        <p className="pq-muted text-sm">
          View your active clinic reservations, check-in arrival passes, and real-time queue status.
        </p>
        <TourSampleTicket />
        {showLateRules ? <TourSampleLateRules /> : null}
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-8 relative" data-tour="reservation-list">
      <p className="pq-muted text-sm">
          View your active clinic reservations, check-in arrival passes, and real-time queue status.
      </p>

      {activeReservations.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {activeReservations.map((res) => {
            const schedule = schedules[res.scheduleId];
            if (!schedule) return null;

            const isQueueStarted = ['active', 'paused', 'closed'].includes(schedule.queueStatus);

            return (
              <button
                type="button"
                key={res.id}
                onClick={() => navigate(`/parent/reservations/${res.id}/qr`)}
                className="pq-glass p-5 flex items-center justify-between text-left cursor-pointer group"
              >
                <div className="flex-1 pr-4">
                  <div className="flex items-center justify-between mb-3 gap-2">
                    <h3 className="text-lg font-bold flex items-center min-w-0">
                      <MapPin className="w-5 h-5 mr-1.5 shrink-0" style={{ color: isQueueStarted ? "var(--pq-live)" : "var(--pq-mark-blue)" }} />
                      <span className="truncate">{schedule.branch}</span>
                    </h3>
                    
                    {isQueueStarted && (
                      <span className="pq-chip pq-chip-live shrink-0">
                        <span className="pq-pip" />
                        Queue Started
                      </span>
                    )}
                  </div>

                  <div className="space-y-1.5 text-sm">
                    <div className="flex items-center pq-muted">
                      <CalendarDays className="w-4 h-4 mr-2" />
                      <span>
                        {new Date(schedule.clinicDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </span>
                    </div>
                    
                    <div className="flex items-center pq-muted">
                      <Clock className="w-4 h-4 mr-2" />
                      <span>
                        {formatTime(schedule.openingTime)} - {formatTime(schedule.closingTime)}
                      </span>
                    </div>

                    <div
                      className="flex items-center mt-3 pt-3"
                      style={{ borderTop: "1px solid var(--pq-glass-line)" }}
                      data-tour="ticket-qr-hint"
                    >
                      <TicketIcon className="w-4 h-4 mr-2 pq-faint" />
                      <span className="pq-muted">
                        QR: <span className="font-bold font-mono tracking-wider">{res.reservationCode}</span>
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pq-icon-btn shrink-0">
                  <ChevronRight className="w-5 h-5" />
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center min-h-[50vh] w-full">
          <div className="pq-glass p-10 sm:p-14 text-center max-w-md mx-auto w-full">
            <div className="mx-auto w-20 h-20 rounded-full flex items-center justify-center mb-6" style={{ background: "color-mix(in srgb, var(--pq-mark-blue) 12%, white)", color: "var(--pq-mark-blue-deep)" }}>
              <TicketIcon className="w-10 h-10" />
            </div>
            <h2 className="text-xl sm:text-2xl font-extrabold mb-2">No Active Reservations</h2>
            <p className="pq-muted text-sm max-w-xs mx-auto mb-8 leading-relaxed">
              You don&apos;t have an active reservation yet. Reserve a queue slot to get started.
            </p>
            <button
              onClick={() => navigate("/parent/reserve")}
              className="pq-btn-primary w-full"
            >
              Reserve Queue
            </button>
          </div>
        </div>
      )}

      {showLateRules ? <TourSampleLateRules /> : null}
    </div>
  );
}
