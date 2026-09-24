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

export const TOUR_SAMPLE_WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Compact sample month grid for the parent Reserve calendar tour. */
export function getParentTourSampleCalendarCells(clinicDateYmd) {
  const focusDay = Number(clinicDateYmd.slice(-2)) || 12;
  const cells = [null, null, null, null, null, null];
  for (let day = focusDay - 5; day <= focusDay + 8; day += 1) {
    if (day < 1) {
      cells.push(null);
      continue;
    }
    if (day === focusDay) {
      cells.push({
        day,
        label: "Open",
        kind: "available",
        highlight: true,
        style: { background: "var(--pq-live-wash)", color: "var(--pq-live)" },
      });
    } else if (day === focusDay - 2) {
      cells.push({
        day,
        label: "Full",
        kind: "full",
        style: { background: "var(--pq-alert-wash)", color: "var(--pq-alert)" },
      });
    } else if (day === focusDay + 2) {
      cells.push({
        day,
        label: "Closed",
        kind: "closed",
        style: { background: "var(--pq-wait-wash)", color: "var(--pq-wait)" },
      });
    } else if (day < focusDay) {
      cells.push({ day, label: "", kind: "past" });
    } else {
      cells.push({ day, label: "", kind: "not_posted" });
    }
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}
