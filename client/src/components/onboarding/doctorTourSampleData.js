function toYmd(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function upcomingWeekday(targetDow) {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  const add = (targetDow - d.getDay() + 7) % 7;
  d.setDate(d.getDate() + add);
  return d;
}

export function formatDoctorSampleTime(time) {
  if (!time) return "";
  const [hours, minutes] = time.split(":");
  const h = parseInt(hours, 10);
  const ampm = h >= 12 ? "PM" : "AM";
  const formattedH = h % 12 || 12;
  return `${formattedH}:${minutes} ${ampm}`;
}

export function formatDoctorSampleDate(ymd, options) {
  const date = new Date(`${ymd}T12:00:00`);
  return date.toLocaleDateString("en-US", options);
}

export function getDoctorTourSampleSchedule() {
  const saturday = upcomingWeekday(6);
  return {
    id: "tour-sample-doctor-schedule",
    branch: "Sample Branch",
    clinicDate: toYmd(saturday),
    openingTime: "09:00",
    closingTime: "12:00",
    slotCapacity: 20,
    availableSlots: 16,
    queueStatus: "active",
    status: "draft",
    address: "Sample address — tour only",
  };
}

export function getDoctorTourSampleQueue() {
  return {
    branch: "Sample Branch",
    clinicDate: toYmd(upcomingWeekday(6)),
    inConsultation: {
      id: "tour-doc-consult-1",
      queueNumber: "01",
      childName: "Ana Santos",
      age: "4",
      sex: "Female",
      source: "reserved",
      concern: "Fever and cough (sample)",
    },
    waiting: [
      {
        id: "tour-doc-wait-1",
        queueNumber: "02",
        childName: "Luis Cruz",
        source: "walk_in",
        status: "checked_in",
        checkedInAt: Date.now() - 18 * 60 * 1000,
      },
      {
        id: "tour-doc-wait-2",
        queueNumber: "03",
        childName: "Mia Reyes",
        source: "reserved",
        status: "reserved",
      },
    ],
  };
}

export const DOCTOR_TOUR_SAMPLE_NOTES =
  "Mild viral illness. Rest, fluids, follow up if fever persists. (sample)";

export function getDoctorTourSampleDashboard() {
  return {
    branch: "Sample Branch",
    clinicDate: toYmd(upcomingWeekday(6)),
    openingTime: "09:00",
    closingTime: "12:00",
    queueStatus: "active",
    stats: {
      total: 12,
      waiting: 4,
      checkedIn: 2,
      inConsultation: 1,
      completed: 3,
      cancelled: 1,
      forfeited: 1,
    },
  };
}

export function getDoctorTourSampleUsers() {
  return {
    secretary: {
      id: "tour-sample-secretary",
      name: "Maria Lopez",
      email: "sample.secretary@example.com",
      role: "secretary",
      status: "active",
      assignedBranch: "Sample Branch",
      contactNumber: "+639171234567",
    },
    parent: {
      id: "tour-sample-parent",
      name: "Jose Rivera",
      email: "sample.parent@example.com",
      role: "parent",
      status: "active",
      contactNumber: "+639189876543",
    },
  };
}

export function getDoctorTourSampleAudit() {
  const saturday = upcomingWeekday(6);
  const clinicDate = toYmd(saturday);
  return {
    filters: {
      category: "All Categories",
      role: "All Roles",
    },
    suspicious: {
      id: "tour-sample-audit-suspicious",
      action: "ACCOUNT_FLAGGED_SUSPICIOUS",
      badge: "Suspicious",
      category: "user",
      actorRole: "system",
      actorName: "System",
      description: "Parent account flagged for review (sample)",
      recommendation:
        "Jose Rivera is suspicious based on reservation patterns without QR validation. Consider deactivating this account.",
      evidence: [
        { clinicDate, kind: "no_show", status: "forfeited", reservationId: "tour-res-1" },
        { clinicDate, kind: "no_show", status: "expired", reservationId: "tour-res-2" },
      ],
      timestamp: Date.now() - 2 * 60 * 60 * 1000,
    },
  };
}

export function getDoctorTourSampleReports() {
  const saturday = upcomingWeekday(6);
  const clinicDate = toYmd(saturday);
  return {
    branch: "All Branches",
    dateRange: "This Year",
    totals: {
      totalReservations: 24,
      checkedUp: 18,
      cancelled: 3,
      forfeited: 3,
      completionRate: 75,
    },
    trend: [
      { date: "Jan", reservations: 6 },
      { date: "Apr", reservations: 8 },
      { date: "Jul", reservations: 10 },
    ],
    outcomes: [
      { name: "Checked Up", value: 18, color: "#0f7a5a" },
      { name: "Cancelled", value: 3, color: "#b4232c" },
      { name: "Forfeited", value: 3, color: "#9a5b12" },
    ],
    session: {
      id: "tour-doc-session-1",
      clinicDate,
      openingTime: "9:00 AM",
      closingTime: "12:00 PM",
      branch: "Sample Branch",
      metrics: {
        totalReservations: 8,
        checkedUp: 6,
        cancelled: 1,
        forfeited: 1,
        completionRate: 75,
      },
    },
    consultation: {
      childName: "Ana Santos",
      source: "reserved",
      notes: DOCTOR_TOUR_SAMPLE_NOTES,
    },
  };
}
