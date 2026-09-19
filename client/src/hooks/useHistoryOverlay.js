import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { auth } from "../firebase/auth";

/**
 * Syncs an overlay/modal to the router history stack so device/browser
 * back closes the topmost overlay instead of leaving the app.
 *
 * Uses a module-level stack so nested modals (detail → confirm) unwind
 * one at a time, and so UI close (X / Cancel) pops the extra entry
 * without also closing the overlay underneath.
 */
const overlayStack = [];
let ignorePopCount = 0;
let listening = false;

function onPopState() {
  if (ignorePopCount > 0) {
    ignorePopCount -= 1;
    return;
  }
  const top = overlayStack.pop();
  top?.close();
}

function ensureListener() {
  if (listening) return;
  listening = true;
  window.addEventListener("popstate", onPopState);
}

export function hasHistoryOverlay() {
  return overlayStack.length > 0;
}

export function useHistoryOverlay(isOpen, onClose) {
  const navigate = useNavigate();
  const location = useLocation();
  const onCloseRef = useRef(onClose);
  const locationRef = useRef(location);
  const navigateRef = useRef(navigate);

  useEffect(() => {
    onCloseRef.current = onClose;
    locationRef.current = location;
    navigateRef.current = navigate;
  }, [onClose, location, navigate]);

  useEffect(() => {
    if (!isOpen) return undefined;

    ensureListener();
    const entry = {
      close: () => {
        onCloseRef.current?.();
      },
    };
    overlayStack.push(entry);

    const loc = locationRef.current;
    const openedAt = {
      pathname: loc.pathname,
      search: loc.search,
      hash: loc.hash,
    };
    navigateRef.current(
      { pathname: openedAt.pathname, search: openedAt.search, hash: openedAt.hash },
      {
        state: { ...(loc.state || {}), pqOverlay: overlayStack.length },
        preventScrollReset: true,
      }
    );

    return () => {
      const index = overlayStack.indexOf(entry);
      if (index === -1) return;
      overlayStack.splice(index, 1);
      // Use the live URL: the overlay host can unmount on a route change
      // before React Router updates this component's location.
      const stillOnOpenedRoute =
        window.location.pathname === openedAt.pathname &&
        window.location.search === openedAt.search &&
        window.location.hash === openedAt.hash;
      if (!stillOnOpenedRoute) return;
      // Auth is already gone (logout / session drop): do not POP against
      // ProtectedRoute's blank <Navigate to="/" />.
      if (!auth.currentUser) return;
      try {
        ignorePopCount += 1;
        navigateRef.current(-1);
      } catch {
        ignorePopCount = Math.max(0, ignorePopCount - 1);
      }
    };
  }, [isOpen]);
}
