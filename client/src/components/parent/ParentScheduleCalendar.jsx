import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { subscribeToClinicClosures } from "../../services/scheduleCalendarService";
import { formatBranchLabel, branchesMatch } from "../../utils/stringUtils";
import {
  manilaDateString,
  bookingHorizonEnd,
  manilaMonthMeta,
  shiftMonth,
  formatManilaMonth,
  formatManilaLong,
  eachDateInclusive,
} from "../../utils/manilaDate";
import { closureAnnouncement } from "../../utils/closureReasons";
import {
  closureForDate,
  scheduleForDate,
  slotsTaken,
  sameBranch,
  parentCellKind,
  queueHasEnded,
} from "../../utils/scheduleCalendar";
import {
  ACTIVE_RESERVATION_STATUSES,
  getActiveUpcomingDates,
} from "../../services/reservationService";

const BRANCH_KEY = "pq-reserve-branch-id";
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatTime(time) {
  if (!time) return "";
  const [hours, minutes] = time.split(":");
  const hour = parseInt(hours, 10);
  const suffix = hour >= 12 ? "PM" : "AM";
  return `${hour % 12 || 12}:${minutes} ${suffix}`;
}

export default function ParentScheduleCalendar({
  branches,
  schedules,
  reservations,
  capacityMap,
  onReserve,
  onMessage,
}) {
  const today = manilaDateString();
  const horizon = bookingHorizonEnd(today);
  const [cursor, setCursor] = useState(() => {
    const [year, month] = today.split("-").map(Number);
    return { year, monthIndex: month - 1 };
  });
  const [chosenBranchId, setChosenBranchId] = useState(() => localStorage.getItem(BRANCH_KEY) || "");
  const [closures, setClosures] = useState([]);

  useEffect(() => subscribeToClinicClosures(setClosures), []);

  const branch = branches.find((item) => item.id === chosenBranchId)
    || branches.find((item) => branchesMatch(item.name, "Angeles"))
    || branches[0]
    || null;
  const branchSchedules = schedules.filter((schedule) => sameBranch(schedule, branch?.id, branch?.name));

  const month = useMemo(
    () => manilaMonthMeta(cursor.year, cursor.monthIndex),
    [cursor.year, cursor.monthIndex]
  );
  const cells = useMemo(() => {
    const dates = eachDateInclusive(month.first, month.last);
    return [...Array(month.leadBlanks).fill(null), ...dates];
  }, [month]);

  const activeToday = branchSchedules.find(
    (schedule) =>
      schedule.clinicDate === today &&
      !schedule.dayClosed &&
      (schedule.queueStatus === "active" || schedule.queueStatus === "paused")
  );
  const parentTicket = reservations.find(
    (reservation) => reservation.scheduleId === activeToday?.id && ACTIVE_RESERVATION_STATUSES.includes(reservation.status)
  );

  const schedulesById = useMemo(() => {
    const map = {};
    schedules.forEach((schedule) => {
      map[schedule.id] = schedule;
    });
    return map;
  }, [schedules]);

  const ownedDates = useMemo(
    () => getActiveUpcomingDates(reservations, schedulesById),
    [reservations, schedulesById]
  );

  const nextSession = branchSchedules
    .filter((schedule) =>
      schedule.status === "published" &&
      !schedule.dayClosed &&
      !closureForDate(closures, schedule.clinicDate, branch?.id, branch?.name) &&
      !queueHasEnded(schedule) &&
      schedule.clinicDate >= today &&
      schedule.clinicDate <= horizon &&
      schedule.id !== activeToday?.id
    )
    .sort((a, b) => a.clinicDate.localeCompare(b.clinicDate))[0];

  const chooseBranch = (id) => {
    setChosenBranchId(id);
    localStorage.setItem(BRANCH_KEY, id);
  };

  const openDate = (dateStr) => {
    const schedule = scheduleForDate(branchSchedules, dateStr, branch?.id, branch?.name);
    const closure = closureForDate(closures, dateStr, branch?.id, branch?.name);
    const taken = schedule?.booking?.activeSlotCount != null
      ? Number(schedule.booking.activeSlotCount)
      : (capacityMap?.[schedule?.id] ?? slotsTaken(schedule, reservations));
    const owned = ownedDates.has(dateStr);
    const kind = parentCellKind({
      dateStr,
      today,
      horizonEnd: horizon,
      schedule: closure ? { ...schedule, dayClosed: true } : schedule,
      closure,
      taken,
      owned,
    });
    if (kind === "owned") {
      onMessage({
        type: "info",
        title: "Your reservation",
        message: "You already have a reservation on this date.",
      });
      return;
    }
    if (kind === "available" && schedule) {
      onReserve(schedule);
      return;
    }
    if (kind === "full") {
      onMessage({ type: "error", title: "Slots Full", message: "This schedule is already full." });
      return;
    }
    if (kind === "closed") {
      onMessage({
        type: "warning",
        title: "Clinic Closed",
        message: closureAnnouncement(closure?.reason || schedule?.closureReason, closure?.note || schedule?.closureNote),
      });
    }
  };

  return (
    <div className="space-y-4" data-tour="reserve-schedule-calendar">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 className="text-lg font-extrabold tracking-tight">Reserve a slot</h2>
        <select
          className="pq-input sm:max-w-xs"
          aria-label="Clinic branch"
          value={branch?.id || ""}
          onChange={(event) => chooseBranch(event.target.value)}
        >
          {branches.map((item) => (
            <option key={item.id} value={item.id}>{formatBranchLabel(item.name)}</option>
          ))}
        </select>
      </div>

      <section className="pq-glass p-4">
        <p className="pq-stat-label mb-1">Current active queue for today</p>
        {activeToday ? (
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-extrabold">{formatBranchLabel(activeToday.branch)}</p>
              <p className="pq-muted text-sm">
                {activeToday.queueStatus === "paused" ? "Paused" : "Open"} · {formatTime(activeToday.openingTime)} – {formatTime(activeToday.closingTime)}
              </p>
              {parentTicket ? (
                <p className="text-sm mt-1">Your queue number is {parentTicket.queueNumber}.</p>
              ) : null}
            </div>
            {parentTicket ? <Link to="/parent" className="pq-btn-secondary text-sm">View queue</Link> : null}
          </div>
        ) : (
          <p className="pq-muted text-sm">No active queue right now.</p>
        )}
      </section>

      <section className="pq-glass p-4">
        <p className="pq-stat-label mb-1">Next queue session</p>
        {nextSession ? (
          <p className="font-semibold">
            {nextSession.clinicDate === today ? "Today" : formatManilaLong(nextSession.clinicDate)}
            {" · "}
            {formatTime(nextSession.openingTime)} – {formatTime(nextSession.closingTime)}
          </p>
        ) : (
          <p className="pq-muted text-sm">No upcoming session.</p>
        )}
      </section>

      <section className="pq-glass p-4" data-tour="reserve-schedule-list">
        <div className="flex items-center justify-between mb-3">
          <button type="button" className="pq-btn-secondary" aria-label="Previous month" onClick={() => setCursor((current) => shiftMonth(current.year, current.monthIndex, -1))}>
            <ChevronLeft className="w-4 h-4" />
          </button>
          <h3 className="font-extrabold">{formatManilaMonth(cursor.year, cursor.monthIndex)}</h3>
          <button type="button" className="pq-btn-secondary" aria-label="Next month" onClick={() => setCursor((current) => shiftMonth(current.year, current.monthIndex, 1))}>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <div className="flex flex-wrap gap-3 text-xs font-semibold mb-3">
          <span style={{ color: "var(--pq-live)" }}>Green: slots left</span>
          <span style={{ color: "var(--pq-alert)" }}>Red: full</span>
          <span style={{ color: "var(--pq-mark-blue)" }}>Your reservation</span>
          <span style={{ color: "var(--pq-wait)" }}>Closed</span>
          <span className="pq-muted">Muted: no session or past</span>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold pq-muted mb-1">
          {WEEKDAYS.map((label) => <div key={label}>{label}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((dateStr, index) => {
            if (!dateStr) return <div key={`blank-${index}`} />;
            const schedule = scheduleForDate(branchSchedules, dateStr, branch?.id, branch?.name);
            const closure = closureForDate(closures, dateStr, branch?.id, branch?.name);
            const taken = schedule?.booking?.activeSlotCount != null
              ? Number(schedule.booking.activeSlotCount)
              : (capacityMap?.[schedule?.id] ?? 0);
            const kind = parentCellKind({
              dateStr,
              today,
              horizonEnd: horizon,
              schedule: closure ? { ...schedule, dayClosed: true, status: schedule?.status || "published" } : schedule,
              closure,
              taken,
              owned: ownedDates.has(dateStr),
            });
            const clickable = kind === "available" || kind === "full" || kind === "closed" || kind === "owned";
            const style = {
              available: { background: "var(--pq-live-wash)", color: "var(--pq-live)" },
              full: { background: "var(--pq-alert-wash)", color: "var(--pq-alert)" },
              closed: { background: "var(--pq-wait-wash)", color: "var(--pq-wait)" },
              owned: { background: "color-mix(in srgb, var(--pq-mark-blue) 16%, white)", color: "var(--pq-mark-blue)" },
            }[kind] || { background: "transparent", color: "var(--pq-ink-faint)" };
            const labels = {
              available: "Open",
              full: "Full",
              closed: "Closed",
              owned: "Yours",
              ended: "Ended",
              past: "",
              not_posted: "",
            };
            const Tag = clickable ? "button" : "div";
            return (
              <Tag
                key={dateStr}
                type={clickable ? "button" : undefined}
                onClick={clickable ? () => openDate(dateStr) : undefined}
                className="min-h-14 rounded-xl text-left p-1.5"
                style={{ ...style, border: "1px solid var(--pq-glass-line)" }}
                aria-label={`${formatManilaLong(dateStr)} ${labels[kind] || "No session"}`}
              >
                <div className="text-sm font-extrabold">{Number(dateStr.slice(-2))}</div>
                <div className="text-[10px] leading-tight font-semibold">{labels[kind]}</div>
              </Tag>
            );
          })}
        </div>
      </section>
    </div>
  );
}
