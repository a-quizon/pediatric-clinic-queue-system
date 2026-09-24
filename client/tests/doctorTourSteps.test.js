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
  DOCTOR_TOUR_STEPS,
  pathMatchesDoctorStep,
  shouldRunDoctorTour,
  areAllDoctorTourStepsComplete,
  getRemainingDoctorStepsForPath,
  resolveDoctorTourElement,
} = await import("../src/components/onboarding/doctorTourSteps.js");
const {
  DOCTOR_TOUR_STEPS_KEY,
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
  { name: "360", width: 360, height: 740 },
  { name: "390", width: 390, height: 844 },
  { name: "768", width: 768, height: 1024 },
  { name: "1024", width: 1024, height: 768 },
  { name: "1280", width: 1280, height: 800 },
];

describe("doctor tour steps", () => {
  beforeEach(() => {
    memory.clear();
  });

  afterEach(() => {
    memory.clear();
  });

  it("defines a complete clinic-admin journey with stable data-tour targets", () => {
    assert.ok(DOCTOR_TOUR_STEPS.length >= 14);
    for (const step of DOCTOR_TOUR_STEPS) {
      assert.ok(step.id, "step needs id");
      assert.ok(step.route?.startsWith("/doctor"), `${step.id} route`);
      assert.ok(Array.isArray(step.targets) && step.targets.length > 0, `${step.id} targets`);
      assert.ok(step.title?.length > 0, `${step.id} title`);
      assert.ok(step.description?.length > 0, `${step.id} description`);
      assert.equal(step.disableActiveInteraction, true, `${step.id} must disable interaction`);
    }
    const ids = DOCTOR_TOUR_STEPS.map((s) => s.id);
    assert.equal(new Set(ids).size, ids.length, "step ids must be unique");
    for (const required of [
      "doctor-dashboard",
      "doctor-queue-list",
      "doctor-users-list",
      "doctor-users-secretary",
      "doctor-users-parent",
      "doctor-audit-filters",
      "doctor-audit-suspicious",
      "doctor-notifications",
      "doctor-profile",
    ]) {
      assert.ok(ids.includes(required), `missing ${required}`);
    }
  });

  it("does not reference Admin audit filter or parent edit features", () => {
    const blob = DOCTOR_TOUR_STEPS.map((s) => `${s.title} ${s.description}`).join("\n");
    assert.match(blob, /There is no Admin filter/i);
    assert.equal(
      DOCTOR_TOUR_STEPS.some((s) =>
        /All Roles \| Admin|option.*Admin|Role:.*Admin/i.test(`${s.title} ${s.description}`)
      ),
      false,
      "must not present Admin as an available filter option"
    );
    assert.match(blob, /view-only/i);
    assert.match(blob, /cannot edit a parent's profile/i);
    assert.match(blob, /no email is sent/i);
    assert.match(blob, /password reset email/i);
    assert.match(blob, /never deactivates/i);
    assert.doesNotMatch(blob, /threshold|Rule [ABC]|days without/i);
  });

  it("covers cross-page navigation for queue, schedules, users, audit, reports, and profile", () => {
    const navigators = DOCTOR_TOUR_STEPS.filter((s) => s.onNextNavigate);
    const destinations = navigators.map((s) => s.onNextNavigate);
    assert.ok(destinations.includes("/doctor/queue"));
    assert.ok(destinations.includes("/doctor/schedules"));
    assert.ok(destinations.includes("/doctor/users"));
    assert.ok(destinations.includes("/doctor/audit-logs"));
    assert.ok(destinations.includes("/doctor/reports"));
    assert.ok(destinations.includes("/doctor/profile"));
    for (const step of DOCTOR_TOUR_STEPS) {
      assert.equal(typeof step.onConfirm, "undefined");
      assert.equal(typeof step.onDeactivate, "undefined");
      assert.equal(typeof step.onResetPassword, "undefined");
      assert.equal(typeof step.onPublish, "undefined");
    }
  });

  it("describes the calendar post-day flow, not the old create-session form", () => {
    const calendar = DOCTOR_TOUR_STEPS.find((s) => s.id === "doctor-schedule-publish");
    const postDay = DOCTOR_TOUR_STEPS.find((s) => s.id === "doctor-schedule-form");
    assert.equal(calendar.title, "Schedule calendar");
    assert.match(calendar.description, /Publish range|Copy previous week/i);
    assert.match(calendar.description, /branch/i);
    assert.equal(postDay.title, "Post a day");
    assert.match(postDay.description, /slots/i);
    assert.match(postDay.description, /weekday hours|opening or closing/i);
    assert.doesNotMatch(postDay.description, /Create a session|Save Schedule|Set branch, date, hours/i);
    assert.doesNotMatch(calendar.description, /Draft sessions stay hidden/i);
  });

  it("pathMatchesDoctorStep respects exact routes", () => {
    const home = DOCTOR_TOUR_STEPS.find((s) => s.id === "doctor-dashboard");
    assert.equal(pathMatchesDoctorStep("/doctor", home), true);
    assert.equal(pathMatchesDoctorStep("/doctor/", home), true);
    assert.equal(pathMatchesDoctorStep("/doctor/queue", home), false);
    assert.equal(
      pathMatchesDoctorStep("/doctor/users", DOCTOR_TOUR_STEPS.find((s) => s.id === "doctor-users-list")),
      true
    );
  });

  it("shouldRunDoctorTour starts for first-time doctors and replay, not after completion", () => {
    const firstTime = { uid: "d1", hasCompletedTour: false };
    assert.equal(shouldRunDoctorTour(firstTime, "doctor", "/doctor"), true);
    assert.equal(
      shouldRunDoctorTour({ ...firstTime, hasCompletedTour: true }, "doctor", "/doctor"),
      false
    );
    assert.equal(
      shouldRunDoctorTour({ ...firstTime, hasCompletedTour: true }, "doctor", "/doctor", "doctor"),
      true
    );
    assert.equal(shouldRunDoctorTour(firstTime, "secretary", "/doctor"), false);
    assert.equal(shouldRunDoctorTour(firstTime, "doctor", "/parent"), false);
  });

  it("tracks completion and skip progress without restarting after clear", () => {
    assert.equal(areAllDoctorTourStepsComplete(), false);
    for (const step of DOCTOR_TOUR_STEPS) {
      markTourStepComplete(step.id, DOCTOR_TOUR_STEPS_KEY);
    }
    assert.equal(areAllDoctorTourStepsComplete(), true);
    assert.deepEqual(getRemainingDoctorStepsForPath("/doctor"), []);
    clearTourStepProgress(DOCTOR_TOUR_STEPS_KEY);
    assert.equal(getCompletedTourSteps(DOCTOR_TOUR_STEPS_KEY).length, 0);
    assert.ok(getRemainingDoctorStepsForPath("/doctor").length >= 1);
  });

  it("resolveDoctorTourElement falls back when targets are missing", () => {
    const previousDocument = globalThis.document;
    globalThis.document = {
      querySelectorAll: () => [],
      querySelector: (sel) => (sel === "main" ? { id: "main-fallback" } : null),
      getElementById: () => null,
      body: { id: "body-fallback" },
    };
    try {
      const step = DOCTOR_TOUR_STEPS.find((s) => s.id === "doctor-audit-suspicious");
      const el = resolveDoctorTourElement(step);
      assert.equal(el?.id, "main-fallback");
    } finally {
      globalThis.document = previousDocument;
    }
  });
});

describe("doctor tourLayout phone helpers", () => {
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

describe("doctor tour popover viewport clamping", () => {
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
