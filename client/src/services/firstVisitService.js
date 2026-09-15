import { ref, update } from "firebase/database";
import { database } from "../firebase/database";

const TOUR_STEPS_KEY = "pq.parentTour.v1.completedSteps";

function readSession(key) {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeSession(key, value) {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    // Private mode should not break the tour.
  }
}

function removeSession(key) {
  try {
    sessionStorage.removeItem(key);
  } catch {
    // ignore
  }
}

export async function persistParentTourComplete(uid) {
  if (!uid) return;
  await update(ref(database, `users/${uid}`), {
    hasCompletedTour: true,
    updatedAt: Date.now(),
  });
}

export function getCompletedTourSteps() {
  try {
    const raw = readSession(TOUR_STEPS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function markTourStepComplete(stepId) {
  if (!stepId) return getCompletedTourSteps();
  const steps = getCompletedTourSteps();
  if (steps.includes(stepId)) return steps;
  const next = [...steps, stepId];
  writeSession(TOUR_STEPS_KEY, JSON.stringify(next));
  return next;
}

export function clearTourStepProgress() {
  removeSession(TOUR_STEPS_KEY);
}
