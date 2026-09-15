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

export function formatSampleTime(time) {
  if (!time) return "";
  const [hours, minutes] = time.split(":");
  const h = parseInt(hours, 10);
  const ampm = h >= 12 ? "PM" : "AM";
  const formattedH = h % 12 || 12;
  return `${formattedH}:${minutes} ${ampm}`;
}

export function formatSampleDate(ymd, options) {
  const date = new Date(`${ymd}T12:00:00`);
  return date.toLocaleDateString("en-US", options);
}

export function getTourSampleSchedules() {
  const saturday = upcomingWeekday(6);
  const sunday = upcomingWeekday(0);

  return [
    {
      id: "tour-sample-angeles",
      branch: "Angeles",
      clinicDate: toYmd(saturday),
      openingTime: "09:00",
      closingTime: "12:00",
      slotCapacity: 20,
      availableSlots: 14,
      address: "Sample address — Angeles City (tour only)",
    },
    {
      id: "tour-sample-magalang",
      branch: "Magalang",
      clinicDate: toYmd(sunday),
      openingTime: "13:00",
      closingTime: "16:00",
      slotCapacity: 20,
      availableSlots: 11,
      address: "Sample address — Magalang (tour only)",
    },
  ];
}

export function getTourSampleQueue() {
  const saturday = getTourSampleSchedules()[0];
  return {
    branch: "Sample Branch",
    address: "Tour placeholder — not a real clinic visit",
    clinicDate: saturday.clinicDate,
    openingTime: "9:00 AM – 12:00 PM",
    queueNumber: "00",
    patientsAhead: 3,
    nowServing: "12",
    waiting: [
      { id: "tour-wait-13", pNum: "13", you: false },
      { id: "tour-wait-14", pNum: "14", you: false },
      { id: "tour-wait-00", pNum: "00", you: true },
      { id: "tour-wait-01", pNum: "01", you: false },
    ],
  };
}

export function getTourSampleTicket() {
  const saturday = getTourSampleSchedules()[0];
  return {
    branch: "Sample Branch",
    clinicDate: saturday.clinicDate,
    openingTime: saturday.openingTime,
    closingTime: saturday.closingTime,
    queueNumber: "00",
    reservationCode: "SAMPLE",
  };
}

export const TOUR_SAMPLE_CHILD = {
  id: "tour-sample-child",
  childName: "Sample Child",
  age: "4 yrs",
  sex: "Female",
};

export const TOUR_SAMPLE_CONCERN = "Fever and cough (sample)";
