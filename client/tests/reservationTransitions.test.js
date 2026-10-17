import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  assertCanCancelReservation,
  assertCanCheckIn,
  assertCanCompleteConsultation,
  assertCanSendToDoctor,
  assertCanUpdatePatientInfo,
  applyCheckInStatusTransition,
  checkInBlockedMessage,
} from "../src/utils/reservationTransitions.js";

describe("C4 reservation transitions", () => {
  it("blocks parent cancel after check-in", () => {
    const result = assertCanCancelReservation(
      { status: "checked_in", parentId: "p1" },
      { actorUid: "p1", actorRole: "parent" }
    );
    assert.equal(result.ok, false);
    assert.match(result.message, /check-in/i);
  });

  it("allows parent cancel while reserved", () => {
    const result = assertCanCancelReservation(
      { status: "reserved", parentId: "p1" },
      { actorUid: "p1", actorRole: "parent" }
    );
    assert.equal(result.ok, true);
  });

  it("blocks cancelling another parent's reservation", () => {
    const result = assertCanCancelReservation(
      { status: "reserved", parentId: "p1" },
      { actorUid: "p2", actorRole: "parent" }
    );
    assert.equal(result.ok, false);
  });

  it("allows staff to cancel a checked-in walk-in", () => {
    const result = assertCanCancelReservation(
      { status: "checked_in", source: "walk_in" },
      { actorUid: "s1", actorRole: "secretary" }
    );
    assert.equal(result.ok, true);
  });

  it("does not treat admin as clinic staff when cancelling", () => {
    assert.equal(
      assertCanCancelReservation(
        { status: "checked_in", source: "walk_in" },
        { actorUid: "a1", actorRole: "admin" }
      ).ok,
      false
    );
    assert.equal(
      assertCanCancelReservation(
        { status: "reserved", parentId: "p1" },
        { actorUid: "a1", actorRole: "admin" }
      ).ok,
      false
    );
  });

  it("blocks completing a cancelled reservation", () => {
    const result = assertCanCompleteConsultation({ status: "cancelled" });
    assert.equal(result.ok, false);
  });

  it("allows completing with_doctor", () => {
    assert.equal(assertCanCompleteConsultation({ status: "with_doctor" }).ok, true);
  });

  it("blocks check-in of forfeited reservations", () => {
    const result = assertCanCheckIn({ status: "forfeited" });
    assert.equal(result.ok, false);
    assert.match(result.message, /forfeited/i);
  });

  it("blocks check-in of cancelled_by_clinic", () => {
    const result = assertCanCheckIn({ status: "cancelled_by_clinic" });
    assert.equal(result.ok, false);
    assert.match(result.message, /cancelled/i);
  });

  it("surfaces distinct check-in failure messages", () => {
    assert.match(assertCanCheckIn({ status: "checked_in" }).message, /already checked in/i);
    assert.match(assertCanCheckIn({ status: "reserved", checkedIn: true }).message, /already checked in/i);
    assert.match(assertCanCheckIn({ status: "with_doctor" }).message, /with the doctor/i);
    assert.match(assertCanCheckIn({ status: "expired" }).message, /expired/i);
    assert.match(assertCanCheckIn({ status: "consultation_completed" }).message, /completed/i);
    assert.equal(assertCanCheckIn({ status: "reserved" }).ok, true);
    assert.equal(assertCanCheckIn({ status: "waiting" }).ok, true);
  });

  it("applyCheckInStatusTransition allows waiting statuses and rejects others", () => {
    assert.deepEqual(applyCheckInStatusTransition("reserved"), {
      ok: true,
      nextStatus: "checked_in",
    });
    assert.equal(applyCheckInStatusTransition("checked_in").ok, false);
    assert.match(applyCheckInStatusTransition("checked_in").message, /already checked in/i);
    assert.match(applyCheckInStatusTransition("forfeited").message, /forfeited/i);
    assert.equal(checkInBlockedMessage("reserved"), null);
  });

  it("requires checked_in before send-to-doctor", () => {
    assert.equal(assertCanSendToDoctor({ status: "reserved" }).ok, false);
    assert.equal(assertCanSendToDoctor({ status: "checked_in" }).ok, true);
  });

  it("blocks patient info edits on another parent's ticket", () => {
    const result = assertCanUpdatePatientInfo(
      { status: "reserved", parentId: "p1" },
      { actorUid: "p2", actorRole: "parent" }
    );
    assert.equal(result.ok, false);
  });
});
