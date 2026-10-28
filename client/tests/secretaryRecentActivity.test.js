import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildSecretaryRecentActivities } from "../src/utils/secretaryRecentActivity.js";

describe("buildSecretaryRecentActivities", () => {
  it("builds reserve and cancel rows with stable keys matching dashboard copy", () => {
    const activities = buildSecretaryRecentActivities([
      {
        id: "r1",
        createdAt: 100,
        cancelledAt: 200,
        childName: "Ana Cruz",
      },
    ]);

    assert.equal(activities.length, 2);
    assert.equal(activities[0].text, "Ana Cruz cancelled reservation");
    assert.equal(activities[0].kind, "cancelled");
    assert.equal(activities[0].key, "cancelled_r1_200");
    assert.equal(activities[1].text, "Parent/Guardian reserved a slot.");
    assert.equal(activities[1].kind, "reserved");
    assert.equal(activities[1].key, "reserved_r1_100");
  });

  it("includes check-in, doctor, complete, forfeit, and penalty events", () => {
    const activities = buildSecretaryRecentActivities([
      {
        id: "r2",
        createdAt: 1,
        checkedInAt: 2,
        sentToDoctorAt: 3,
        consultationCompletedAt: 4,
        forfeitedAt: 5,
        lastPenalizedAt: 6,
        childName: "Ben Santos",
      },
    ]);

    const kinds = activities.map((a) => a.kind);
    assert.deepEqual(kinds, [
      "penalized",
      "forfeited",
      "consultation_completed",
      "sent_to_doctor",
      "checked_in",
      "reserved",
    ]);
    assert.equal(activities.find((a) => a.kind === "checked_in").text, "Ben Santos checked in");
  });

  it("skips reservations without id", () => {
    assert.deepEqual(buildSecretaryRecentActivities([{ createdAt: 1 }]), []);
  });
});
