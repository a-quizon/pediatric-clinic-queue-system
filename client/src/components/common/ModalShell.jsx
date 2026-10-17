import { useEffect } from "react";
import { X } from "lucide-react";
import ModalScrim from "./ModalScrim";

const MAX_WIDTH_CLASS = {
  sm: "pq-modal--sm",
  md: "pq-modal--md",
  lg: "pq-modal--lg",
  xl: "pq-modal--xl",
};

/**
 * Shared modal layout: sticky header / scrollable body / sticky footer.
 * Height, safe-area, and fluid width come from .pq-modal CSS.
 */
export default function ModalShell({
  children,
  title,
  header,
  footer,
  onClose,
  onScrimClick,
  busy = false,
  closeOnScrim = true,
  showClose = true,
  maxWidth = "md",
  className = "",
  scrimClassName = "",
  bodyClassName = "",
  headerClassName = "",
  footerClassName = "",
  labelledBy,
  describedBy,
  role = "dialog",
}) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && !busy && onClose) {
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [busy, onClose]);

  const handleScrimClick = (e) => {
    if (e.target !== e.currentTarget) return;
    if (onScrimClick) {
      onScrimClick(e);
      return;
    }
    if (closeOnScrim && !busy && onClose) {
      onClose();
    }
  };

  const sizeClass = MAX_WIDTH_CLASS[maxWidth] || MAX_WIDTH_CLASS.md;
  const panelClasses = ["pq-modal", sizeClass, className].filter(Boolean).join(" ");

  const resolvedHeader =
    header !== undefined ? (
      header
    ) : title || (showClose && onClose) ? (
      <div className={`pq-modal-header flex items-center justify-between gap-3 px-5 py-4 sm:px-6 ${headerClassName}`.trim()} style={{ borderBottom: "1px solid var(--pq-glass-line)" }}>
        <h2 id={labelledBy} className="text-lg font-extrabold tracking-tight min-w-0 truncate pr-2">
          {title}
        </h2>
        {showClose && onClose ? (
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="pq-icon-btn shrink-0"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        ) : null}
      </div>
    ) : null;

  return (
    <ModalScrim className={scrimClassName} onClick={handleScrimClick}>
      <div
        className={panelClasses}
        role={role}
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        onClick={(e) => e.stopPropagation()}
      >
        {resolvedHeader}
        <div className={`pq-modal-body pq-scroll-y ${bodyClassName}`.trim()}>{children}</div>
        {footer ? <div className={`pq-modal-footer ${footerClassName}`.trim()}>{footer}</div> : null}
      </div>
    </ModalScrim>
  );
}
