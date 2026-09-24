import {
  DOCTOR_TOUR_STEPS_KEY,
  getCompletedTourSteps,
} from "../../services/firstVisitService";
import { findVisibleTourTarget } from "./parentTourSteps";

export { findVisibleTourTarget };

export const DOCTOR_TOUR_STEPS = [
  {
    id: "doctor-nav-queue",
    route: "/doctor",
    exact: true,
    targets: ["doctor-nav-queue"],
    title: "Queue is here",
    description:
      "This is your doctor home. Queue is where you run the live clinic — start the floor, see waiting patients, and complete consultations. Next we'll open a sample queue so you can see the layout without changing real patients.",
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
      "Reservations and walk-ins share this list. Walk-ins get a Walk-in chip so you can tell them apart. This is sample data — nothing here is a real patient.",
    disableActiveInteraction: true,
  },
  {
    id: "doctor-queue-start",
    route: "/doctor/queue",
    exact: true,
    targets: ["doctor-queue-start"],
    title: "Start Queue",
    description:
      "Start today's queue from the schedule calendar: open today's date and choose Start Queue. That opens this floor. This walkthrough will not start a real queue.",
    disableActiveInteraction: true,
  },
  {
    id: "doctor-queue-control",
    route: "/doctor/queue",
    exact: true,
    targets: ["doctor-queue-control"],
    title: "Pause, resume, close, or end",
    description:
      "Pause holds the floor, Resume continues, Close stops new reservations, and End Clinic Session finishes the day after remaining consultations are done. Your secretary can run these same controls if you are busy. None of these buttons run during the tour.",
    disableActiveInteraction: true,
  },
  {
    id: "doctor-consult-regular",
    route: "/doctor/queue",
    exact: true,
    targets: ["doctor-consult-regular"],
    title: "Complete a reserved visit",
    description:
      "When you finish a reserved consultation, notes stay available so you can record follow-up for the parent. Complete Session is disabled here — this is a walkthrough only.",
    disableActiveInteraction: true,
  },
  {
    id: "doctor-consult-walkin",
    route: "/doctor/queue",
    exact: true,
    targets: ["doctor-consult-walkin"],
    title: "Walk-in notes stay off",
    description:
      "Walk-in consultations cannot store doctor notes. The notes field is disabled so desk arrivals stay separate from reserved records. Next we'll look at publishing a schedule.",
    disableActiveInteraction: true,
    onNextNavigate: "/doctor/schedules",
  },
  {
    id: "doctor-schedule-publish",
    route: "/doctor/schedules",
    exact: true,
    targets: ["doctor-schedule-publish"],
    title: "Publish a schedule",
    description:
      "Draft sessions stay hidden until you publish. After publish, parents can reserve slots. This sample card will not go live.",
    disableActiveInteraction: true,
  },
  {
    id: "doctor-schedule-form",
    route: "/doctor/schedules",
    exact: true,
    targets: ["doctor-schedule-form"],
    title: "Create a session",
    description:
      "Set branch, date, hours, and slot capacity. Nothing is saved during the tour — Publish and Save stay off.",
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
      "Filter by branch and range — Today, This Week, This Month, or This Year. The cards and charts below are sample numbers so you can see the layout even when real data is empty.",
    disableActiveInteraction: true,
  },
  {
    id: "doctor-reports-history",
    route: "/doctor/reports",
    exact: true,
    targets: ["doctor-reports-history"],
    title: "Doctor's Report",
    description:
      "Session History is your doctor's report. Completed clinic sessions land here, including checked-up counts from the consultations you record. This row is sample data only.",
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
