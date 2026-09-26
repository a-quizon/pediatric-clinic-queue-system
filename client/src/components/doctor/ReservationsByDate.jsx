import React, { useEffect, useState } from "react";
import { getReservationsBySchedule } from "../../services/reservationService";
import ReservationPatientNames from "../common/ReservationPatientNames";
import ReservationStatusBadge from "../common/ReservationStatusBadge";
import { PqSpinner } from "../parent/pqUi";

function formatReservationTime(timestamp) {
  if (!timestamp) return null;
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function sortReservations(list) {
  return [...list].sort((a, b) => {
    const numA = Number(a.queueNumber || a.originalQueueNumber || 0);
    const numB = Number(b.queueNumber || b.originalQueueNumber || 0);
    if (numA !== numB) return numA - numB;
    return (a.createdAt || 0) - (b.createdAt || 0);
  });
}

/**
 * On-demand reservation list for a completed clinic session (by scheduleId).
 * Shared by desktop drawer and mobile full-screen shells.
 */
export default function ReservationsByDate({ scheduleId }) {
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(Boolean(scheduleId));
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!scheduleId) {
      setReservations([]);
      setLoading(false);
      setError(null);
      return undefined;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    getReservationsBySchedule(scheduleId)
      .then((list) => {
        if (cancelled) return;
        setReservations(sortReservations(list || []));
      })
      .catch(() => {
        if (cancelled) return;
        setReservations([]);
        setError("Failed to load reservations.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [scheduleId]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 min-h-0">
        <PqSpinner label="Loading reservations" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 min-h-0">
        <p className="pq-error-text text-sm text-center">{error}</p>
      </div>
    );
  }

  if (reservations.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 min-h-0">
        <p className="pq-muted text-sm text-center">No reservations on this date</p>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <ul className="divide-y" style={{ borderColor: "var(--pq-glass-line)" }}>
        {reservations.map((res) => {
          const timeLabel = formatReservationTime(res.createdAt);
          return (
            <li key={res.id} className="p-4 flex items-start gap-3">
              <div className="pq-queue-plate shrink-0">
                {res.queueNumber || res.queuePosition || "—"}
              </div>
              <div className="min-w-0 flex-1 space-y-1.5">
                <ReservationPatientNames
                  reservation={res}
                  fallback={res.parentEmail || "Unnamed Patient"}
                  nameClassName="font-bold text-gray-800 text-sm"
                />
                <div className="flex flex-wrap items-center gap-2">
                  <ReservationStatusBadge status={res.status} />
                  {res.reservationCode && (
                    <span className="text-[11px] pq-faint font-semibold tracking-wide">
                      {res.reservationCode}
                    </span>
                  )}
                </div>
              </div>
              {timeLabel && (
                <div className="text-right shrink-0">
                  <div className="text-[10px] pq-faint font-extrabold uppercase tracking-wider mb-0.5">
                    Reserved
                  </div>
                  <div className="text-sm font-semibold pq-muted">{timeLabel}</div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
