import { useContext } from "react";
import { TourPreviewContext } from "../context/TourPreviewContext";

export function useTourPreview() {
  return useContext(TourPreviewContext);
}

/** True only while the coach-mark tour is highlighting one of the given step ids. */
export function useTourSample(stepIds) {
  const { currentStepId } = useTourPreview();
  const ids = Array.isArray(stepIds) ? stepIds : [stepIds];
  return Boolean(currentStepId && ids.includes(currentStepId));
}
