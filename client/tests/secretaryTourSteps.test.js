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
  SECRETARY_TOUR_STEPS,
  areAllSecretaryTourStepsComplete,
  getRemainingSecretaryStepsForPath,
  pathMatchesSecretaryStep,
  shouldRunSecretaryTour,
} = await import("../src/components/onboarding/secretaryTourSteps.js");
const {
  SECRETARY_TOUR_STEPS_KEY,
  markTourStepComplete,
  clearTourStepProgress,
  getCompletedTourSteps,
} = await import("../src/services/firstVisitService.js");
const { clampRectToViewport } = await import("../src/components/onboarding/tourLayout.js");

const VIEWPORTS = [
  { name: "360px", width: 360, height: 800 },
  { name: "390px", width: 390, height: 844 },
  { name: "768px", width: 768, height: 1024 },
  { name: "1024px", width: 1024, height: 768 },
  { name: "1280px+", width: 1280, height: 800 },
];

describe("secretary tour steps", () => {
  beforeEach(() => {
    memory.clear();
  });

  afterEach(() => {
    memory.clear();
  });

  it("defines a complete journey with stable data-tour targets", () => {
    assert.ok(SECRETARY_TOUR_STEPS.length >= 14);
    for (const step of SECRETARY_TOUR_STEPS) {
      assert.ok(step.id, "step needs id");
      assert.ok(step.route?.startsWith("/secretary"), `${step.id} route`);
      assert.ok(Array.isArray(step.targets) && step.targets.length > 0, `${step.id} targets`);
      assert.ok(step.title?.length > 0, `${step.id} title`);
      assert.ok(step.description?.length > 0, `${step.id} description`);
      assert.equal(step.disableActiveInteraction, true, `${step.id} must not mutate data`);
    }
    const ids = SECRETARY_TOUR_STEPS.map((s) => s.id);
    assert.equal(new Set(ids).size, ids.length, "step ids must be unique");
    assert.equal(SECRETARY_TOUR_STEPS_KEY, "pq.secretaryTour.v2.completedSteps");
  });

  it("covers dashboard through settings in workflow order", () => {
    assert.deepEqual(
      SECRETARY_TOUR_STEPS.map((s) => s.id),
      [
        "dashboard-overview",
        "nav-queue",
        "queue-start",
        "queue-list",
        "queue-control",
        "queue-request-checkin",
        "queue-penalize",
        "queue-send-to-doctor",
        "walkin-open",
        "walkin-form",
        "validate-qr",
        "schedule-publish",
        "schedule-form",
        "profile-help",
        "settings-queue-rules",
        "settings-sms",
      ]
    );
  });

  it("pathMatchesSecretaryStep respects exact routes", () => {
    const step = SECRETARY_TOUR_STEPS.find((s) => s.id === "validate-qr");
    assert.equal(pathMatchesSecretaryStep("/secretary/validate", step), true);
    assert.equal(pathMatchesSecretaryStep("/secretary/validate/", step), true);
    assert.equal(pathMatchesSecretaryStep("/secretary/queue", step), false);
  });

  it("shouldRunSecretaryTour starts for first-time secretaries and replay, not after completion", () => {
    const firstTime = { uid: "s1", hasCompletedTour: false };
    assert.equal(shouldRunSecretaryTour(firstTime, "secretary", "/secretary", null), true);
    assert.equal(
      shouldRunSecretaryTour({ ...firstTime, hasCompletedTour: true }, "secretary", "/secretary", null),
      false
    );
    assert.equal(
      shouldRunSecretaryTour({ ...firstTime, hasCompletedTour: true }, "secretary", "/secretary", "secretary"),
      true
    );
    assert.equal(shouldRunSecretaryTour(firstTime, "parent", "/secretary", null), false);
    assert.equal(
      shouldRunSecretaryTour(firstTime, "secretary", "/secretary/change-password", null),
      false
    );
  });

  it("tracks completion and skip progress without restarting after clear", () => {
    assert.equal(areAllSecretaryTourStepsComplete(), false);
    for (const step of SECRETARY_TOUR_STEPS) {
      markTourStepComplete(step.id, SECRETARY_TOUR_STEPS_KEY);
    }
    assert.equal(areAllSecretaryTourStepsComplete(), true);
    assert.deepEqual(getRemainingSecretaryStepsForPath("/secretary"), []);
    clearTourStepProgress(SECRETARY_TOUR_STEPS_KEY);
    assert.equal(getCompletedTourSteps(SECRETARY_TOUR_STEPS_KEY).length, 0);
    assert.ok(getRemainingSecretaryStepsForPath("/secretary").length >= 1);
  });

  it("navigates across pages via onNextNavigate without queue action hooks", () => {
    const navigators = SECRETARY_TOUR_STEPS.filter((s) => s.onNextNavigate);
    assert.ok(navigators.some((s) => s.onNextNavigate === "/secretary/queue"));
    assert.ok(navigators.some((s) => s.onNextNavigate === "/secretary/validate"));
    assert.ok(navigators.some((s) => s.onNextNavigate === "/secretary/schedules"));
    assert.ok(navigators.some((s) => s.onNextNavigate === "/secretary/profile"));
    assert.ok(navigators.some((s) => s.onNextNavigate === "/secretary/settings"));
    for (const step of SECRETARY_TOUR_STEPS) {
      assert.equal(typeof step.onPenalize, "undefined");
      assert.equal(typeof step.onCheckIn, "undefined");
      assert.equal(typeof step.onSendToDoctor, "undefined");
    }
  });

  it("describes calendar Post day flow, not the old draft Create Schedule form", () => {
    const calendar = SECRETARY_TOUR_STEPS.find((s) => s.id === "schedule-publish");
    const postDay = SECRETARY_TOUR_STEPS.find((s) => s.id === "schedule-form");
    assert.match(calendar.title, /Schedule calendar/i);
    assert.match(calendar.description, /Publish range|Copy previous week|post/i);
    assert.doesNotMatch(calendar.description, /Draft sessions stay hidden/i);
    assert.match(postDay.title, /Post a day/i);
    assert.match(postDay.description, /slots/i);
    assert.match(postDay.description, /weekday hours|opening or closing/i);
    assert.doesNotMatch(postDay.description, /Create a session|Save Schedule/i);
  });
});

describe("secretary tour popover viewport clamping", () => {
  const insets = { top: 12, right: 10, bottom: 96, left: 10 };

  for (const vp of VIEWPORTS) {
    it(`keeps the popover inside ${vp.name}`, () => {
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
