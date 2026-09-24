import {
  DOCTOR_TOUR_STEPS_KEY,
  getCompletedTourSteps,
} from "../../services/firstVisitService.js";
import { findVisibleTourTarget } from "./parentTourSteps.js";

export { findVisibleTourTarget };

/**
 * Doctor clinic-admin walkthrough (driver.js).
 * Step ids are stable; bump DOCTOR_TOUR_STEPS_KEY in firstVisitService when
 * the set of ids changes in a breaking way.
 */
export const DOCTOR_TOUR_STEPS = [
  {
    id: "doctor-dashboard",
    route: "/doctor",
    exact: true,
    targets: ["doctor-dashboard"],
    title: "Your clinic dashboard",
    description:
      "See today's schedule and counts for waiting, in consult, completed, and forfeited patients. Forfeited means a late arrival lost their queue place — your secretary handles check-in and penalties on the floor.",
    disableActiveInteraction: true,
  },
  {
    id: "doctor-nav-queue",
    route: "/doctor",
    exact: true,
    targets: ["doctor-nav-queue"],
    title: "Queue is here",
    description:
      "Open Queue to run the live clinic — start the floor, watch the waiting list, and complete consultations. Next we'll show a sample queue so nothing real changes.",
    disableActiveInteraction: true,
    onNextNavigate: "/doctor/queue",
  },
  {
    id: "doctor-queue-list",
    route: "/doctor/queue",
    exact: true,
    targets: ["doctor-queue-list"],
    title: "The live queue",
    description:
      "Reservations and walk-ins share this list. Walk-ins get a Walk-in chip. This is sample data — not real patients.",
    disableActiveInteraction: true,
  },
  {
    id: "doctor-queue-start",
    route: "/doctor/queue",
    exact: true,
    targets: ["doctor-queue-start"],
    title: "Start Queue",
    description:
      "When a published schedule is ready, Start Queue opens today's floor. You can also start from the Schedules calendar. This walkthrough will not start a real queue.",
    disableActiveInteraction: true,
  },
  {
    id: "doctor-queue-control",
    route: "/doctor/queue",
    exact: true,
    targets: ["doctor-queue-control"],
    title: "Pause, resume, close, or end",
    description:
      "Pause holds the floor, Resume continues, Close stops new reservations, and End Clinic Session finishes the day when remaining consultations are done. Your secretary can use the same controls. None of these run during the tour.",
    disableActiveInteraction: true,
  },
  {
    id: "doctor-consult-regular",
    route: "/doctor/queue",
    exact: true,
    targets: ["doctor-consult-regular"],
    title: "Complete a reserved visit",
    description:
      "When you finish a reserved consultation, you can add optional notes for the parent. Complete Session stays off here — walkthrough only.",
    disableActiveInteraction: true,
  },
  {
    id: "doctor-consult-walkin",
    route: "/doctor/queue",
    exact: true,
    targets: ["doctor-consult-walkin"],
    title: "Walk-in notes stay off",
    description:
      "Walk-in consultations cannot store doctor notes. The notes field stays disabled so desk arrivals stay separate from reserved records.",
    disableActiveInteraction: true,
    onNextNavigate: "/doctor/schedules",
  },
  {
    id: "doctor-schedule-publish",
    route: "/doctor/schedules",
    exact: true,
    targets: ["doctor-schedule-publish"],
    title: "Schedule calendar",
    description:
      "Open an open weekday to post it for parents. Pick a branch first, or use Publish range or Copy previous week. This sample calendar does not post a real day.",
    disableActiveInteraction: true,
  },
  {
    id: "doctor-schedule-form",
    route: "/doctor/schedules",
    exact: true,
    targets: ["doctor-schedule-form"],
    title: "Post a day",
    description:
      "Choose how many slots. Clinic hours come from that branch’s weekday hours — you do not set opening or closing time here. Post day stays off during the tour.",
    disableActiveInteraction: true,
    onNextNavigate: "/doctor/users",
  },
  {
    id: "doctor-users-list",
    route: "/doctor/users",
    exact: true,
    targets: ["doctor-users-list"],
    title: "User management",
    description:
      "Search and filter staff and parent accounts. Use Add Staff to create a secretary. This list is a tour preview when real data is empty.",
    disableActiveInteraction: true,
  },
  {
    id: "doctor-users-secretary",
    route: "/doctor/users",
    exact: true,
    targets: ["doctor-users-secretary"],
    title: "Secretary accounts",
    description:
      "You can create, edit, deactivate, or delete a secretary. Resetting their password is immediate — a temporary password is shown here, and no email is sent.",
    disableActiveInteraction: true,
  },
  {
    id: "doctor-users-parent",
    route: "/doctor/users",
    exact: true,
    targets: ["doctor-users-parent"],
    title: "Parent accounts are view-only",
    description:
      "You cannot edit a parent's profile. You can only deactivate, reactivate, delete, or send a password reset email. Resetting a parent password always sends email — it is never a temporary password on screen.",
    disableActiveInteraction: true,
    onNextNavigate: "/doctor/audit-logs",
  },
  {
    id: "doctor-audit-filters",
    route: "/doctor/audit-logs",
    exact: true,
    targets: ["doctor-audit-filters"],
    title: "Audit Logs",
    description:
      "Filter clinic activity by search, category, and role (Doctor, Secretary, or System). There is no Admin filter — clinic admin actions appear under Doctor.",
    disableActiveInteraction: true,
  },
  {
    id: "doctor-audit-suspicious",
    route: "/doctor/audit-logs",
    exact: true,
    targets: ["doctor-audit-suspicious"],
    title: "Suspicious account flags",
    description:
      "The system only flags and recommends. It never deactivates anyone automatically. Review the Evidence and Recommendation, then choose Deactivate Account or Dismiss / Mark as Reviewed. Those buttons stay off during the tour.",
    disableActiveInteraction: true,
  },
  {
    id: "doctor-notifications",
    route: "/doctor/audit-logs",
    exact: true,
    targets: ["doctor-notifications"],
    title: "Suspicious account alerts",
    description:
      "When an account is flagged, you get a web push notification (after you allow them) and an in-app toast. Tapping the push opens this Audit Logs entry. The tour will not ask for notification permission.",
    disableActiveInteraction: true,
    onNextNavigate: "/doctor/reports",
  },
  {
    id: "doctor-reports-filters",
    route: "/doctor/reports",
    exact: true,
    targets: ["doctor-reports-filters"],
    title: "Reports & Analytics",
    description:
      "Filter by branch and range — Today, This Week, This Month, or This Year. Cards and charts below are sample numbers when real data is empty.",
    disableActiveInteraction: true,
  },
  {
    id: "doctor-reports-history",
    route: "/doctor/reports",
    exact: true,
    targets: ["doctor-reports-history"],
    title: "Session history",
    description:
      "Completed clinic sessions land here, including checked-up and forfeited counts. This row is sample data only.",
    disableActiveInteraction: true,
    onNextNavigate: "/doctor/profile",
  },
  {
    id: "doctor-profile",
    route: "/doctor/profile",
    exact: true,
    targets: ["doctor-profile-account", "profile-replay"],
    title: "Account settings and help",
    description:
      "Update your name, contact, clinic details, and password here. Replay Tutorial starts this walkthrough again anytime. On a phone, Users, Branches, Audit Logs, and Reports are also linked from this Profile hub.",
    disableActiveInteraction: true,
  },
];

function normalizePath(pathname) {
  if (!pathname) return "/";
  if (pathname.length > 1 && pathname.endsWith("/")) return pathname.slice(0, -1);
  return pathname;
}

export function pathMatchesDoctorStep(pathname, step) {
  const path = normalizePath(pathname);
  if (step.exact) return path === step.route;
  return path === step.route || path.startsWith(`${step.route}/`);
}

export function getRemainingDoctorStepsForPath(pathname) {
  const completed = getCompletedTourSteps(DOCTOR_TOUR_STEPS_KEY);
  return DOCTOR_TOUR_STEPS.filter(
    (step) => pathMatchesDoctorStep(pathname, step) && !completed.includes(step.id)
  );
}

export function areAllDoctorTourStepsComplete() {
  const completed = getCompletedTourSteps(DOCTOR_TOUR_STEPS_KEY);
  return DOCTOR_TOUR_STEPS.every((step) => completed.includes(step.id));
}

export function shouldRunDoctorTour(user, role, pathname, replayRole) {
  if (role !== "doctor" || !user) return false;
  const path = normalizePath(pathname);
  const onDoctor = path === "/doctor" || path.startsWith("/doctor/");
  if (!onDoctor) return false;
  if (replayRole === "doctor") return true;
  return user.hasCompletedTour === false;
}

/** Prefer the real target; fall back so the popover still appears on empty or slow loads. */
export function resolveDoctorTourElement(step) {
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
