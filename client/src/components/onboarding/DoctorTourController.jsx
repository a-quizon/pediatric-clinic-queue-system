import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { useTourPreview } from "../../hooks/useTourPreview";
import {
  DOCTOR_TOUR_STEPS_KEY,
  clearTourStepProgress,
  getCompletedTourSteps,
  markTourStepComplete,
  persistTourComplete,
} from "../../services/firstVisitService";
import {
  DOCTOR_TOUR_STEPS,
  areAllDoctorTourStepsComplete,
  getRemainingDoctorStepsForPath,
  pathMatchesDoctorStep,
  resolveDoctorTourElement,
  shouldRunDoctorTour,
} from "./doctorTourSteps";
import {
  bindTourViewport,
  decorateTourPopover,
  getTourDriverChrome,
  mapTourDriverSteps,
  scrollTourTargetIntoView,
  clampActiveTourPopover,
} from "./tourLayout";

function waitForPaint() {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  });
}

function waitForMs(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function waitForStepTarget(step, timeoutMs = 2500) {
  if (!step) return false;
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (resolveDoctorTourElement(step)) return true;
    await waitForPaint();
    await waitForMs(50);
  }
  return Boolean(resolveDoctorTourElement(step));
}

function nextGlobalStep(stepId) {
  const index = DOCTOR_TOUR_STEPS.findIndex((step) => step.id === stepId);
  return index >= 0 ? DOCTOR_TOUR_STEPS[index + 1] || null : null;
}

export default function DoctorTourController() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user, role, updateContextUser } = useAuth();
  const { setCurrentStepId, clearPreview, replayRole, clearReplay } = useTourPreview();
  const driverRef = useRef(null);
  const suppressFinishRef = useRef(false);
  const userRef = useRef(user);
  const updateContextUserRef = useRef(updateContextUser);
  const setCurrentStepIdRef = useRef(setCurrentStepId);
  const clearPreviewRef = useRef(clearPreview);
  const clearReplayRef = useRef(clearReplay);
  const navigateRef = useRef(navigate);
  const tourPending = shouldRunDoctorTour(user, role, pathname, replayRole);

  userRef.current = user;
  updateContextUserRef.current = updateContextUser;
  setCurrentStepIdRef.current = setCurrentStepId;
  clearPreviewRef.current = clearPreview;
  clearReplayRef.current = clearReplay;
  navigateRef.current = navigate;

  useEffect(() => {
    if (!tourPending) {
      if (role === "doctor") clearPreviewRef.current();
      return undefined;
    }
    const completed = getCompletedTourSteps(DOCTOR_TOUR_STEPS_KEY);
    const firstStep = DOCTOR_TOUR_STEPS[0];
    if (
      replayRole === "doctor" &&
      completed.length === 0 &&
      firstStep &&
      !pathMatchesDoctorStep(pathname, firstStep)
    ) {
      navigateRef.current(firstStep.route);
      return undefined;
    }
    const remaining = getRemainingDoctorStepsForPath(pathname);
    if (remaining[0]) setCurrentStepIdRef.current(remaining[0].id);
    return undefined;
  }, [pathname, tourPending, role, replayRole]);

  useEffect(() => {
    if (!tourPending) return undefined;

    let cancelled = false;
    let starting = false;
    let observer;

    const finishTour = () => {
      const uid = userRef.current?.uid;
      clearPreviewRef.current();
      clearReplayRef.current();
      clearTourStepProgress(DOCTOR_TOUR_STEPS_KEY);
      updateContextUserRef.current({ hasCompletedTour: true });
      if (uid) {
        persistTourComplete(uid).catch(console.error);
      }
    };

    const destroyProgrammatically = () => {
      suppressFinishRef.current = true;
      try {
        driverRef.current?.destroy();
      } catch {
        // Overlay DOM may already be gone during logout unmount.
      }
      driverRef.current = null;
    };

    const run = async () => {
      if (cancelled || starting || driverRef.current?.isActive()) return;
      starting = true;

      try {
        const remaining = getRemainingDoctorStepsForPath(pathname);
        const completed = getCompletedTourSteps(DOCTOR_TOUR_STEPS_KEY);
        const firstStep = DOCTOR_TOUR_STEPS[0];
        if (
          replayRole === "doctor" &&
          completed.length === 0 &&
          firstStep &&
          !pathMatchesDoctorStep(pathname, firstStep)
        ) {
          return;
        }
        if (remaining.length === 0) {
          if (areAllDoctorTourStepsComplete()) {
            finishTour();
          }
          return;
        }

        setCurrentStepIdRef.current(remaining[0].id);
        const ready = await waitForStepTarget(remaining[0]);
        if (cancelled) return;
        if (!ready) return;

        const stepsToDrive = remaining;
        const lastStep = stepsToDrive[stepsToDrive.length - 1];
        const unfinished = DOCTOR_TOUR_STEPS.filter(
          (step) => !getCompletedTourSteps(DOCTOR_TOUR_STEPS_KEY).includes(step.id)
        );
        const lastUnfinished = unfinished[unfinished.length - 1];
        const doneLabel =
          lastStep && lastUnfinished?.id === lastStep.id && !lastStep.onNextNavigate
            ? "Done"
            : "Next";

        const { driver } = await import("driver.js");
        if (cancelled) return;

        let instance;
        const finishAsSkip = () => {
          finishTour();
          suppressFinishRef.current = true;
          instance?.destroy();
        };

        const chrome = getTourDriverChrome();
        instance = driver({
          steps: mapTourDriverSteps(stepsToDrive, resolveDoctorTourElement),
          animate: true,
          smoothScroll: true,
          allowClose: false,
          overlayClickBehavior: "close",
          showButtons: ["next", "previous"],
          overlayColor: "#16344a",
          overlayOpacity: 0.48,
          stagePadding: chrome.stagePadding,
          stageRadius: 16,
          popoverClass: "pq-driver-popover",
          popoverOffset: chrome.popoverOffset,
          showProgress: stepsToDrive.length > 1,
          progressText: "Step {{current}} of {{total}}",
          nextBtnText: "Next",
          prevBtnText: "Back",
          doneBtnText: doneLabel,
          disableActiveInteraction: false,
          onPopoverRender: (popover) => {
            decorateTourPopover(popover, finishAsSkip);
          },
          onHighlightStarted: (el, _step, { driver: d }) => {
            const idx = d.getActiveIndex() ?? 0;
            const current = stepsToDrive[idx];
            if (current) setCurrentStepIdRef.current(current.id);
            scrollTourTargetIntoView(el);
          },
          onNextClick: (_el, _step, { driver: d }) => {
            const idx = d.getActiveIndex() ?? 0;
            const current = stepsToDrive[idx];
            if (current) markTourStepComplete(current.id, DOCTOR_TOUR_STEPS_KEY);

            if (!d.isLastStep()) {
              const next = stepsToDrive[idx + 1];
              if (next) setCurrentStepIdRef.current(next.id);
              waitForStepTarget(next).then((found) => {
                if (cancelled) return;
                if (found) d.moveNext();
              });
              return;
            }

            if (current?.onNextNavigate) {
              const upcoming = nextGlobalStep(current.id);
              if (upcoming) setCurrentStepIdRef.current(upcoming.id);
              destroyProgrammatically();
              navigateRef.current(current.onNextNavigate);
              return;
            }

            destroyProgrammatically();
            if (areAllDoctorTourStepsComplete()) {
              finishTour();
            }
          },
          onPrevClick: (_el, _step, { driver: d }) => {
            const idx = d.getActiveIndex() ?? 0;
            const prev = stepsToDrive[idx - 1];
            if (prev) setCurrentStepIdRef.current(prev.id);
            waitForStepTarget(prev).then((found) => {
              if (cancelled) return;
              if (found) d.movePrevious();
            });
          },
          onDestroyStarted: (_el, _step, { driver: d }) => {
            const ignore = suppressFinishRef.current;
            d.destroy();
            if (!ignore && !cancelled) {
              finishTour();
            }
          },
        });

        driverRef.current = instance;
        suppressFinishRef.current = false;
        instance.drive();
      } finally {
        starting = false;
      }
    };

    const start = () => {
      run().catch(() => {});
    };

    const timeoutId = window.setTimeout(start, 80);
    const root = document.getElementById("root") || document.body;
    let debounceId;
    observer = new MutationObserver(() => {
      if (cancelled || driverRef.current?.isActive()) return;
      window.clearTimeout(debounceId);
      debounceId = window.setTimeout(start, 120);
    });
    observer.observe(root, { childList: true, subtree: true });
    const unbindViewport = bindTourViewport((reason) => {
      if (cancelled || !driverRef.current?.isActive()) return;
      if (reason === "breakpoint") {
        destroyProgrammatically();
        window.setTimeout(start, 80);
        return;
      }
      try {
        driverRef.current.refresh();
        window.requestAnimationFrame(() => clampActiveTourPopover());
      } catch {
        // Overlay may already be mid-destroy during route change.
      }
    });

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
      window.clearTimeout(debounceId);
      observer?.disconnect();
      unbindViewport();
      destroyProgrammatically();
    };
  }, [pathname, tourPending, replayRole]);

  return null;
}
