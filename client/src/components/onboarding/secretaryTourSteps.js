import {
  SECRETARY_TOUR_STEPS_KEY,
  getCompletedTourSteps,
} from "../../services/firstVisitService.js";
import { findVisibleTourTarget } from "./parentTourSteps.js";

export { findVisibleTourTarget };

/**
 * Secretary floor walkthrough (driver.js).
 * Step ids are stable; bump SECRETARY_TOUR_STEPS_KEY in firstVisitService when
 * the set of ids changes in a breaking way.
 */
export const SECRETARY_TOUR_STEPS = [
  {
    id: "dashboard-overview",
    route: "/secretary",
    exact: true,
    targets: ["dashboard-overview"],
    title: "Your branch at a glance",
    description:
      "The Dashboard shows today's published schedule, who is with the doctor, and quick counts for waiting, checked-in, and completed patients. Nothing here changes the live queue.",
    disableActiveInteraction: true,
  },
  {
    id: "nav-queue",
    route: "/secretary",
    exact: true,
    targets: ["nav-queue"],
    title: "Manage Queue is here",
    description:
      "Use Manage Queue to run the live floor — start the session, check-ins, penalties, walk-ins, and Send to Doctor. Next we'll open a sample queue so you can see the layout without changing real patients.",
    disableActiveInteraction: true,
    onNextNavigate: "/secretary/queue",
  },
  {
    id: "queue-start",
    route: "/secretary/queue",
    exact: true,
    targets: ["queue-start"],
    title: "Start today's queue",
    description:
      "When a published schedule is ready, Start Queue opens the floor for your assigned branch. This walkthrough will not start a real session.",
    disableActiveInteraction: true,
  },
  {
    id: "queue-list",
    route: "/secretary/queue",
    exact: true,
    targets: ["queue-list"],
    title: "The waiting list",
    description:
      "Reservations and walk-ins share this list. Status chips show Checked In or Not Checked In; walk-ins get a Walk-in chip. Forfeit countdowns appear after a penalty. This is sample data — nothing here is a real patient.",
    disableActiveInteraction: true,
  },
  {
    id: "queue-control",
    route: "/secretary/queue",
    exact: true,
    targets: ["queue-control", "queue-session-controls"],
    title: "Pause, close, or end",
    description:
      "Pause holds the floor, Close stops new reservations, and End Clinic Session finishes the day after the queue is empty. Live Queue Monitor (top of this page) opens a waiting-room display in a new tab. None of these run during the tour.",
    disableActiveInteraction: true,
  },
  {
    id: "queue-request-checkin",
    route: "/secretary/queue",
    exact: true,
    targets: ["queue-request-checkin"],
    title: "Request Check-In",
    description:
      "Send a reminder to the next patient who still needs to arrive for QR validation. The tour will not send a real reminder.",
    disableActiveInteraction: true,
  },
  {
    id: "queue-penalize",
    route: "/secretary/queue",
    exact: true,
    targets: ["queue-penalize"],
    title: "Penalize a no-show",
    description:
      "After the grace period, Penalize moves the next waiting patient back in line and starts a forfeit countdown. Setting Penalty Move-Back to 0 in System Configuration forfeits immediately. This walkthrough will not apply a real penalty.",
    disableActiveInteraction: true,
  },
  {
    id: "queue-send-to-doctor",
    route: "/secretary/queue",
    exact: true,
    targets: ["queue-send-to-doctor"],
    title: "Send to Doctor",
    description:
      "When the consultation room is free, Send to Doctor lets the next checked-in patient in. Only one consultation can be open at a time. This button stays off during the tour.",
    disableActiveInteraction: true,
  },
  {
    id: "walkin-open",
    route: "/secretary/queue",
    exact: true,
    targets: ["walkin-open"],
    title: "Add a walk-in",
    description:
      "Desk arrivals without a reservation start here while the queue is active or paused. Next we'll open a filled-in sample form — it will not check anyone in.",
    disableActiveInteraction: true,
  },
  {
    id: "walkin-form",
    route: "/secretary/queue",
    exact: true,
    targets: ["walkin-form"],
    title: "Fill in the walk-in",
    description:
      "Enter the child's name, age, sex, and visit concern. Optional phone-in details and extra children stay collapsed. This is a walkthrough only — Check In Walk-in is disabled.",
    disableActiveInteraction: true,
    onNextNavigate: "/secretary/validate",
  },
  {
    id: "validate-qr",
    route: "/secretary/validate",
    exact: true,
    targets: ["validate-qr"],
    title: "QR check-in",
    description:
      "Parents show their QR code ticket or give you the 6-character code. Scanning a real code checks them in. This preview is a placeholder — the camera stays off and nothing is validated.",
    disableActiveInteraction: true,
    onNextNavigate: "/secretary/schedules",
  },
  {
    id: "schedule-publish",
    route: "/secretary/schedules",
    exact: true,
    targets: ["schedule-publish"],
    title: "Schedule calendar",
    description:
      "Open an open weekday to post it for parents at your assigned branch. You can also use Publish range or Copy previous week. This sample calendar does not post a real day.",
    disableActiveInteraction: true,
  },
  {
    id: "schedule-form",
    route: "/secretary/schedules",
    exact: true,
    targets: ["schedule-form"],
    title: "Post a day",
    description:
      "Choose how many slots. Clinic hours come from your branch’s weekday hours — you do not set opening or closing time here. Post day stays off during the tour.",
    disableActiveInteraction: true,
    onNextNavigate: "/secretary/profile",
  },
  {
    id: "profile-help",
    route: "/secretary/profile",
    exact: true,
    targets: ["profile-system-config", "profile-replay"],
    title: "Profile, settings, and help",
    description:
      "System Configuration holds penalty and SMS rules for your branch. Replay Tutorial starts this walkthrough again anytime. Next we'll open the settings screens — Save stays blocked in the tour.",
    disableActiveInteraction: true,
    onNextNavigate: "/secretary/settings",
  },
  {
    id: "settings-queue-rules",
    route: "/secretary/settings",
    exact: true,
    targets: ["settings-queue-rules"],
    title: "Penalty rules",
    description:
      "Penalty Move-Back is how many places a no-show is sent. Penalty Grace is the wait before Penalize unlocks. The Penalty Timer is the countdown after Penalize before they forfeit. These apply only to your assigned branch.",
    disableActiveInteraction: true,
  },
  {
    id: "settings-sms",
    route: "/secretary/settings",
    exact: true,
    targets: ["settings-sms"],
    title: "SMS notifications",
    description:
      "Near-turn timing and message templates for parents at this branch. Editing these during the tour will not send SMS or save changes. You can replay this tour anytime from Profile.",
    disableActiveInteraction: true,
  },
];

function normalizePath(pathname) {
  if (!pathname) return "/";
  if (pathname.length > 1 && pathname.endsWith("/")) return pathname.slice(0, -1);
  return pathname;
}

export function pathMatchesSecretaryStep(pathname, step) {
  const path = normalizePath(pathname);
  if (step.exact) return path === step.route;
  return path === step.route || path.startsWith(`${step.route}/`);
}

export function getRemainingSecretaryStepsForPath(pathname) {
  const completed = getCompletedTourSteps(SECRETARY_TOUR_STEPS_KEY);
  return SECRETARY_TOUR_STEPS.filter(
    (step) => pathMatchesSecretaryStep(pathname, step) && !completed.includes(step.id)
  );
}

export function areAllSecretaryTourStepsComplete() {
  const completed = getCompletedTourSteps(SECRETARY_TOUR_STEPS_KEY);
  return SECRETARY_TOUR_STEPS.every((step) => completed.includes(step.id));
}

export function shouldRunSecretaryTour(user, role, pathname, replayRole) {
  if (role !== "secretary" || !user) return false;
  const path = normalizePath(pathname);
  const onSecretary = path === "/secretary" || path.startsWith("/secretary/");
  if (!onSecretary) return false;
  // Forced password change must finish before any coach marks.
  if (path === "/secretary/change-password") return false;
  if (replayRole === "secretary") return true;
  return user.hasCompletedTour === false;
}

/** Resolve a step target, or a safe fallback so the popover still appears. */
export function resolveSecretaryTourElement(step) {
  if (!step) return null;
  const found = findVisibleTourTarget(step.targets);
  if (found) return found;
  return (
    document.querySelector("main") ||
    document.getElementById("root") ||
    document.body
  );
}
