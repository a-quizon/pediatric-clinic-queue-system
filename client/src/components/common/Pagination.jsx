import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * Footer pager: "Showing a–b of n" summary, Previous / Page x of y / Next.
 * Buttons collapse to icons on narrow screens; extra actions (e.g. Load older) go in children.
 */
export default function Pagination({
  page,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  itemLabel = "items",
  children,
}) {
  const pages = Math.max(1, totalPages || 1);
  const current = Math.min(Math.max(1, page || 1), pages);
  const first = totalItems === 0 ? 0 : (current - 1) * pageSize + 1;
  const last = Math.min(current * pageSize, totalItems);
  const atStart = current <= 1;
  const atEnd = current >= pages;

  return (
    <nav
      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 sm:px-5 py-3 sm:py-4 md:flex-none"
      style={{ borderTop: "1px solid var(--pq-glass-line)" }}
      aria-label="Pagination"
    >
      <p className="text-sm pq-muted font-medium text-center sm:text-left">
        Showing <span className="font-extrabold" style={{ color: "var(--pq-ink)" }}>{first}–{last}</span> of{" "}
        <span className="font-extrabold" style={{ color: "var(--pq-ink)" }}>{totalItems}</span> {itemLabel}
      </p>

      <div className="flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(current - 1)}
          disabled={atStart}
          className="pq-btn-secondary px-3"
          aria-label="Previous page"
        >
          <ChevronLeft className="w-4 h-4" aria-hidden="true" />
          <span className="hidden sm:inline">Previous</span>
        </button>
        <span className="text-sm font-bold px-2 min-w-[6.5rem] text-center" aria-live="polite" aria-current="page">
          Page {current} of {pages}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(current + 1)}
          disabled={atEnd}
          className="pq-btn-secondary px-3"
          aria-label="Next page"
        >
          <span className="hidden sm:inline">Next</span>
          <ChevronRight className="w-4 h-4" aria-hidden="true" />
        </button>
        {children}
      </div>
    </nav>
  );
}
