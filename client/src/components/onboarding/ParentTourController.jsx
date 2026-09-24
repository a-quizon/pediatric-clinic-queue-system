import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { useTourPreview } from "../../hooks/useTourPreview";
import {
  PARENT_TOUR_STEPS_KEY,
  clearTourStepProgress,
  getCompletedTourSteps,
  markTourStepComplete,
  persistParentTourComplete,
} from "../../services/firstVisitService";
import {
  TOUR_STEPS,
  areAllTourStepsComplete,
  findVisibleTourTarget,
  getRemainingStepsForPath,
  pathMatchesStep,
  resolveParentTourElement,
  shouldRunParentTour,
} from "./parentTourSteps";
import {
  bindTourViewport,
  decorateTourPopover,
  getTourDriverChrome,
  mapTourDriverSteps,
  scrollTourTargetIntoView,
  clampActiveTourPopover,
  prefersReducedTourMotion,
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
    if (findVisibleTourTarget(step.targets)) return true;
    await waitForPaint();
    await waitForMs(50);
  }
  // Empty states / slow loads: allow the page shell so the popover still appears.
  return Boolean(resolveParentTourElement(step));
}

function nextGlobalStep(stepId) {
  const index = TOUR_STEPS.findIndex((step) => step.id === stepId);
  return index >= 0 ? TOUR_STEPS[index + 1] || null : null;
}

function findParentTourTarget(arg) {
  if (arg && typeof arg === "object" && Array.isArray(arg.targets)) {
    return findVisibleTourTarget(arg.targets) || resolveParentTourElement(arg);
  }
  const found = findVisibleTourTarget(arg);
  if (found) return found;
  if (typeof document === "undefined") return null;
  return document.querySelector("main") || document.getElementById("root") || document.body;
}

export default function ParentTourController() {
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
  const tourPending = shouldRunParentTour(user, role, pathname, replayRole);

  userRef.current = user;
  updateContextUserRef.current = updateContextUser;
  setCurrentStepIdRef.current = setCurrentStepId;
  clearPreviewRef.current = clearPreview;
  clearReplayRef.current = clearReplay;
  navigateRef.current = navigate;

  useEffect(() => {
    if (!tourPending) {
      if (role === "parent") clearPreviewRef.current();
      return undefined;
    }
    const completed = getCompletedTourSteps(PARENT_TOUR_STEPS_KEY);
    const firstStep = TOUR_STEPS[0];
    if (
      replayRole === "parent" &&
      completed.length === 0 &&
      firstStep &&
      !pathMatchesStep(pathname, firstStep)
    ) {
      navigateRef.current(firstStep.route);
      return undefined;
    }
    const remaining = getRemainingStepsForPath(pathname);
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
      clearTourStepProgress(PARENT_TOUR_STEPS_KEY);
      updateContextUserRef.current({ hasCompletedTour: true });
      if (uid) {
        persistParentTourComplete(uid).catch(console.error);
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
        const remaining = getRemainingStepsForPath(pathname);
        const completed = getCompletedTourSteps(PARENT_TOUR_STEPS_KEY);
        const firstStep = TOUR_STEPS[0];
        if (
          replayRole === "parent" &&
          completed.length === 0 &&
          firstStep &&
          !pathMatchesStep(pathname, firstStep)
        ) {
          return;
        }
        if (remaining.length === 0) {
          if (areAllTourStepsComplete()) {
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
        const unfinished = TOUR_STEPS.filter(
          (step) => !getCompletedTourSteps(PARENT_TOUR_STEPS_KEY).includes(step.id)
        );
        const lastUnfinished = unfinished[unfinished.length - 1];
        const doneLabel =
          lastStep && lastUnfinished?.id === lastStep.id && !lastStep.onNextNavigate
            ? "Finish"
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
        const reduceMotion = prefersReducedTourMotion();
        instance = driver({
          steps: mapTourDriverSteps(stepsToDrive, findParentTourTarget),
          animate: !reduceMotion,
          smoothScroll: !reduceMotion,
          allowClose: false,
          overlayClickBehavior: "close",
          showButtons: ["next", "previous"],
          overlayColor: "#16344a",
          overlayOpacity: 0.48,
          stagePadding: chrome.stagePadding,
          stageRadius: 16,
          popoverClass: "pq-driver-popover",
          popoverOffset: chrome.popoverOffset,
          showProgress: true,
          progressText: "Step {{current}} of {{total}}",
          nextBtnText: "Next",
          prevBtnText: "Back",
          doneBtnText: doneLabel,
          disableActiveInteraction: false,
          onPopoverRender: (popover, opts) => {
            decorateTourPopover(popover, finishAsSkip);
            const idx = opts?.driver?.getActiveIndex?.() ?? 0;
            const current = stepsToDrive[idx];
            const globalIndex = TOUR_STEPS.findIndex((step) => step.id === current?.id);
            const progressEl =
              popover.progress ||
              popover.wrapper?.querySelector?.(".driver-popover-progress-text");
            if (progressEl && globalIndex >= 0) {
              progressEl.textContent = `Step ${globalIndex + 1} of ${TOUR_STEPS.length}`;
            }
          },
          onHighlightStarted: (el, _step, { driver: d }) => {
            const idx = d.getActiveIndex() ?? 0;
            const current = stepsToDrive[idx];
            if (current) setCurrentStepIdRef.current(current.id);
            scrollTourTargetIntoView(el);
            const globalIndex = TOUR_STEPS.findIndex((step) => step.id === current?.id);
            const progressEl = document.querySelector(
              ".driver-popover.pq-driver-popover .driver-popover-progress-text"
            );
            if (progressEl && globalIndex >= 0) {
              progressEl.textContent = `Step ${globalIndex + 1} of ${TOUR_STEPS.length}`;
            }
          },
          onNextClick: (_el, _step, { driver: d }) => {
            const idx = d.getActiveIndex() ?? 0;
            const current = stepsToDrive[idx];
            if (current) markTourStepComplete(current.id, PARENT_TOUR_STEPS_KEY);

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
            if (areAllTourStepsComplete()) {
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
