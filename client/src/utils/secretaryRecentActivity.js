import { getReservationChildDisplayName } from "./reservationPatients.js";

/**
 * Activity rows for the secretary Dashboard "Recent Activity" feed.
 * Keys are stable so in-app toasts can notify once per event without push.
 *
 * @param {Array<object>} reservations
 * @returns {Array<{ key: string, time: number, text: string, kind: string, severity: string, title: string }>}
 */
export function buildSecretaryRecentActivities(reservations = []) {
  const activities = [];

  (reservations || []).forEach((res) => {
    if (!res?.id) return;
    const name = getReservationChildDisplayName(res, "Patient");

    if (res.createdAt) {
      activities.push({
        key: `reserved_${res.id}_${res.createdAt}`,
        time: res.createdAt,
        kind: "reserved",
        title: "New Reservation",
        text: "Parent/Guardian reserved a slot.",
        severity: "success",
      });
    }
    if (res.checkedInAt) {
      activities.push({
        key: `checked_in_${res.id}_${res.checkedInAt}`,
        time: res.checkedInAt,
        kind: "checked_in",
        title: "Checked In",
        text: `${name} checked in`,
        severity: "success",
      });
    }
    if (res.sentToDoctorAt) {
      activities.push({
        key: `sent_to_doctor_${res.id}_${res.sentToDoctorAt}`,
        time: res.sentToDoctorAt,
        kind: "sent_to_doctor",
        title: "Sent to Doctor",
        text: `${name} sent to Doctor`,
        severity: "info",
      });
    }
    if (res.consultationCompletedAt) {
      activities.push({
        key: `consultation_completed_${res.id}_${res.consultationCompletedAt}`,
        time: res.consultationCompletedAt,
        kind: "consultation_completed",
        title: "Consultation Completed",
        text: `${name} consultation completed`,
        severity: "success",
      });
    }
    if (res.cancelledAt) {
      activities.push({
        key: `cancelled_${res.id}_${res.cancelledAt}`,
        time: res.cancelledAt,
        kind: "cancelled",
        title: "Reservation Cancelled",
        text: `${name} cancelled reservation`,
        severity: "warning",
      });
    }
    if (res.forfeitedAt) {
      activities.push({
        key: `forfeited_${res.id}_${res.forfeitedAt}`,
        time: res.forfeitedAt,
        kind: "forfeited",
        title: "Forfeited",
        text: `${name} was forfeited`,
        severity: "error",
      });
    }
    const penalizedAt = res.lastPenalizedAt || res.penalizedAt;
    if (penalizedAt) {
      activities.push({
        key: `penalized_${res.id}_${penalizedAt}`,
        time: penalizedAt,
        kind: "penalized",
        title: "Penalty Applied",
        text: `${name} penalized`,
        severity: "warning",
      });
    }
  });

  activities.sort((a, b) => b.time - a.time);
  return activities;
}
