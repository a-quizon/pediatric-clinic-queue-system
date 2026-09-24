import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

const memory = new Map();
globalThis.sessionStorage = {
  getItem(key) {
    return memory.has(key) ? memory.get(key) : null;
  },
  setItem(key, value) {
    memory.set(key, String(value));
  },
  removeItem(key) {
    memory.delete(key);
  },
};

if (!globalThis.window) {
  globalThis.window = globalThis;
}

const {
  TOUR_STEPS,
  pathMatchesStep,
  shouldRunParentTour,
  areAllTourStepsComplete,
  getRemainingStepsForPath,
} = await import("../src/components/onboarding/parentTourSteps.js");
const {
  PARENT_TOUR_STEPS_KEY,
  markTourStepComplete,
  clearTourStepProgress,
  getCompletedTourSteps,
} = await import("../src/services/firstVisitService.js");
const {
  isTourPhoneViewport,
  getTourPopoverAlign,
  getTourSafeInsets,
  clampRectToViewport,
} = await import("../src/components/onboarding/tourLayout.js");

const VIEWPORTS = [
  { name: "360px", width: 360, height: 800 },
  { name: "390px", width: 390, height: 844 },
  { name: "768px", width: 768, height: 1024 },
  { name: "1024px", width: 1024, height: 768 },
  { name: "1280px+", width: 1280, height: 800 },
];

describe("parent tour steps", () => {
  beforeEach(() => {
    memory.clear();
  });

  afterEach(() => {
    memory.clear();
  });

  it("defines a complete journey with stable data-tour targets", () => {
    assert.ok(TOUR_STEPS.length >= 10);
    for (const step of TOUR_STEPS) {
      assert.ok(step.id, "step needs id");
      assert.ok(step.route?.startsWith("/parent"), `${step.id} route`);
      assert.ok(Array.isArray(step.targets) && step.targets.length > 0, `${step.id} targets`);
      assert.ok(step.title?.length > 0, `${step.id} title`);
      assert.ok(step.description?.length > 0, `${step.id} description`);
    }
    const ids = TOUR_STEPS.map((s) => s.id);
    assert.ok(ids.includes("ticket-qr"));
    assert.ok(ids.includes("parent-late-rules"));
    assert.equal(new Set(ids).size, ids.length, "step ids must be unique");
  });

  it("reserve step targets the calendar, not old session cards", () => {
    const step = TOUR_STEPS.find((s) => s.id === "reserve-schedule");
    assert.ok(step.targets.includes("reserve-schedule-calendar"));
    assert.match(step.title, /calendar/i);
    assert.match(step.description, /green day|branch/i);
  });

  it("explains QR check-in purpose without accusatory no-show language", () => {
    const qr = TOUR_STEPS.find((s) => s.id === "ticket-qr");
    const late = TOUR_STEPS.find((s) => s.id === "parent-late-rules");
    assert.match(qr.description, /QR code/i);
    assert.match(qr.description, /confirm|keeps your queue slot|arrived/i);
    assert.match(late.description, /forfeit/i);
    assert.doesNotMatch(qr.description, /suspicious|threshold|Rule [ABC]/i);
    assert.doesNotMatch(late.description, /suspicious|threshold|Rule [ABC]/i);
  });

  it("marks interactive sample steps as non-interactive so the tour cannot submit forms", () => {
    const guarded = [
      "parent-queue-monitor",
      "reserve-schedule",
      "reserve-form",
      "reservation-list",
      "ticket-qr",
      "parent-late-rules",
    ];
    for (const id of guarded) {
      const step = TOUR_STEPS.find((s) => s.id === id);
      assert.equal(step.disableActiveInteraction, true, `${id} must disable interaction`);
    }
  });

  it("pathMatchesStep respects exact routes", () => {
    const home = TOUR_STEPS[0];
    assert.equal(pathMatchesStep("/parent", home), true);
    assert.equal(pathMatchesStep("/parent/", home), true);
    assert.equal(pathMatchesStep("/parent/reserve", home), false);
    assert.equal(
      pathMatchesStep("/parent/reserve", TOUR_STEPS.find((s) => s.id === "reserve-schedule")),
      true
    );
  });

  it("shouldRunParentTour starts for first-time parents and replay, not after completion", () => {
    const firstTime = { uid: "p1", hasCompletedTour: false, onboardingComplete: true };
    assert.equal(shouldRunParentTour(firstTime, "parent", "/parent"), true);
    assert.equal(
      shouldRunParentTour({ ...firstTime, hasCompletedTour: true }, "parent", "/parent"),
      false
    );
    assert.equal(
      shouldRunParentTour({ ...firstTime, hasCompletedTour: true }, "parent", "/parent", "parent"),
      true
    );
    assert.equal(shouldRunParentTour(firstTime, "secretary", "/parent"), false);
    assert.equal(
      shouldRunParentTour({ ...firstTime, onboardingComplete: false }, "parent", "/parent"),
      false
    );
  });

  it("tracks completion and skip progress without restarting after clear", () => {
    assert.equal(areAllTourStepsComplete(), false);
    for (const step of TOUR_STEPS) {
      markTourStepComplete(step.id, PARENT_TOUR_STEPS_KEY);
    }
    assert.equal(areAllTourStepsComplete(), true);
    assert.deepEqual(getRemainingStepsForPath("/parent"), []);
    clearTourStepProgress(PARENT_TOUR_STEPS_KEY);
    assert.equal(getCompletedTourSteps(PARENT_TOUR_STEPS_KEY).length, 0);
    assert.ok(getRemainingStepsForPath("/parent").length >= 1);
  });

  it("navigates across pages via onNextNavigate without reservation action hooks", () => {
    const navigators = TOUR_STEPS.filter((s) => s.onNextNavigate);
    assert.ok(navigators.some((s) => s.onNextNavigate === "/parent/reserve"));
    assert.ok(navigators.some((s) => s.onNextNavigate === "/parent/reservations"));
    assert.ok(navigators.some((s) => s.onNextNavigate === "/parent/profile"));
    for (const step of TOUR_STEPS) {
      assert.equal(typeof step.onConfirm, "undefined");
      assert.equal(typeof step.onReserve, "undefined");
    }
  });
});

describe("tourLayout phone helpers", () => {
  it("treats 360–390px widths as phone viewports with bottom safe inset for the dock", () => {
    for (const width of [360, 390, 767]) {
      Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
      Object.defineProperty(window, "innerHeight", { configurable: true, value: 800 });
      Object.defineProperty(window, "visualViewport", {
        configurable: true,
        value: { height: 800, offsetTop: 0 },
      });
      assert.equal(isTourPhoneViewport(), true, `${width}px should be phone`);
      assert.equal(getTourPopoverAlign("bottom"), "center");
      const insets = getTourSafeInsets();
      assert.ok(insets.bottom >= 72, "dock clearance");
    }
  });

  it("treats tablet and desktop widths as non-phone", () => {
    for (const width of [768, 1024, 1280]) {
      Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
      Object.defineProperty(window, "innerHeight", { configurable: true, value: 900 });
      assert.equal(isTourPhoneViewport(), false, `${width}px should not be phone`);
      const insets = getTourSafeInsets();
      assert.equal(insets.bottom, 16);
    }
  });
});

describe("parent tour popover viewport clamping", () => {
  const insets = { top: 12, right: 10, bottom: 96, left: 10 };

  for (const vp of VIEWPORTS) {
    it(`keeps the popover inside ${vp.name} width`, () => {
      const popover = {
        left: -40,
        top: vp.height - 20,
        width: Math.min(352, vp.width - 20),
        height: 220,
      };
      const clamped = clampRectToViewport(popover, vp, insets);
      assert.ok(clamped.left >= insets.left);
      assert.ok(clamped.top >= insets.top);
      assert.ok(clamped.left + popover.width <= vp.width - insets.right + 0.5);
      assert.ok(clamped.top + popover.height <= vp.height - insets.bottom + 0.5);
    });
  }
});
