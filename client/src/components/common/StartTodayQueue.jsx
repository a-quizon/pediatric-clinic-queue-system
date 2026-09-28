import { useState } from "react";
import { CalendarDays, Clock, MapPin, Play } from "lucide-react";
import toast from "react-hot-toast";
import { updateQueueStatus } from "../../services/scheduleService";
import {
  manilaDateString,
  manilaNowMinutes,
  addManilaDays,
  formatManilaLong,
  formatManilaWeekday,
} from "../../utils/manilaDate";
import {
  anyQueueLive,
  schedulesStartable,
  groupStartableByDate,
  isStartBeforeHours,
  formatClinicClock,
  startQueueConfirmMessage,
} from "../../utils/scheduleCalendar";
import { scheduleMatchesAssignedBranch, formatBranchLabel } from "../../utils/stringUtils";
import ConfirmationModal from "./ConfirmationModal";

function dateChipLabel(dateStr, today) {
  if (dateStr === today) return "Today";
  if (dateStr === addManilaDays(today, 1)) return "Tomorrow";
  return `${formatManilaWeekday(dateStr).slice(0, 3)} ${formatManilaLong(dateStr).replace(/,\s*\d{4}$/, "")}`;
}

function hoursLabel(schedule) {
  const open = formatClinicClock(schedule?.openingTime);
  const close = formatClinicClock(schedule?.closingTime);
  if (open && close) return `${open} – ${close}`;
  return open || close || "Clinic hours not set";
}

/**
 * Start Queue for the nearest published session (today or upcoming), with a
 * date switcher when several dates are ready. Starting is allowed at any time
 * of day; only the session's own state and the one-live-queue rule gate it.
 */
export default function StartTodayQueue({ schedules, user, limitToAssignedBranch = false, onStarted }) {
  const [busyId, setBusyId] = useState(null);
  const [pending, setPending] = useState(null);
  const [chosenDate, setChosenDate] = useState(null);
  const today = manilaDateString();
  const startable = schedulesStartable(schedules, today).filter((schedule) =>
    limitToAssignedBranch ? scheduleMatchesAssignedBranch(schedule, user) : true
  );
  const { dates, byDate, defaultDate } = groupStartableByDate(startable);
  const selectedDate = chosenDate && byDate[chosenDate] ? chosenDate : defaultDate;
  const sessions = selectedDate ? byDate[selectedDate] : [];

  const start = async (schedule) => {
    setBusyId(schedule.id);
    try {
      await updateQueueStatus(schedule.id, "active");
      toast.success("Clinic queue has been started.");
      setPending(null);
      if (onStarted) onStarted(schedule);
    } catch (error) {
      toast.error(error.message || "Could not start the queue.");
    } finally {
      setBusyId(null);
    }
  };

  const confirmMessage = (schedule) => {
    const base = startQueueConfirmMessage(schedule, {
      formatDate: formatManilaLong,
      formatBranch: formatBranchLabel,
    });
    return isStartBeforeHours(schedule, today, manilaNowMinutes())
      ? `${base}\n\nStarting before scheduled hours. The actual start time is recorded separately.`
      : base;
  };

  if (startable.length === 0) {
    const blockedByLive = anyQueueLive(schedules);
    return (
      <p className="pq-muted text-sm mb-4" role="status">
        {blockedByLive
          ? "Another clinic queue is still running. Complete it before starting the next session."
          : "No upcoming sessions. Publish reservation slots to start a queue."}
      </p>
    );
  }

  return (
    <>
      <div className="flex flex-col items-center gap-3 mb-4 w-full">
        {dates.length > 1 && (
          <div className="pq-tablist mx-auto" role="tablist" aria-label="Session date">
            {dates.map((dateStr) => (
              <button
                key={dateStr}
                type="button"
                role="tab"
                className="pq-tab"
                aria-selected={dateStr === selectedDate}
                onClick={() => setChosenDate(dateStr)}
              >
                {dateChipLabel(dateStr, today)}
              </button>
            ))}
          </div>
        )}

        {sessions.map((schedule) => (
          <div
            key={schedule.id}
            className="w-full max-w-sm rounded-xl p-4 text-left"
            style={{ border: "1px solid var(--pq-glass-line)" }}
          >
            <div className="text-sm space-y-1 mb-3">
              <div className="flex items-center gap-2 font-extrabold">
                <CalendarDays className="w-4 h-4" aria-hidden="true" />
                {schedule.clinicDate === today ? "Today · " : ""}
                {formatManilaLong(schedule.clinicDate)}
              </div>
              <div className="flex items-center gap-2 pq-muted">
                <MapPin className="w-4 h-4" aria-hidden="true" />
                {formatBranchLabel(schedule.branch)}
              </div>
              <div className="flex items-center gap-2 pq-muted">
                <Clock className="w-4 h-4" aria-hidden="true" />
                {hoursLabel(schedule)}
              </div>
            </div>
            <button
              type="button"
              data-tour="queue-start"
              className="pq-btn-live w-full justify-center"
              disabled={Boolean(busyId)}
              onClick={() => setPending(schedule)}
            >
              <Play className="w-4 h-4" aria-hidden="true" />
              Start Queue
            </button>
          </div>
        ))}
      </div>

      <ConfirmationModal
        isOpen={Boolean(pending)}
        title="Start this queue?"
        message={pending ? confirmMessage(pending) : ""}
        confirmText="Start Queue"
        cancelText="Cancel"
        onConfirm={() => pending && start(pending)}
        onClose={() => !busyId && setPending(null)}
        isLoading={Boolean(busyId)}
      />
    </>
  );
}
