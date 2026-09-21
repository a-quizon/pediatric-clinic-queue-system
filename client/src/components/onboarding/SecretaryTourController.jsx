import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { useTourPreview } from "../../hooks/useTourPreview";
import {
  SECRETARY_TOUR_STEPS_KEY,
  clearTourStepProgress,
  getCompletedTourSteps,
  markTourStepComplete,
  persistTourComplete,
} from "../../services/firstVisitService";
import {
  SECRETARY_TOUR_STEPS,
  areAllSecretaryTourStepsComplete,
  findVisibleTourTarget,
  getRemainingSecretaryStepsForPath,
  pathMatchesSecretaryStep,
  shouldRunSecretaryTour,
} from "./secretaryTourSteps";

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
    if (findVisibleTourTarget(step.targets)) return true;
    await waitForPaint();
    await waitForMs(50);
  }
  return Boolean(findVisibleTourTarget(step.targets));
}

function nextGlobalStep(stepId) {
  const index = SECRETARY_TOUR_STEPS.findIndex((step) => step.id === stepId);
  return index >= 0 ? SECRETARY_TOUR_STEPS[index + 1] || null : null;
}

export default function SecretaryTourController() {
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
  const tourPending = shouldRunSecretaryTour(user, role, pathname, replayRole);

  userRef.current = user;
  updateContextUserRef.current = updateContextUser;
  setCurrentStepIdRef.current = setCurrentStepId;
  clearPreviewRef.current = clearPreview;
  clearReplayRef.current = clearReplay;
  navigateRef.current = navigate;

  useEffect(() => {
    if (!tourPending) {
      if (role === "secretary") clearPreviewRef.current();
      return undefined;
    }
    const completed = getCompletedTourSteps(SECRETARY_TOUR_STEPS_KEY);
    const firstStep = SECRETARY_TOUR_STEPS[0];
    if (
      replayRole === "secretary" &&
      completed.length === 0 &&
      firstStep &&
      !pathMatchesSecretaryStep(pathname, firstStep)
    ) {
      navigateRef.current(firstStep.route);
      return undefined;
    }
    const remaining = getRemainingSecretaryStepsForPath(pathname);
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
      clearTourStepProgress(SECRETARY_TOUR_STEPS_KEY);
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
        const remaining = getRemainingSecretaryStepsForPath(pathname);
        const completed = getCompletedTourSteps(SECRETARY_TOUR_STEPS_KEY);
        const firstStep = SECRETARY_TOUR_STEPS[0];
        if (
          replayRole === "secretary" &&
          completed.length === 0 &&
          firstStep &&
          !pathMatchesSecretaryStep(pathname, firstStep)
        ) {
          return;
        }
        if (remaining.length === 0) {
          if (areAllSecretaryTourStepsComplete()) {
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
        const unfinished = SECRETARY_TOUR_STEPS.filter(
          (step) => !getCompletedTourSteps(SECRETARY_TOUR_STEPS_KEY).includes(step.id)
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

        instance = driver({
          steps: stepsToDrive.map((step) => ({
            element: () => findVisibleTourTarget(step.targets),
            disableActiveInteraction: Boolean(step.disableActiveInteraction),
            skipMissingElement: false,
            waitForElement: 2500,
            popover: {
              title: step.title,
              description: step.description,
              align: "start",
            },
          })),
          animate: true,
          smoothScroll: true,
          allowClose: false,
          overlayClickBehavior: "close",
          showButtons: ["next", "previous"],
          overlayColor: "#16344a",
          overlayOpacity: 0.48,
          stagePadding: 10,
          stageRadius: 16,
          popoverClass: "pq-driver-popover",
          popoverOffset: 12,
          showProgress: stepsToDrive.length > 1,
          progressText: "{{current}} of {{total}}",
          nextBtnText: "Next",
          prevBtnText: "Back",
          doneBtnText: doneLabel,
          disableActiveInteraction: false,
          onPopoverRender: (popover) => {
            if (popover.footer.querySelector(".pq-driver-skip")) return;
            const skip = document.createElement("button");
            skip.type = "button";
            skip.className = "pq-driver-skip";
            skip.textContent = "Skip tour";
            skip.addEventListener("click", finishAsSkip);
            popover.footer.insertBefore(skip, popover.footer.firstChild);
          },
          onHighlightStarted: (_el, _step, { driver: d }) => {
            const idx = d.getActiveIndex() ?? 0;
            const current = stepsToDrive[idx];
            if (current) setCurrentStepIdRef.current(current.id);
          },
          onNextClick: (_el, _step, { driver: d }) => {
            const idx = d.getActiveIndex() ?? 0;
            const current = stepsToDrive[idx];
            if (current) markTourStepComplete(current.id, SECRETARY_TOUR_STEPS_KEY);

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
            if (areAllSecretaryTourStepsComplete()) {
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

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
      window.clearTimeout(debounceId);
      observer?.disconnect();
      destroyProgrammatically();
    };
  }, [pathname, tourPending, replayRole]);

  return null;
}
