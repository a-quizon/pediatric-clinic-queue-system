/**
 * Tab-level "root" screens per role. Device back on these exits the app
 * (Capacitor) or leaves the site (mobile browser) instead of walking
 * through previous tab switches.
 */
const TAB_ROOTS = new Set([
  "/",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/parent",
  "/parent/reserve",
  "/parent/reservations",
  "/parent/profile",
  "/secretary",
  "/secretary/schedules",
  "/secretary/validate",
  "/secretary/queue",
  "/secretary/profile",
  "/doctor",
  "/doctor/queue",
  "/doctor/schedules",
  "/doctor/profile",
  "/doctor/users",
  "/doctor/branches",
  "/doctor/audit-logs",
]);

export function normalizePathname(pathname) {
  if (!pathname || pathname === "/") return "/";
  return pathname.replace(/\/+$/, "") || "/";
}

export function isTabRoot(pathname, search = "") {
  const path = normalizePathname(pathname);
  if (path === "/doctor/profile") {
    const view = new URLSearchParams(search).get("view");
    if (view && view !== "hub") return false;
  }
  return TAB_ROOTS.has(path);
}

/** Parent of a nested screen, used when history is empty (direct open / refresh). */
export function getNestedFallback(pathname, search = "") {
  const path = normalizePathname(pathname);
  const params = new URLSearchParams(search);

  if (path === "/doctor/profile" && params.get("view")) return "/doctor/profile";
  if (path === "/parent/notifications") return "/parent";
  if (path.startsWith("/parent/profile/")) return "/parent/profile";
  if (/^\/parent\/reservations\/.+/.test(path)) return "/parent/reservations";
  if (path === "/secretary/settings") return "/secretary/profile";
  if (path === "/secretary/monitor") return "/secretary/queue";
  if (path === "/doctor/reports") return "/doctor";
  if (path === "/doctor/audit-logs") return "/doctor";
  if (path === "/doctor/users" || path === "/doctor/branches") return "/doctor";
  if (path === "/onboarding/child") return "/parent";
  return null;
}

export function getHistoryIndex() {
  const idx = window.history.state?.idx;
  return typeof idx === "number" ? idx : 0;
}

export function goBackOr(navigate, fallbackPath) {
  if (getHistoryIndex() > 0) {
    navigate(-1);
    return;
  }
  if (fallbackPath) {
    navigate(fallbackPath, { replace: true });
  }
}
