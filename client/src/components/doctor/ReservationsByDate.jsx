import React, { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getReservationsBySchedule } from "../../services/reservationService";
import ReservationPatientNames from "../common/ReservationPatientNames";
import ReservationStatusBadge from "../common/ReservationStatusBadge";
import { PqSpinner } from "../parent/pqUi";

const STATUS_FILTERS = ["All", "Completed", "Cancelled", "Forfeited"];
const ITEMS_PER_PAGE = 10;

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
  const [currentPage, setCurrentPage] = useState(1);

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
    setCurrentPage(1);

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

  const totalPages = Math.max(1, Math.ceil(filteredReservations.length / ITEMS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedReservations = filteredReservations.slice(
    (safePage - 1) * ITEMS_PER_PAGE,
    safePage * ITEMS_PER_PAGE
  );

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [filteredReservations.length, currentPage, totalPages]);

  const handleFilterChange = (filter) => {
    setStatusFilter(filter);
    setCurrentPage(1);
  };

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

  const filterBar = (
    <div
      className="shrink-0 px-3 pt-3 pb-2"
      style={{
        borderBottom: "1px solid var(--pq-glass-line)",
        background: "color-mix(in srgb, #ffffff 92%, var(--pq-paper, #e4f3f4))",
      }}
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
            onClick={() => handleFilterChange(filter)}
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
  );

  const paginationFooter =
    filteredReservations.length > ITEMS_PER_PAGE ? (
      <div
        className="shrink-0 px-3 py-3 flex items-center justify-between gap-3"
        style={{ borderTop: "1px solid var(--pq-glass-line)" }}
      >
        <span className="text-sm pq-muted font-medium min-w-0">
          Showing{" "}
          <span className="font-semibold" style={{ color: "var(--pq-ink)" }}>
            {(safePage - 1) * ITEMS_PER_PAGE + 1}
          </span>
          –
          <span className="font-semibold" style={{ color: "var(--pq-ink)" }}>
            {Math.min(safePage * ITEMS_PER_PAGE, filteredReservations.length)}
          </span>{" "}
          of{" "}
          <span className="font-semibold" style={{ color: "var(--pq-ink)" }}>
            {filteredReservations.length}
          </span>
        </span>
        <div className="flex gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={safePage === 1}
            className="pq-icon-btn"
            aria-label="Previous page"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={safePage === totalPages}
            className="pq-icon-btn"
            aria-label="Next page"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    ) : null;

  if (reservations.length === 0 || filteredReservations.length === 0) {
    return (
      <div className="flex flex-col flex-1 min-h-0">
        {filterBar}
        <div className="flex-1 flex items-center justify-center p-8 min-h-0">
          <p className="pq-muted text-sm text-center">{emptyMessage(statusFilter)}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {filterBar}
      <div className="flex-1 min-h-0 overflow-y-auto pq-scroll-y">
        <ul className="divide-y" style={{ borderColor: "var(--pq-glass-line)" }}>
          {paginatedReservations.map((res) => {
            const timeLabel = formatReservationTime(res.createdAt);
            return (
              <li key={res.id} className="p-4 flex items-start gap-3">
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
      {paginationFooter}
    </div>
  );
}
