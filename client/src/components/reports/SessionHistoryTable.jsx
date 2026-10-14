import { useState } from "react";
import Pagination from "../common/Pagination";
import { sortSessionsNewestFirst } from "../../utils/reportSessions";
import { formatManilaLong } from "../../utils/manilaDate";

const PAGE_SIZE = 10;

function formatClinicDate(dateStr) {
  return dateStr ? formatManilaLong(dateStr) : "—";
}

/**
 * Past completed sessions, newest first, paginated.
 * Rows are clickable only when `onOpenSession` is provided (read-only otherwise).
 */
export default function SessionHistoryTable({ sessions, onOpenSession, emptyMessage, dataTour }) {
  const [page, setPage] = useState(1);
  const sorted = sortSessionsNewestFirst(sessions);
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const interactive = typeof onOpenSession === "function";

  const rowProps = (session) =>
    interactive
      ? {
          role: "button",
          tabIndex: 0,
          className: "pq-table-row-action",
          "aria-label": `View reservations on ${formatClinicDate(session.clinicDate)}`,
          onClick: () => onOpenSession(session.id),
          onKeyDown: (event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onOpenSession(session.id);
            }
          },
        }
      : {};

  const CardTag = interactive ? "button" : "div";

  return (
    <div className="pq-glass overflow-hidden" data-tour={dataTour}>
      <div className="p-6 flex justify-between items-center" style={{ borderBottom: "1px solid var(--pq-glass-line)" }}>
        <h3 className="text-lg font-extrabold tracking-tight">Session History</h3>
      </div>
      {pageRows.length === 0 ? (
        <div className="p-8 text-center pq-muted text-sm">
          {emptyMessage || "No completed clinic sessions match the selected filters."}
        </div>
      ) : (
        <>
          <div className="hidden md:block overflow-x-auto pq-scroll-x">
            <table className="pq-table">
              <thead>
                <tr>
                  <th>Clinic Date</th>
                  <th>Branch</th>
                  <th className="text-center">Total</th>
                  <th className="text-center">Checked Up</th>
                  <th className="text-center">Cancelled</th>
                  <th className="text-center">Forfeited</th>
                  <th className="text-center">Completion</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((session) => (
                  <tr key={session.id} {...rowProps(session)}>
                    <td className="whitespace-nowrap">
                      {formatClinicDate(session.clinicDate)}
                      <div className="text-xs pq-muted font-medium mt-0.5">
                        {session.openingTime} - {session.closingTime}
                      </div>
                    </td>
                    <td className="whitespace-nowrap pq-muted">{session.branch}</td>
                    <td className="text-center">{session.metrics.totalReservations}</td>
                    <td className="text-center" style={{ color: "var(--pq-live)" }}>{session.metrics.checkedUp}</td>
                    <td className="text-center" style={{ color: "var(--pq-alert)" }}>{session.metrics.cancelled}</td>
                    <td className="text-center" style={{ color: "var(--pq-wait)" }}>{session.metrics.forfeited}</td>
                    <td className="text-center font-extrabold" style={{ color: "var(--pq-mark-blue-deep)" }}>
                      {(session.metrics.completionRate || 0).toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="block md:hidden">
            {pageRows.map((session) => (
              <CardTag
                key={session.id}
                {...(interactive
                  ? {
                      type: "button",
                      "aria-label": `View reservations on ${formatClinicDate(session.clinicDate)}`,
                      onClick: () => onOpenSession(session.id),
                    }
                  : {})}
                className="w-full text-left p-4 space-y-3 block"
                style={{ borderTop: "1px solid var(--pq-glass-line)" }}
              >
                <div className="flex justify-between items-start gap-3">
                  <div>
                    <div className="font-extrabold tracking-tight">{formatClinicDate(session.clinicDate)}</div>
                    <div className="text-xs pq-muted">{session.openingTime} - {session.closingTime}</div>
                  </div>
                  <div className="pq-chip pq-chip-info">{session.branch}</div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex flex-col">
                    <span className="pq-faint text-xs">Total</span>
                    <span className="font-semibold">{session.metrics.totalReservations}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="pq-faint text-xs">Completion</span>
                    <span className="font-extrabold" style={{ color: "var(--pq-mark-blue-deep)" }}>
                      {(session.metrics.completionRate || 0).toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="pq-faint text-xs">Checked Up</span>
                    <span className="font-semibold" style={{ color: "var(--pq-live)" }}>{session.metrics.checkedUp}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="pq-faint text-xs">Cancelled/Forfeited</span>
                    <span className="font-semibold">
                      <span style={{ color: "var(--pq-alert)" }}>{session.metrics.cancelled}</span> /{" "}
                      <span style={{ color: "var(--pq-wait)" }}>{session.metrics.forfeited}</span>
                    </span>
                  </div>
                </div>
              </CardTag>
            ))}
          </div>
        </>
      )}

      {sorted.length > 0 ? (
        <Pagination
          page={safePage}
          totalPages={totalPages}
          totalItems={sorted.length}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
          itemLabel={sorted.length === 1 ? "session" : "sessions"}
        />
      ) : null}
    </div>
  );
}
