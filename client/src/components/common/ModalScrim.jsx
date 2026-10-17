import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

let scrollLockCount = 0;
let previousBodyOverflow = "";
let previousHtmlOverflow = "";

function lockBodyScroll() {
  if (typeof document === "undefined") return;
  if (scrollLockCount === 0) {
    previousBodyOverflow = document.body.style.overflow;
    previousHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
  }
  scrollLockCount += 1;
}

function unlockBodyScroll() {
  if (typeof document === "undefined") return;
  scrollLockCount = Math.max(0, scrollLockCount - 1);
  if (scrollLockCount === 0) {
    document.body.style.overflow = previousBodyOverflow;
    document.documentElement.style.overflow = previousHtmlOverflow;
  }
}

function getModalRoot() {
  if (typeof document === "undefined") return null;
  // Mount under .pq-shell so design tokens inherit, but outside any
  // .pq-glass ancestor whose backdrop-filter traps position:fixed.
  return document.querySelector(".pq-shell") || document.body;
}

function syncVisualViewportHeight(target) {
  if (typeof window === "undefined" || !target) return;
  const vv = window.visualViewport;
  const height = vv?.height ?? window.innerHeight;
  target.style.setProperty("--pq-vv-height", `${height}px`);
  if (typeof document !== "undefined") {
    document.documentElement.style.setProperty("--pq-vv-height", `${height}px`);
  }
}

/**
 * Full-viewport modal backdrop. Always portals out of nested glass panes
 * so the scrim covers the screen and the panel stays opaque.
 * Tracks visualViewport so modal max-height shrinks with the on-screen keyboard.
 */
export default function ModalScrim({ children, className = "", onClick, style, ...rest }) {
  const scrimRef = useRef(null);

  useEffect(() => {
    lockBodyScroll();
    return () => unlockBodyScroll();
  }, []);

  useEffect(() => {
    const el = scrimRef.current;
    const update = () => syncVisualViewportHeight(el);
    update();

    const vv = typeof window !== "undefined" ? window.visualViewport : null;
    if (vv) {
      vv.addEventListener("resize", update);
      vv.addEventListener("scroll", update);
    }
    window.addEventListener("resize", update);

    return () => {
      if (vv) {
        vv.removeEventListener("resize", update);
        vv.removeEventListener("scroll", update);
      }
      window.removeEventListener("resize", update);
    };
  }, []);

  const root = getModalRoot();
  if (!root) return null;

  const classes = className ? `pq-modal-scrim ${className}` : "pq-modal-scrim";

  return createPortal(
    <div ref={scrimRef} className={classes} onClick={onClick} style={style} {...rest}>
      {children}
    </div>,
    root
  );
}
