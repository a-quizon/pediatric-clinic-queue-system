const TOUR_PHONE_MAX = 767;

export function isTourPhoneViewport() {
  return window.innerWidth <= TOUR_PHONE_MAX;
}

export function prefersReducedTourMotion() {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

export function getTourSafeInsets() {
  const phone = isTourPhoneViewport();
  const safeBottom =
    typeof window !== "undefined" && window.visualViewport
      ? Math.max(0, window.innerHeight - window.visualViewport.height - window.visualViewport.offsetTop)
      : 0;
  return {
    top: phone ? 12 : 16,
    right: 10,
    bottom: phone ? Math.max(96, 72 + safeBottom) : 16,
    left: 10,
  };
}

export function getTourPopoverSide(element) {
  if (!element || !(element instanceof Element)) return isTourPhoneViewport() ? "bottom" : "right";
  if (element.closest(".pq-dock-wrap")) return "top";
  if (element.closest("aside.pq-glass-nav, .pq-glass-nav")) return "right";

  const rect = element.getBoundingClientRect();
  const vh = window.innerHeight;
  const vw = window.innerWidth;

  if (isTourPhoneViewport()) {
    // Prefer bottom-sheet style placement on phones so the card stays readable.
    if (rect.top < vh * 0.35) return "bottom";
    if (rect.height > vh * 0.42) return "over";
    return "top";
  }

  if (rect.bottom > vh * 0.7 || rect.top > vh - 140) return "top";
  if (vw >= 768 && rect.left < 280 && rect.width < 280) return "right";
  if (rect.top < vh * 0.22) return "bottom";
  return "bottom";
}

export function getTourPopoverAlign(side) {
  if (isTourPhoneViewport()) return "center";
  if (side === "right" || side === "left") return "start";
  return "start";
}

export function scrollTourTargetIntoView(element) {
  if (!element || typeof element.scrollIntoView !== "function") return;
  const behavior = prefersReducedTourMotion() ? "auto" : "smooth";
  element.scrollIntoView({
    block: "center",
    inline: "nearest",
    behavior,
  });
}

export function clampTourPopover(popover) {
  const el = popover?.wrapper;
  if (!el) return;
  const insets = getTourSafeInsets();
  const rect = el.getBoundingClientRect();
  const maxLeft = window.innerWidth - rect.width - insets.right;
  const maxTop = window.innerHeight - rect.height - insets.bottom;
  const left = Math.min(Math.max(insets.left, rect.left), Math.max(insets.left, maxLeft));
  const top = Math.min(Math.max(insets.top, rect.top), Math.max(insets.top, maxTop));
  el.style.left = `${Math.round(left)}px`;
  el.style.top = `${Math.round(top)}px`;
  el.style.right = "auto";
  el.style.bottom = "auto";
}

export function clampActiveTourPopover() {
  const el =
    document.querySelector(".driver-popover.pq-driver-popover") ||
    document.querySelector(".pq-driver-popover");
  if (el) clampTourPopover({ wrapper: el });
}

export function attachTourSkipButton(popover, onSkip) {
  if (!popover?.footer || popover.footer.querySelector(".pq-driver-skip")) return;
  const skip = document.createElement("button");
  skip.type = "button";
  skip.className = "pq-driver-skip";
  skip.textContent = "Skip";
  skip.setAttribute("aria-label", "Skip tour");
  skip.addEventListener("click", onSkip);
  popover.footer.insertBefore(skip, popover.footer.firstChild);
}

export function decorateTourPopover(popover, onSkip) {
  attachTourSkipButton(popover, onSkip);
  window.requestAnimationFrame(() => {
    clampTourPopover(popover);
    window.requestAnimationFrame(() => clampTourPopover(popover));
  });
}

export function mapTourDriverSteps(steps, findTarget) {
  return steps.map((step) => {
    const resolve = () => {
      if (typeof findTarget !== "function") {
        return document.querySelector("main") || document.body;
      }
      try {
        const viaStep = findTarget(step);
        if (viaStep) return viaStep;
      } catch {
        // Controllers may pass findVisibleTourTarget(ids) instead.
      }
      try {
        const viaIds = findTarget(step.targets);
        if (viaIds) return viaIds;
      } catch {
        // fall through
      }
      return document.querySelector("main") || document.body;
    };

    const side = getTourPopoverSide(resolve());
    return {
      element: resolve,
      disableActiveInteraction: Boolean(step.disableActiveInteraction),
      skipMissingElement: false,
      waitForElement: 2500,
      popover: {
        title: step.title,
        description: step.description,
        side,
        align: getTourPopoverAlign(side),
      },
    };
  });
}

export function getTourDriverChrome() {
  const phone = isTourPhoneViewport();
  return {
    stagePadding: phone ? 6 : 10,
    popoverOffset: phone ? 10 : 12,
  };
}

export function bindTourViewport(onChange) {
  let lastPhone = isTourPhoneViewport();
  let timer = 0;
  const fire = () => {
    const phone = isTourPhoneViewport();
    const reason = phone !== lastPhone ? "breakpoint" : "resize";
    lastPhone = phone;
    onChange(reason);
  };
  const queued = () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(fire, 140);
  };
  window.addEventListener("resize", queued);
  window.addEventListener("orientationchange", queued);
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", queued);
    window.visualViewport.addEventListener("scroll", queued);
  }
  return () => {
    window.clearTimeout(timer);
    window.removeEventListener("resize", queued);
    window.removeEventListener("orientationchange", queued);
    if (window.visualViewport) {
      window.visualViewport.removeEventListener("resize", queued);
      window.visualViewport.removeEventListener("scroll", queued);
    }
  };
}

/** Pure helper for tests: keep a popover rect fully inside a viewport box. */
export function clampRectToViewport(rect, viewport, insets) {
  const maxLeft = viewport.width - rect.width - insets.right;
  const maxTop = viewport.height - rect.height - insets.bottom;
  return {
    left: Math.min(Math.max(insets.left, rect.left), Math.max(insets.left, maxLeft)),
    top: Math.min(Math.max(insets.top, rect.top), Math.max(insets.top, maxTop)),
  };
}
