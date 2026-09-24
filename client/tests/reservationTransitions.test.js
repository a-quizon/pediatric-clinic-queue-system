import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  assertCanCancelReservation,
  assertCanCheckIn,
  assertCanCompleteConsultation,
  assertCanSendToDoctor,
  assertCanUpdatePatientInfo,
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
  });

  it("blocks check-in of cancelled_by_clinic", () => {
    const result = assertCanCheckIn({ status: "cancelled_by_clinic" });
    assert.equal(result.ok, false);
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
