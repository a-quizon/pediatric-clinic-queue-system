import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { PqBrand } from "../parent/pqUi";

/** Matches Tailwind `md` used by every role layout (`hidden md:flex` sidebar). */
const MD_QUERY = "(min-width: 768px)";
const CLOSE_MS = 220;

export function MobileNavToggle({ open, onToggle, controlsId }) {
  return (
    <button
      type="button"
      className="pq-icon-btn pq-mobile-nav-toggle shrink-0"
      aria-label={open ? "Close menu" : "Open menu"}
      aria-expanded={open}
      aria-controls={controlsId}
      onClick={onToggle}
    >
      <Menu className="w-6 h-6" aria-hidden="true" />
    </button>
  );
}

export default function MobileNavDrawer({
  id,
  open,
  onClose,
  label,
  children,
  footer,
}) {
  const location = useLocation();
  const panelRef = useRef(null);
  const prevPathRef = useRef(location.pathname);
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
    if (prevPathRef.current !== location.pathname) {
      prevPathRef.current = location.pathname;
      onClose();
    }
  }, [location.pathname, onClose]);

  useEffect(() => {
    const media = window.matchMedia(MD_QUERY);
    const onChange = (event) => {
      if (event.matches) {
        onClose();
        setRendered(false);
      }
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [onClose]);

  useEffect(() => {
    if (!open) return undefined;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const root = panelRef.current;
    const prevFocus = document.activeElement;

    const getFocusable = () =>
      [...(root?.querySelectorAll(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
      ) ?? [])];

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
    <div className="pq-mobile-nav-root">
      <div
        className={`pq-drawer-scrim ${open ? "pq-drawer-scrim-open" : ""}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        id={id}
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className={`pq-drawer ${open ? "pq-drawer-open" : ""}`}
      >
        <div
          className="p-4 flex items-center justify-between gap-3"
          style={{ borderBottom: "1px solid var(--pq-glass-line)" }}
        >
          <PqBrand size={32} />
          <button
            type="button"
            className="pq-icon-btn shrink-0"
            aria-label="Close menu"
            onClick={onClose}
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>
        <nav
          className="flex-1 py-4 px-3 space-y-1.5 overflow-y-auto"
          aria-label={label}
          onClick={(event) => {
            if (event.target.closest("a")) onClose();
          }}
        >
          {children}
        </nav>
        {footer ? (
          <div className="p-4" style={{ borderTop: "1px solid var(--pq-glass-line)" }}>
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
