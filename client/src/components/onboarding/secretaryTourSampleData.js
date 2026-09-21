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

export function formatSecretarySampleTime(time) {
  if (!time) return "";
  const [hours, minutes] = time.split(":");
  const h = parseInt(hours, 10);
  const ampm = h >= 12 ? "PM" : "AM";
  const formattedH = h % 12 || 12;
  return `${formattedH}:${minutes} ${ampm}`;
}

export function formatSecretarySampleDate(ymd, options) {
  const date = new Date(`${ymd}T12:00:00`);
  return date.toLocaleDateString("en-US", options);
}

export function getSecretaryTourSampleSchedule() {
  const saturday = upcomingWeekday(6);
  return {
    id: "tour-sample-secretary-schedule",
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

export function getSecretaryTourSampleQueue() {
  return {
    queueStartedAt: Date.now() - 42 * 60 * 1000,
    waiting: [
      {
        id: "tour-sec-wait-1",
        queueNumber: "01",
        childName: "Ana Santos",
        source: "reserved",
        status: "reserved",
        penalize: true,
      },
      {
        id: "tour-sec-wait-2",
        queueNumber: "02",
        childName: "Luis Cruz",
        source: "walk_in",
        status: "checked_in",
      },
      {
        id: "tour-sec-wait-3",
        queueNumber: "03",
        childName: "Mia Reyes",
        source: "reserved",
        status: "reserved",
        forfeitLabel: "Forfeit in 04:12",
      },
    ],
  };
}

export const SECRETARY_TOUR_SAMPLE_WALKIN = {
  scheduleLabel: "Sample Branch · Sat, 9:00 AM – 12:00 PM — Active Now",
  parentName: "Maria Santos",
  parentPhone: "9123456789",
  childCount: "1",
  childName: "Ana Santos",
  childAge: "4",
  childSex: "Female",
  concern: "Fever and cough (sample)",
};

export const SECRETARY_TOUR_SAMPLE_CODE = "SAMPLE";
