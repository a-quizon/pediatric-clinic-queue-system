import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildPatientInfoPayload } from "../src/utils/reservationPatients.js";
import {
  NO_CHILD_SELECTED_MESSAGE,
  PATIENT_INFO_CANCEL_FAILED_MESSAGE,
  PATIENT_INFO_UPDATE_FAILED_MESSAGE,
  patientInfoCancelSuccessState,
  patientInfoSubmitSuccessState,
  preparePatientInfoSubmit,
  resolveSelectedChildren,
} from "../src/utils/patientInfoSubmit.js";
import { assertCanCancelReservation } from "../src/utils/reservationTransitions.js";

const children = [
  { id: "c1", childName: "Ada", age: "4", sex: "Female" },
  { id: "c2", childName: "Ben", age: "7", sex: "Male" },
];

describe("preparePatientInfoSubmit (Save Information)", () => {
  it("blocks when no reservation id (keep modal; no toast)", () => {
    const result = preparePatientInfoSubmit({
      activeReservationId: null,
      savedChildren: children,
      selectedChildIds: ["c1"],
    });
    assert.equal(result.ok, false);
    assert.equal(result.reason, "no_reservation");
    assert.equal(result.messageModal, undefined);
  });

  it("blocks when already submitting", () => {
    const result = preparePatientInfoSubmit({
      activeReservationId: "res-1",
      submitting: true,
      savedChildren: children,
      selectedChildIds: ["c1"],
    });
    assert.equal(result.ok, false);
    assert.equal(result.reason, "busy");
  });

  it("surfaces MessageModal when no child is selected (failure keeps modal open)", () => {
    const result = preparePatientInfoSubmit({
      activeReservationId: "res-1",
      savedChildren: children,
      selectedChildIds: [],
    });
    assert.equal(result.ok, false);
    assert.equal(result.reason, "no_selection");
    assert.deepEqual(result.messageModal, {
      isOpen: true,
      ...NO_CHILD_SELECTED_MESSAGE,
    });
  });

  it("surfaces MessageModal when profiles exist but selection is empty", () => {
    const result = preparePatientInfoSubmit({
      activeReservationId: "res-1",
      savedChildren: children,
      selectedChildIds: ["missing"],
    });
    assert.equal(result.ok, false);
    assert.equal(result.reason, "no_selection");
    assert.ok(result.messageModal?.isOpen);
  });

  it("success path returns selected children for updatePatientInfo payload", () => {
    const result = preparePatientInfoSubmit({
      activeReservationId: "res-1",
      savedChildren: children,
      selectedChildIds: ["c2"],
    });
    assert.equal(result.ok, true);
    assert.deepEqual(result.selected, [children[1]]);
    const payload = buildPatientInfoPayload(result.selected, "fever");
    assert.equal(payload.childName, "Ben");
    assert.equal(payload.concern, "fever");
    assert.equal(payload.children.length, 1);
  });
});

describe("patient info modal UI transitions", () => {
  it("success closes Select Patients and opens success modal", () => {
    assert.deepEqual(patientInfoSubmitSuccessState(), {
      isPatientInfoModalOpen: false,
      isSuccessModalOpen: true,
    });
  });

  it("update failure message keeps Select Patients open (caller does not close)", () => {
    assert.equal(PATIENT_INFO_UPDATE_FAILED_MESSAGE.type, "error");
    assert.match(PATIENT_INFO_UPDATE_FAILED_MESSAGE.message, /try again/i);
    // Success state is the only path that flips isPatientInfoModalOpen false on save.
    assert.equal(patientInfoSubmitSuccessState().isPatientInfoModalOpen, false);
  });

  it("Cancel Reservation success clears reservation and closes modal", () => {
    const cleared = patientInfoCancelSuccessState();
    assert.equal(cleared.activeReservationId, null);
    assert.equal(cleared.isPatientInfoModalOpen, false);
    assert.equal(cleared.isAddChildOpen, false);
    assert.deepEqual(cleared.selectedChildIds, []);
    assert.equal(cleared.concern, "");
  });

  it("Cancel Reservation is a real cancel gate while reserved", () => {
    const gate = assertCanCancelReservation(
      { status: "reserved", parentId: "p1" },
      { actorUid: "p1", actorRole: "parent" }
    );
    assert.equal(gate.ok, true);
    assert.equal(PATIENT_INFO_CANCEL_FAILED_MESSAGE.type, "error");
  });

  it("resolveSelectedChildren filters by id", () => {
    assert.deepEqual(resolveSelectedChildren(children, ["c1", "c2"]), children);
    assert.deepEqual(resolveSelectedChildren(children, []), []);
  });
});
