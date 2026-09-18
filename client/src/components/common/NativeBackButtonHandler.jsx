import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Capacitor, registerPlugin } from "@capacitor/core";
import { hasHistoryOverlay } from "../../hooks/useHistoryOverlay";
import {
  getHistoryIndex,
  getNestedFallback,
  isTabRoot,
} from "../../utils/navigationRoots";

const App = registerPlugin("App");

/**
 * Android hardware/gesture back: walk in-app history (including modal
 * entries) until a tab-level root, then exit. No-ops on web — the
 * browser already pops history, and useHistoryOverlay covers modals.
 *
 * Uses Capacitor's registerPlugin so the web bundle does not need to
 * statically import @capacitor/app (that package still belongs in
 * package.json so `cap sync` copies the native plugin).
 */
export default function NativeBackButtonHandler() {
  const location = useLocation();
  const navigate = useNavigate();
  const locationRef = useRef(location);
  const navigateRef = useRef(navigate);

  useEffect(() => {
    locationRef.current = location;
    navigateRef.current = navigate;
  }, [location, navigate]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return undefined;

    let handle;
    let cancelled = false;
    const setup = async () => {
      const listener = await App.addListener("backButton", ({ canGoBack }) => {
        if (hasHistoryOverlay()) {
          window.history.back();
          return;
        }

        const { pathname, search } = locationRef.current;
        if (!isTabRoot(pathname, search)) {
          if (canGoBack || getHistoryIndex() > 0) {
            window.history.back();
            return;
          }
          const fallback = getNestedFallback(pathname, search);
          if (fallback) {
            navigateRef.current(fallback, { replace: true });
            return;
          }
        }

        App.exitApp();
      });
      if (cancelled) {
        listener.remove();
        return;
      }
      handle = listener;
    };

    setup();
    return () => {
      cancelled = true;
      handle?.remove();
    };
  }, []);

  return null;
}
