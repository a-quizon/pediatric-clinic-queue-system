import {
  PARENT_TOUR_STEPS_KEY,
  getCompletedTourSteps,
} from "../../services/firstVisitService.js";

export const TOUR_STEPS = [
  {
    id: "parent-queue-monitor",
    route: "/parent",
    exact: true,
    targets: ["parent-queue-monitor"],
    title: "Your live queue",
    description:
      "After you reserve a queue slot, Home shows your queue number, how many patients are ahead, and who is with the doctor. This is sample data so you can see the layout — it is not a real reservation.",
    disableActiveInteraction: true,
  },
  {
    id: "parent-book",
    route: "/parent",
    exact: true,
    targets: ["parent-book-cta", "nav-reserve"],
    title: "Reserve a queue slot",
    description:
      "Start here to open the reservation calendar and pick a published clinic day. You may hold up to two upcoming reservations at a time, and only one per date.",
    onNextNavigate: "/parent/reserve",
  },
  {
    id: "reserve-schedule",
    route: "/parent/reserve",
    exact: true,
    targets: ["reserve-schedule-calendar", "reserve-schedule-list"],
    title: "Pick a day on the calendar",
    description:
      "Choose your clinic branch, then tap a green day with open slots. You cannot reserve two branches on the same date, but you can book different dates. This sample calendar does not create a reservation.",
    disableActiveInteraction: true,
  },
  {
    id: "reserve-form",
    route: "/parent/reserve",
    exact: true,
    targets: ["reserve-patient-form"],
    title: "Who is this visit for?",
    description:
      "After you pick a day, choose the children this visit is for and add a concern. Before confirming a real booking, you will also review that branch’s queue rules. This walkthrough will not create a reservation.",
    disableActiveInteraction: true,
    onNextNavigate: "/parent/reservations",
  },
  {
    id: "reservation-list",
    route: "/parent/reservations",
    exact: true,
    targets: ["reservation-list"],
    title: "Your tickets",
    description:
      "My Reservations holds your active tickets — branch, date, and reservation code. Open a ticket anytime to show your QR code at the clinic. You can cancel before check-in from the ticket screen.",
    disableActiveInteraction: true,
  },
  {
    id: "ticket-qr",
    route: "/parent/reservations",
    exact: true,
    targets: ["sample-qr", "ticket-qr-hint"],
    title: "Show your QR code at the clinic",
    description:
      "When you arrive, show this QR code ticket (or your reservation code) to the secretary. Scanning it confirms you are here and keeps your queue slot. The graphic below is a tour placeholder, not a real scannable ticket.",
    disableActiveInteraction: true,
  },
  {
    id: "parent-late-rules",
    route: "/parent/reservations",
    exact: true,
    targets: ["parent-late-rules"],
    title: "If you arrive late",
    description:
      "If you are next and not at the clinic yet, staff may mark you late. You may be moved back in line and given time to check in with your QR code. If that time runs out, the reservation is forfeited so another family can use the slot.",
    disableActiveInteraction: true,
  },
  {
    id: "nav-notifications",
    route: "/parent/reservations",
    exact: true,
    targets: ["nav-notifications"],
    title: "Clinic alerts",
    description:
      "Queue updates, check-in reminders, and forfeiture notices appear here so you do not have to wait in the lobby. The tour will not turn on device notifications.",
    onNextNavigate: "/parent/profile",
  },
  {
    id: "profile-account",
    route: "/parent/profile",
    exact: true,
    targets: ["profile-account"],
    title: "Your account",
    description:
      "Update your name, phone, and password here anytime. You can also replay this tutorial from Profile when you need a refresher.",
  },
  {
    id: "profile-notifications",
    route: "/parent/profile",
    exact: true,
    targets: ["profile-notifications"],
    title: "Notification settings",
    description:
      "Choose which in-app alerts and device push notifications you receive. Opening settings during the tour does not send a permission prompt.",
  },
  {
    id: "profile-children",
    route: "/parent/profile",
    exact: true,
    targets: ["profile-children"],
    title: "Child profiles",
    description:
      "Add and manage the children you book reservations for. You will pick from these profiles when you reserve a queue slot.",
  },
  {
    id: "profile-history",
    route: "/parent/profile",
    exact: true,
    targets: ["profile-history"],
    title: "Reservation history",
    description:
      "Past visits live here, including completed, cancelled, and forfeited reservations. Checking in with your QR code helps keep your visit record clear.",
    onNextNavigate: "/parent/profile/history",
  },
  {
    id: "history-notes",
    route: "/parent/profile/history",
    exact: true,
    targets: ["history-notes-filter", "reservation-history"],
    title: "Doctor’s notes",
    description:
      "Open a completed visit to read the doctor’s notes. Use With Notes to find visits that have them.",
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

/** Prefer the real target; fall back so the popover still appears on empty or slow loads. */
export function resolveParentTourElement(step) {
  if (!step) return null;
  const found = findVisibleTourTarget(step.targets);
  if (found) return found;
  if (typeof document === "undefined") return null;
  return (
    document.querySelector("main") ||
    document.getElementById("root") ||
    document.body
  );
}

export function getRemainingStepsForPath(pathname) {
  const completed = getCompletedTourSteps(PARENT_TOUR_STEPS_KEY);
  return TOUR_STEPS.filter(
    (step) => pathMatchesStep(pathname, step) && !completed.includes(step.id)
  );
}

export function areAllTourStepsComplete() {
  const completed = getCompletedTourSteps(PARENT_TOUR_STEPS_KEY);
  return TOUR_STEPS.every((step) => completed.includes(step.id));
}

export function shouldRunParentTour(user, role, pathname, replayRole) {
  if (role !== "parent" || !user) return false;
  if (user.onboardingComplete === false) return false;
  const path = normalizePath(pathname);
  const onParent = path === "/parent" || path.startsWith("/parent/");
  if (!onParent) return false;
  if (replayRole === "parent") return true;
  return user.hasCompletedTour === false;
}
