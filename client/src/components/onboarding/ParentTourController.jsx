import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import {
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
  shouldRunParentTour,
} from "./parentTourSteps";

export default function ParentTourController() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user, role, updateContextUser } = useAuth();
  const driverRef = useRef(null);
  const programmaticRef = useRef(false);
  const tourPending = shouldRunParentTour(user, role, pathname);

  useEffect(() => {
    if (!tourPending) return undefined;

    let cancelled = false;
    let starting = false;
    let observer;

    const finishTour = () => {
      const uid = user?.uid;
      clearTourStepProgress();
      updateContextUser({ hasCompletedTour: true });
      if (uid) {
        persistParentTourComplete(uid).catch(console.error);
      }
    };

    const destroyProgrammatically = () => {
      programmaticRef.current = true;
      driverRef.current?.destroy();
      driverRef.current = null;
    };

    const run = async () => {
      if (cancelled || starting || driverRef.current?.isActive()) return;
      starting = true;

      try {
        const remaining = getRemainingStepsForPath(pathname);
        if (remaining.length === 0) {
          if (areAllTourStepsComplete()) {
            finishTour();
          }
          return;
        }

        const ready = remaining.filter((step) => findVisibleTourTarget(step.targets));
        const stepsToDrive = ready.length > 0 ? ready : remaining;
        const lastStep = stepsToDrive[stepsToDrive.length - 1];
        const unfinished = TOUR_STEPS.filter((step) => !getCompletedTourSteps().includes(step.id));
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
          instance?.destroy();
        };

        instance = driver({
          steps: stepsToDrive.map((step) => ({
            element: () => findVisibleTourTarget(step.targets),
            disableActiveInteraction: false,
            skipMissingElement: true,
            waitForElement: 2500,
            popover: {
              title: step.title,
              description: step.description,
              align: "start",
            },
          })),
          animate: true,
          smoothScroll: true,
          allowClose: true,
          overlayClickBehavior: "close",
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
          onNextClick: (_el, _step, { driver: d }) => {
            const idx = d.getActiveIndex() ?? 0;
            const current = stepsToDrive[idx];
            if (current) markTourStepComplete(current.id);

            if (!d.isLastStep()) {
              d.moveNext();
              return;
            }

            if (current?.onNextNavigate) {
              destroyProgrammatically();
              navigate(current.onNextNavigate);
              return;
            }

            destroyProgrammatically();
            if (areAllTourStepsComplete()) {
              finishTour();
            }
          },
          onCloseClick: finishAsSkip,
          onDestroyStarted: (_el, _step, { driver: d }) => {
            if (programmaticRef.current) {
              programmaticRef.current = false;
              d.destroy();
              return;
            }
            finishTour();
            d.destroy();
          },
        });

        driverRef.current = instance;
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
  }, [pathname, tourPending, navigate, user?.uid, updateContextUser]);

  return null;
}
