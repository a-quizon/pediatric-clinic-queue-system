import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import ReservationsByDate from "./ReservationsByDate";

const CLOSE_MS = 220;

/**
 * Desktop right slide-over for session reservation history.
 * Mirrors MobileNavDrawer interaction (scrim, Esc, focus, body lock)
 * without using useHistoryOverlay — URL ?session= owns history.
 */
export default function SessionReservationsDrawer({
  open,
  onClose,
  scheduleId,
  title,
  subtitle,
}) {
  const panelRef = useRef(null);
  const [rendered, setRendered] = useState(open);

  if (open && !rendered) {
    setRendered(true);
  }

  useEffect(() => {
    if (open || !rendered) return undefined;
    const timer = window.setTimeout(() => setRendered(false), CLOSE_MS);
    return () => window.clearTimeout(timer);
  }, [open, rendered]);

  useEffect(() => {
    if (!open) return undefined;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const root = panelRef.current;
    const prevFocus = document.activeElement;

    const getFocusable = () =>
      [
        ...(root?.querySelectorAll(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
        ) ?? []),
      ];

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !root) return;
      const list = getFocusable();
      if (list.length === 0) return;
      const first = list[0];
      const last = list[list.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    requestAnimationFrame(() => getFocusable()[0]?.focus());

    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKeyDown);
      if (prevFocus && typeof prevFocus.focus === "function") prevFocus.focus();
    };
  }, [open, onClose]);

  if (!rendered) return null;

  return (
    <div className="pq-session-drawer-root">
      <div
        className={`pq-drawer-scrim ${open ? "pq-drawer-scrim-open" : ""}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`pq-drawer-end ${open ? "pq-drawer-open" : ""}`}
      >
        <div
          className="p-4 flex items-start justify-between gap-3 shrink-0"
          style={{ borderBottom: "1px solid var(--pq-glass-line)" }}
        >
          <div className="min-w-0">
            <h2 className="text-lg font-extrabold tracking-tight leading-snug">
              {title}
            </h2>
            {subtitle ? (
              <p className="text-xs pq-muted font-medium mt-0.5">{subtitle}</p>
            ) : null}
          </div>
          <button
            type="button"
            className="pq-icon-btn shrink-0"
            aria-label="Close"
            onClick={onClose}
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>
        {scheduleId ? <ReservationsByDate scheduleId={scheduleId} /> : null}
      </div>
    </div>
  );
}
