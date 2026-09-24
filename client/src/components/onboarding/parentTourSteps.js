import { getCompletedTourSteps } from "../../services/firstVisitService";

export const TOUR_STEPS = [
  {
    id: "parent-queue-monitor",
    route: "/parent",
    exact: true,
    targets: ["parent-queue-monitor"],
    title: "Live queue lives here",
    description: "After you book, Home shows your queue number, patients ahead, and who is with the doctor. This is sample data so you can see the layout — it is not a real reservation.",
    disableActiveInteraction: true,
  },
  {
    id: "parent-book",
    route: "/parent",
    exact: true,
    targets: ["parent-book-cta", "nav-reserve"],
    title: "Book a reservation",
    description: "Start here to reserve a slot on a published clinic date. You may hold up to two upcoming reservations at a time.",
    onNextNavigate: "/parent/reserve",
  },
  {
    id: "reserve-schedule",
    route: "/parent/reserve",
    exact: true,
    targets: ["reserve-schedule-list"],
    title: "Pick a clinic session",
    description: "Published sessions look like these sample cards. You cannot reserve two branches on the same date (for example Angeles Saturday and Magalang Saturday), but you can book different dates. Next we'll open the form — nothing is saved during this tour.",
    disableActiveInteraction: true,
  },
  {
    id: "reserve-form",
    route: "/parent/reserve",
    exact: true,
    targets: ["reserve-patient-form"],
    title: "Fill in the visit",
    description: "Choose the children this visit is for, then add a concern. This is a walkthrough only — the tour will not create a real reservation.",
    disableActiveInteraction: true,
    onNextNavigate: "/parent/reservations",
  },
  {
    id: "reservation-list",
    route: "/parent/reservations",
    exact: true,
    targets: ["reservation-list"],
    title: "Tickets and QR check-in",
    description: "After you book, your ticket shows branch, date, and queue number. This QR is a placeholder — the real code is what you'll show at the clinic to check in.",
    disableActiveInteraction: true,
  },
  {
    id: "nav-notifications",
    route: "/parent/reservations",
    exact: true,
    targets: ["nav-notifications"],
    title: "Clinic alerts",
    description: "Queue and clinic alerts show up here so you do not have to wait in the lobby.",
    onNextNavigate: "/parent/profile",
  },
  {
    id: "profile-account",
    route: "/parent/profile",
    exact: true,
    targets: ["profile-account"],
    title: "Your account",
    description: "Update your name, phone, and password here anytime.",
  },
  {
    id: "profile-notifications",
    route: "/parent/profile",
    exact: true,
    targets: ["profile-notifications"],
    title: "Notification settings",
    description: "Choose which in-app alerts and device push notifications you receive.",
  },
  {
    id: "profile-children",
    route: "/parent/profile",
    exact: true,
    targets: ["profile-children"],
    title: "Child profiles",
    description: "Add and manage the children you book reservations for.",
  },
  {
    id: "profile-history",
    route: "/parent/profile",
    exact: true,
    targets: ["profile-history"],
    title: "Reservation history",
    description: "Past visits live here, including completed consultations.",
    onNextNavigate: "/parent/profile/history",
  },
  {
    id: "history-notes",
    route: "/parent/profile/history",
    exact: true,
    targets: ["history-notes-filter", "reservation-history"],
    title: "Doctor's notes",
    description: "Open a completed visit to read the doctor's notes. Use With Notes to find visits that have them.",
  },
];

function normalizePath(pathname) {
  if (!pathname) return "/";
  if (pathname.length > 1 && pathname.endsWith("/")) return pathname.slice(0, -1);
  return pathname;
}

export function pathMatchesStep(pathname, step) {
  const path = normalizePath(pathname);
  if (step.exact) return path === step.route;
  return path === step.route || path.startsWith(`${step.route}/`);
}

export function isElementVisible(el) {
  if (!el || !(el instanceof Element)) return false;
  const style = window.getComputedStyle(el);
  if (style.display === "none" || style.visibility === "hidden") return false;
  return el.getClientRects().length > 0;
}

export function findVisibleTourTarget(targets) {
  const ids = Array.isArray(targets) ? targets : [targets];
  for (const id of ids) {
    const nodes = document.querySelectorAll(`[data-tour="${id}"]`);
    for (const node of nodes) {
      if (isElementVisible(node)) return node;
    }
  }
  return null;
}

export function getRemainingStepsForPath(pathname) {
  const completed = getCompletedTourSteps();
  return TOUR_STEPS.filter(
    (step) => pathMatchesStep(pathname, step) && !completed.includes(step.id)
  );
}

export function areAllTourStepsComplete() {
  const completed = getCompletedTourSteps();
  return TOUR_STEPS.every((step) => completed.includes(step.id));
}

export function shouldRunParentTour(user, role, pathname) {
  if (role !== "parent" || !user) return false;
  if (user.hasCompletedTour !== false) return false;
  if (user.onboardingComplete === false) return false;
  const path = normalizePath(pathname);
  return path === "/parent" || path.startsWith("/parent/");
}
