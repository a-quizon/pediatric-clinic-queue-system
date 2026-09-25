/**
 * Pure helpers for the post-claim Select Patients modal (ReserveQueue).
 * Kept free of React/Firebase so submit/cancel UI transitions are unit-testable.
 */

export const NO_CHILD_SELECTED_MESSAGE = {
  type: "error",
  title: "Select a Patient",
  message: "Select at least one child for this reservation before saving.",
};

export const PATIENT_INFO_UPDATE_FAILED_MESSAGE = {
  type: "error",
  title: "Update Failed",
  message: "Could not save patient information. Please try again.",
};

export const PATIENT_INFO_CANCEL_FAILED_MESSAGE = {
  type: "error",
  title: "Cancellation Failed",
  message: "There was an error cancelling your reservation. Please try again.",
};

export function resolveSelectedChildren(savedChildren, selectedChildIds) {
  const ids = selectedChildIds || [];
  return (savedChildren || []).filter((child) => ids.includes(child.id));
}

/**
 * Decide whether Save Information may proceed.
 * @returns {{ ok: true, selected: object[] } | { ok: false, reason: string, messageModal?: object }}
 */
export function preparePatientInfoSubmit({
  activeReservationId,
  submitting = false,
  savedChildren,
  selectedChildIds,
}) {
  if (!activeReservationId) {
    return { ok: false, reason: "no_reservation" };
  }
  if (submitting) {
    return { ok: false, reason: "busy" };
  }
  const selected = resolveSelectedChildren(savedChildren, selectedChildIds);
  if (selected.length === 0) {
    return {
      ok: false,
      reason: "no_selection",
      messageModal: { isOpen: true, ...NO_CHILD_SELECTED_MESSAGE },
    };
  }
  return { ok: true, selected };
}

/** UI state after a successful patient-info save. */
export function patientInfoSubmitSuccessState() {
  return {
    isPatientInfoModalOpen: false,
    isSuccessModalOpen: true,
  };
}

/**
 * UI state after Cancel Reservation succeeds (slot cancelled on the server).
 * Clears local reservation context and closes the Select Patients modal.
 */
export function patientInfoCancelSuccessState() {
  return {
    activeReservationId: null,
    generatedQueuePosition: null,
    selectedSchedule: null,
    selectedChildIds: [],
    concern: "",
    isAddChildOpen: false,
    isPatientInfoModalOpen: false,
  };
}
