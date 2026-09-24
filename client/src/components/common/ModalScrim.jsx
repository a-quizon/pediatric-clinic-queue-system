import { useEffect } from "react";
import { createPortal } from "react-dom";

let scrollLockCount = 0;
let previousBodyOverflow = "";

function lockBodyScroll() {
  if (typeof document === "undefined") return;
  if (scrollLockCount === 0) {
    previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }
  scrollLockCount += 1;
}

function unlockBodyScroll() {
  if (typeof document === "undefined") return;
  scrollLockCount = Math.max(0, scrollLockCount - 1);
  if (scrollLockCount === 0) {
    document.body.style.overflow = previousBodyOverflow;
  }
}

function getModalRoot() {
  if (typeof document === "undefined") return null;
  // Mount under .pq-shell so design tokens inherit, but outside any
  // .pq-glass ancestor whose backdrop-filter traps position:fixed.
  return document.querySelector(".pq-shell") || document.body;
}

/**
 * Full-viewport modal backdrop. Always portals out of nested glass panes
 * so the scrim covers the screen and the panel stays opaque.
 */
export default function ModalScrim({ children, className = "", onClick, style, ...rest }) {
  useEffect(() => {
    lockBodyScroll();
    return () => unlockBodyScroll();
  }, []);

  const root = getModalRoot();
  if (!root) return null;

  const classes = className ? `pq-modal-scrim ${className}` : "pq-modal-scrim";

  return createPortal(
    <div className={classes} onClick={onClick} style={style} {...rest}>
      {children}
    </div>,
    root
  );
}
