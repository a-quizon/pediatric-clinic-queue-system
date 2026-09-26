import React, { useEffect, useState } from "react";
import { getReservationsBySchedule } from "../../services/reservationService";
import ReservationPatientNames from "../common/ReservationPatientNames";
import ReservationStatusBadge from "../common/ReservationStatusBadge";
import { PqSpinner } from "../parent/pqUi";

const STATUS_FILTERS = ["All", "Completed", "Cancelled", "Forfeited"];

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

function matchesStatusFilter(reservation, filter) {
  const status = reservation.status;
  if (filter === "All") return true;
  if (filter === "Completed") {
    return ["completed", "consultation_completed"].includes(status);
  }
  if (filter === "Cancelled") {
    return status === "cancelled" || status === "cancelled_by_clinic";
  }
  if (filter === "Forfeited") {
    return ["forfeited", "penalized", "late_limit_reached"].includes(status);
  }
  return true;
}

function emptyMessage(filter) {
  switch (filter) {
    case "Completed":
      return "No completed reservations on this date";
    case "Cancelled":
      return "No cancelled reservations on this date";
    case "Forfeited":
      return "No forfeited reservations on this date";
    default:
      return "No reservations on this date";
  }
}

/**
 * On-demand reservation list for a completed clinic session (by scheduleId).
 * Shared by desktop drawer and mobile full-screen shells.
 */
export default function ReservationsByDate({ scheduleId }) {
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(Boolean(scheduleId));
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState("All");

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
    setStatusFilter("All");

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

  const filteredReservations = reservations.filter((res) =>
    matchesStatusFilter(res, statusFilter)
  );

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

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div
        className="shrink-0 px-3 pt-3 pb-2"
        style={{ borderBottom: "1px solid var(--pq-glass-line)" }}
      >
        <div
          className="flex gap-2 overflow-x-auto pb-1 pq-scroll-x pq-scroll-none"
          role="group"
          aria-label="Filter reservations by status"
        >
          {STATUS_FILTERS.map((filter) => (
            <button
              key={filter}
              type="button"
              onClick={() => setStatusFilter(filter)}
              className={
                statusFilter === filter
                  ? "pq-btn-primary flex-shrink-0"
                  : "pq-btn-secondary flex-shrink-0"
              }
              aria-pressed={statusFilter === filter}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

      {reservations.length === 0 || filteredReservations.length === 0 ? (
        <div className="flex-1 flex items-center justify-center p-8 min-h-0">
          <p className="pq-muted text-sm text-center">{emptyMessage(statusFilter)}</p>
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto pq-scroll-y">
          <ul className="divide-y" style={{ borderColor: "var(--pq-glass-line)" }}>
            {filteredReservations.map((res) => {
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
      )}
    </div>
  );
}
