import {
  SECRETARY_TOUR_STEPS_KEY,
  getCompletedTourSteps,
} from "../../services/firstVisitService";
import { findVisibleTourTarget } from "./parentTourSteps";

export { findVisibleTourTarget };

export const SECRETARY_TOUR_STEPS = [
  {
    id: "nav-queue",
    route: "/secretary",
    exact: true,
    targets: ["nav-queue"],
    title: "Manage Queue is here",
    description:
      "This is your secretary home. Use Manage Queue to run the live floor — check-ins, penalties, and session controls. Next we'll open a sample queue so you can see the layout without changing real patients.",
    disableActiveInteraction: true,
    onNextNavigate: "/secretary/queue",
  },
  {
    id: "queue-list",
    route: "/secretary/queue",
    exact: true,
    targets: ["queue-list"],
    title: "The waiting list",
    description:
      "Reservations and walk-ins share this list. Walk-ins get a Walk-in chip so you can tell them apart. This is sample data — nothing here is a real patient.",
    disableActiveInteraction: true,
  },
  {
    id: "queue-penalize",
    route: "/secretary/queue",
    exact: true,
    targets: ["queue-penalize"],
    title: "Penalize a no-show",
    description:
      "Penalize moves the next waiting patient back in line and starts a forfeit countdown. The chip shows how long they have to check in. This walkthrough will not apply a real penalty.",
    disableActiveInteraction: true,
  },
  {
    id: "queue-control",
    route: "/secretary/queue",
    exact: true,
    targets: ["queue-control", "queue-session-controls"],
    title: "Pause, close, or end",
    description:
      "Pause holds the floor, Close stops new reservations, and End Clinic Session finishes the day after the queue is empty. None of these buttons run during the tour.",
    disableActiveInteraction: true,
    onNextNavigate: "/secretary/profile",
  },
  {
    id: "walkin-open",
    route: "/secretary/profile",
    exact: true,
    targets: ["walkin-open"],
    title: "Walk-in Patient",
    description:
      "Desk arrivals without a reservation start here. Next we'll open a filled-in sample form — it will not check anyone in.",
    disableActiveInteraction: true,
  },
  {
    id: "walkin-form",
    route: "/secretary/profile",
    exact: true,
    targets: ["walkin-form"],
    title: "Fill in the walk-in",
    description:
      "Pick the schedule, how many children, then name, age, and sex, plus an optional concern. This is a walkthrough only — Check In Walk-in is disabled.",
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
      "Parents show their ticket QR or give you the 6-character code. Scanning a real code checks them in. This preview is a placeholder — the camera stays off and nothing is validated.",
    disableActiveInteraction: true,
    onNextNavigate: "/secretary/schedules",
  },
  {
    id: "schedule-publish",
    route: "/secretary/schedules",
    exact: true,
    targets: ["schedule-publish"],
    title: "Publish a schedule",
    description:
      "Draft sessions stay hidden until you publish. After publish, parents can reserve slots. This sample card will not go live.",
    disableActiveInteraction: true,
  },
  {
    id: "schedule-form",
    route: "/secretary/schedules",
    exact: true,
    targets: ["schedule-form"],
    title: "Create a session",
    description:
      "Set branch, date, hours, and slot capacity. Your branch is locked on this account. Nothing is saved during the tour.",
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
      "Penalty Move-Back is how many places a no-show is sent. The Penalty Timer is the countdown after Penalize before they forfeit. These apply only to your assigned branch. Save is blocked during the tour.",
    disableActiveInteraction: true,
  },
  {
    id: "settings-sms",
    route: "/secretary/settings",
    exact: true,
    targets: ["settings-sms"],
    title: "SMS notifications",
    description:
      "Near-turn timing and message templates for parents at this branch. Editing these during the tour will not send SMS or save changes.",
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
  if (replayRole === "secretary") return true;
  return user.hasCompletedTour === false;
}
