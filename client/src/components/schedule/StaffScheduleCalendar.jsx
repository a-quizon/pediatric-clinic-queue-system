import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, Play } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "../../hooks/useAuth";
import { getDefaultSlotCapacity } from "../../services/systemConfigurationService";
import { updateQueueStatus } from "../../services/scheduleService";
import {
  subscribeToClinicClosures,
  previewPublishDates,
  publishSingleDay,
  publishDateRange,
  copyPreviousWeek,
  previewClosure,
  applyClosure,
  removeClosure,
} from "../../services/scheduleCalendarService";
import { branchesMatch, formatBranchLabel } from "../../utils/stringUtils";
import {
  manilaDateString,
  addManilaDays,
  bookingHorizonEnd,
  manilaMonthMeta,
  shiftMonth,
  formatManilaMonth,
  formatManilaLong,
  weekStartSunday,
  eachDateInclusive,
  WEEKDAY_KEYS,
  manilaWeekdayIndex,
} from "../../utils/manilaDate";
import { CLOSURE_REASONS, closureAnnouncement } from "../../utils/closureReasons";
import {
  closureForDate,
  scheduleForDate,
  slotsTaken,
  queueHasEnded,
  startQueueConfirmMessage,
} from "../../utils/scheduleCalendar";
import ConfirmationModal from "../common/ConfirmationModal";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const LIVE_QUEUE_STATUSES = ["active", "paused", "closed"];

export default function StaffScheduleCalendar({
  branches,
  schedules,
  reservations,
  lockBranch,
  onChanged,
  queuePath,
}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const today = manilaDateString();
  const horizon = bookingHorizonEnd(today);
  const [cursor, setCursor] = useState(() => {
    const [year, month] = today.split("-").map(Number);
    return { year, monthIndex: month - 1 };
  });
  const [chosenBranchId, setChosenBranchId] = useState("");
  const [closures, setClosures] = useState([]);
  const [defaultCapacity, setDefaultCapacity] = useState(30);
  const [dayModal, setDayModal] = useState(null);
  const [rangeOpen, setRangeOpen] = useState(false);
  const [rangeForm, setRangeForm] = useState({ start: today, end: addManilaDays(today, 6), capacity: "30" });
  const [closeForm, setCloseForm] = useState({
    reason: "emergency",
    note: "",
    endDate: today,
    allBranches: false,
  });
  const [closingMode, setClosingMode] = useState(false);
  const [previewText, setPreviewText] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(null);

  useEffect(() => subscribeToClinicClosures(setClosures), []);

  const lockedBranch = lockBranch
    ? branches.find(
      (item) =>
        (user?.assignedBranchId && item.id === user.assignedBranchId) ||
        branchesMatch(item.name, user?.assignedBranch)
    ) || branches[0]
    : null;
  const branch = lockedBranch || branches.find((item) => item.id === chosenBranchId) || branches[0] || null;

  useEffect(() => {
    if (!branch?.id) return;
    getDefaultSlotCapacity(branch.id).then((value) => {
      setDefaultCapacity(value);
      setRangeForm((form) => ({ ...form, capacity: String(value) }));
    });
  }, [branch?.id]);

  const month = useMemo(
    () => manilaMonthMeta(cursor.year, cursor.monthIndex),
    [cursor.year, cursor.monthIndex]
  );
  const cells = useMemo(() => {
    const dates = eachDateInclusive(month.first, month.last);
    return [...Array(month.leadBlanks).fill(null), ...dates];
  }, [month]);

  const refresh = async () => {
    if (onChanged) await onChanged();
  };

  const closeDayModal = () => {
    setDayModal(null);
    setClosingMode(false);
    setCloseForm({ reason: "emergency", note: "", endDate: today, allBranches: false });
  };

  const openDay = (dateStr) => {
    if (dateStr < today) return;
    const schedule = scheduleForDate(schedules, dateStr, branch?.id, branch?.name);
    const closure = closureForDate(closures, dateStr, branch?.id, branch?.name) || (schedule?.dayClosed ? {
      reason: schedule.closureReason,
      note: schedule.closureNote,
      id: schedule.closureId,
      startDate: dateStr,
      endDate: dateStr,
    } : null);

    if (closure) {
      setConfirm({
        title: "Clinic closed",
        message: `${formatManilaLong(dateStr)}\n${closureAnnouncement(closure.reason, closure.note)}${
          closure.startDate > today ? "\n\nRemove this future closure?" : ""
        }`,
        confirmText: closure.startDate > today ? "Remove closure" : "OK",
        destructive: Boolean(closure.startDate > today),
        action: async () => {
          if (closure.startDate > today && closure.id) {
            await removeClosure(closure.id);
            toast.success("Closure removed.");
            await refresh();
          }
        },
      });
      return;
    }

    if (schedule?.status === "draft") {
      toast("This day is still a draft. Post it again from an empty day, or ask an admin if it is stuck.");
      return;
    }

    if (schedule?.status === "published") {
      setClosingMode(false);
      setCloseForm({
        reason: "emergency",
        note: "",
        endDate: dateStr,
        allBranches: false,
      });
      setDayModal({ mode: "published", dateStr, schedule });
      return;
    }

    const weekday = branch?.schedule?.[WEEKDAY_KEYS[manilaWeekdayIndex(dateStr)]];
    if (!weekday?.isOpen || dateStr > horizon) return;
    setDayModal({ mode: "post", dateStr, capacity: String(defaultCapacity) });
  };

  const postDay = async () => {
    if (!branch || !dayModal) return;
    setBusy(true);
    try {
      await publishSingleDay({
        branchId: branch.id,
        branchName: branch.name,
        dateStr: dayModal.dateStr,
        slotCapacity: Number(dayModal.capacity),
        user,
      });
      toast.success(`Posted ${formatManilaLong(dayModal.dateStr)}.`);
      closeDayModal();
      await refresh();
    } catch (error) {
      toast.error(error.message || "Could not post this day.");
    } finally {
      setBusy(false);
    }
  };

  const startQueue = async () => {
    if (!dayModal?.schedule) return;
    setBusy(true);
    try {
      await updateQueueStatus(dayModal.schedule.id, "active");
      toast.success("Clinic queue has been started.");
      closeDayModal();
      await refresh();
      if (queuePath) navigate(queuePath);
    } catch (error) {
      toast.error(error.message || "Could not start the queue.");
    } finally {
      setBusy(false);
    }
  };

  const requestStartQueue = () => {
    if (!dayModal?.schedule) return;
    const schedule = dayModal.schedule;
    setConfirm({
      title: "Start this queue?",
      message: startQueueConfirmMessage(schedule, {
        formatDate: formatManilaLong,
        formatBranch: formatBranchLabel,
      }),
      confirmText: "Start Queue",
      action: startQueue,
    });
  };

  const reviewRange = async () => {
    if (!branch) return;
    setBusy(true);
    try {
      const dates = eachDateInclusive(rangeForm.start, rangeForm.end);
      const preview = await previewPublishDates({
        branchId: branch.id,
        branchName: branch.name,
        dates,
      });
      const posted = preview.filter((item) => !item.skip);
      const skipped = preview.filter((item) => item.skip);
      if (posted.length === 0) {
        toast.error("No days in that range can be posted.");
        return;
      }
      setPreviewText(
        `${posted.length} day(s) will be posted with ${rangeForm.capacity} slots.${
          skipped.length ? ` ${skipped.length} skipped (weekend, already posted, closed, or past).` : ""
        }`
      );
      setConfirm({
        title: "Publish these days?",
        message: `${posted.length} day(s) will be posted with ${rangeForm.capacity} slots.${
          skipped.length ? `\n${skipped.length} skipped (weekend, already posted, closed, or past).` : ""
        }`,
        confirmText: "Publish",
        action: async () => {
          const result = await publishDateRange({
            branchId: branch.id,
            branchName: branch.name,
            startDate: rangeForm.start,
            endDate: rangeForm.end,
            slotCapacity: Number(rangeForm.capacity),
            user,
          });
          toast.success(`Posted ${result.posted.length} day(s).`);
          setRangeOpen(false);
          await refresh();
        },
      });
    } catch (error) {
      toast.error(error.message || "Could not review that range.");
    } finally {
      setBusy(false);
    }
  };

  const reviewCopy = async () => {
    if (!branch) return;
    const weekStart = weekStartSunday(today);
    setConfirm({
      title: "Copy previous week?",
      message: `Posted days from the previous week will be copied onto the week of ${formatManilaLong(weekStart)}, with the same slot counts. Reservations are not copied.`,
      confirmText: "Copy week",
      action: async () => {
        const result = await copyPreviousWeek({
          branchId: branch.id,
          branchName: branch.name,
          weekStart,
          user,
        });
        toast.success(`Copied ${result.posted.length} day(s).`);
        await refresh();
      },
    });
  };

  const reviewCloseDay = async () => {
    if (!branch || !dayModal) return;
    const startDate = dayModal.dateStr;
    const endDate = closeForm.endDate >= startDate ? closeForm.endDate : startDate;
    setBusy(true);
    try {
      const preview = await previewClosure({
        branchId: branch.id,
        branchName: branch.name,
        startDate,
        endDate,
        allBranches: !lockBranch && closeForm.allBranches,
      });
      if (preview.blocking.length > 0) {
        toast.error("Finish or forfeit patients who are already in the clinic before closing.");
        return;
      }
      if (preview.overlaps.length > 0) {
        toast.error("That range overlaps a closure that is already posted.");
        return;
      }
      const count = preview.cancellable.length;
      const dayLabel = startDate === endDate
        ? formatManilaLong(startDate)
        : `${formatManilaLong(startDate)} – ${formatManilaLong(endDate)}`;
      setConfirm({
        title: "Close the clinic?",
        message: `${dayLabel} will be closed. ${count} reservation(s) will be cancelled and those parents can book another date. This does not count as a no-show.`,
        confirmText: "Close clinic",
        destructive: true,
        action: async () => {
          const result = await applyClosure({
            branchId: branch.id,
            branchName: branch.name,
            startDate,
            endDate,
            reason: closeForm.reason,
            note: closeForm.note,
            user,
            allBranches: !lockBranch && closeForm.allBranches,
          });
          toast.success(`Clinic closed. Cancelled ${result.cancelled} reservation(s).`);
          closeDayModal();
          await refresh();
        },
      });
    } catch (error) {
      toast.error(error.message || "Could not close the clinic.");
    } finally {
      setBusy(false);
    }
  };

  const runConfirm = async () => {
    if (!confirm?.action) {
      setConfirm(null);
      return;
    }
    setBusy(true);
    try {
      await confirm.action();
      setConfirm(null);
    } catch (error) {
      toast.error(error.message || "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const publishedModal = dayModal?.mode === "published" ? dayModal : null;
  const publishedSchedule = publishedModal?.schedule;
  const taken = publishedSchedule ? slotsTaken(publishedSchedule, reservations) : 0;
  const capacity = Number(publishedSchedule?.slotCapacity || 0);
  const canStartQueue =
    publishedSchedule &&
    publishedModal.dateStr === today &&
    !queueHasEnded(publishedSchedule) &&
    !LIVE_QUEUE_STATUSES.includes(publishedSchedule.queueStatus);
  const queueLive =
    publishedSchedule && LIVE_QUEUE_STATUSES.includes(publishedSchedule.queueStatus);
  const canClose =
    publishedSchedule &&
    !queueHasEnded(publishedSchedule) &&
    publishedSchedule.queueStatus !== "closed";

  return (
    <section className="pq-glass p-4 sm:p-5 mb-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg font-extrabold tracking-tight">Schedule calendar</h2>
          <p className="pq-muted text-sm">Post a day, a range, or copy last week. Open a posted day to start the queue or close the clinic.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!lockBranch && (
            <select
              className="pq-input"
              value={branch?.id || ""}
              onChange={(event) => setChosenBranchId(event.target.value)}
              aria-label="Branch"
            >
              {branches.map((item) => (
                <option key={item.id} value={item.id}>{formatBranchLabel(item.name)}</option>
              ))}
            </select>
          )}
          <button type="button" className="pq-btn-secondary" onClick={() => setRangeOpen(true)}>Publish range</button>
          <button type="button" className="pq-btn-secondary" onClick={reviewCopy}>Copy previous week</button>
        </div>
      </div>

      <div className="flex items-center justify-between mb-3">
        <button type="button" className="pq-btn-secondary" aria-label="Previous month" onClick={() => setCursor((c) => shiftMonth(c.year, c.monthIndex, -1))}>
          <ChevronLeft className="w-4 h-4" />
        </button>
        <h3 className="font-extrabold">{formatManilaMonth(cursor.year, cursor.monthIndex)}</h3>
        <button type="button" className="pq-btn-secondary" aria-label="Next month" onClick={() => setCursor((c) => shiftMonth(c.year, c.monthIndex, 1))}>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold pq-muted mb-1">
        {WEEKDAYS.map((label) => <div key={label}>{label}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((dateStr, index) => {
          if (!dateStr) return <div key={`blank-${index}`} />;
          const schedule = scheduleForDate(schedules, dateStr, branch?.id, branch?.name);
          const closure = closureForDate(closures, dateStr, branch?.id, branch?.name);
          const dayTaken = slotsTaken(schedule, reservations);
          const closed = Boolean(closure || schedule?.dayClosed);
          const draft = schedule?.status === "draft";
          const posted = schedule?.status === "published" && !closed;
          const full = posted && dayTaken >= Number(schedule.slotCapacity || 0);
          let background = "transparent";
          let color = "var(--pq-ink-faint)";
          let label = "Not posted";
          if (dateStr < today) label = "Past";
          else if (closed) {
            background = "var(--pq-wait-wash)";
            color = "var(--pq-wait)";
            label = "Closed";
          } else if (draft) {
            label = "Draft";
          } else if (full) {
            background = "var(--pq-alert-wash)";
            color = "var(--pq-alert)";
            label = "Full";
          } else if (posted) {
            background = "var(--pq-live-wash)";
            color = "var(--pq-live)";
            label = `${Math.max(0, Number(schedule.slotCapacity || 0) - dayTaken)} left`;
          }
          return (
            <button
              key={dateStr}
              type="button"
              onClick={() => openDay(dateStr)}
              className="min-h-14 rounded-xl text-left p-1.5"
              style={{
                background,
                color,
                border: draft ? "1px dashed var(--pq-mark-blue)" : "1px solid var(--pq-glass-line)",
              }}
              aria-label={`${formatManilaLong(dateStr)}, ${label}`}
            >
              <div className="text-sm font-extrabold">{Number(dateStr.slice(-2))}</div>
              <div className="text-[10px] leading-tight font-semibold">{label}</div>
            </button>
          );
        })}
      </div>
      {previewText ? <p className="sr-only">{previewText}</p> : null}

      {dayModal?.mode === "post" && (
        <div className="pq-modal-scrim">
          <div className="pq-modal w-full max-w-sm p-5">
            <h3 className="text-lg font-extrabold mb-1">Post {formatManilaLong(dayModal.dateStr)}</h3>
            <p className="pq-muted text-sm mb-4">Parents can reserve as soon as this is posted.</p>
            <label className="pq-label" htmlFor="dayCapacity">Slots</label>
            <input
              id="dayCapacity"
              type="number"
              min="1"
              className="pq-input mb-4"
              value={dayModal.capacity}
              onChange={(event) => setDayModal({ ...dayModal, capacity: event.target.value })}
            />
            <div className="flex gap-2 justify-end">
              <button type="button" className="pq-btn-secondary" onClick={closeDayModal} disabled={busy}>Cancel</button>
              <button type="button" className="pq-btn-primary" onClick={postDay} disabled={busy}>Post day</button>
            </div>
          </div>
        </div>
      )}

      {publishedModal && (
        <div className="pq-modal-scrim">
          <div className="pq-modal w-full max-w-sm p-5">
            <h3 className="text-lg font-extrabold mb-1">{formatManilaLong(publishedModal.dateStr)}</h3>
            <p className="pq-muted text-sm mb-1">
              {formatBranchLabel(branch?.name)} · {taken}/{capacity || "—"} reserved
            </p>
            <p className="text-sm font-semibold mb-4" style={{ color: queueLive ? "var(--pq-live)" : "var(--pq-ink)" }}>
              {queueHasEnded(publishedSchedule)
                ? "Queue ended"
                : queueLive
                  ? `Queue ${publishedSchedule.queueStatus}`
                  : "Posted — queue not started"}
            </p>

            {!closingMode ? (
              <div className="flex flex-col gap-2">
                {canStartQueue && (
                  <button type="button" className="pq-btn-live w-full justify-center" onClick={requestStartQueue} disabled={busy}>
                    <Play className="w-4 h-4" aria-hidden="true" />
                    Start Queue
                  </button>
                )}
                {queueLive && queuePath && (
                  <button
                    type="button"
                    className="pq-btn-primary w-full justify-center"
                    onClick={() => {
                      closeDayModal();
                      navigate(queuePath);
                    }}
                    disabled={busy}
                  >
                    Open live queue
                  </button>
                )}
                {canClose && (
                  <button
                    type="button"
                    className="pq-btn-danger w-full justify-center"
                    onClick={() => setClosingMode(true)}
                    disabled={busy}
                  >
                    Close Clinic
                  </button>
                )}
                <button type="button" className="pq-btn-secondary w-full justify-center" onClick={closeDayModal} disabled={busy}>
                  Done
                </button>
              </div>
            ) : (
              <div>
                <p className="pq-muted text-sm mb-3">
                  Waiting reservations will be cancelled so parents can book another date. This does not count as a no-show.
                </p>
                <label className="pq-label" htmlFor="closeThrough">Through (optional range)</label>
                <input
                  id="closeThrough"
                  type="date"
                  className="pq-input mb-3"
                  min={publishedModal.dateStr}
                  value={closeForm.endDate}
                  onChange={(event) => setCloseForm({ ...closeForm, endDate: event.target.value })}
                />
                <label className="pq-label" htmlFor="closeReason">Reason</label>
                <select
                  id="closeReason"
                  className="pq-input mb-3"
                  value={closeForm.reason}
                  onChange={(event) => setCloseForm({ ...closeForm, reason: event.target.value })}
                >
                  {CLOSURE_REASONS.map((reason) => (
                    <option key={reason.id} value={reason.id}>{reason.label}</option>
                  ))}
                </select>
                <label className="pq-label" htmlFor="closeNote">Note for parents</label>
                <textarea
                  id="closeNote"
                  className="pq-input mb-3"
                  rows={3}
                  value={closeForm.note}
                  onChange={(event) => setCloseForm({ ...closeForm, note: event.target.value })}
                />
                <p className="text-xs pq-muted mb-3">
                  Parents will see: {closureAnnouncement(closeForm.reason, closeForm.note)}
                </p>
                {!lockBranch && (
                  <label className="flex items-center gap-2 text-sm mb-4">
                    <input
                      type="checkbox"
                      checked={closeForm.allBranches}
                      onChange={(event) => setCloseForm({ ...closeForm, allBranches: event.target.checked })}
                    />
                    Apply to all branches
                  </label>
                )}
                <div className="flex gap-2 justify-end">
                  <button type="button" className="pq-btn-secondary" onClick={() => setClosingMode(false)} disabled={busy}>
                    Back
                  </button>
                  <button type="button" className="pq-btn-primary" onClick={reviewCloseDay} disabled={busy}>
                    Review close
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {rangeOpen && (
        <div className="pq-modal-scrim">
          <div className="pq-modal w-full max-w-sm p-5">
            <h3 className="text-lg font-extrabold mb-3">Publish a range</h3>
            <label className="pq-label" htmlFor="rangeStart">From</label>
            <input id="rangeStart" type="date" className="pq-input mb-3" min={today} max={horizon} value={rangeForm.start} onChange={(event) => setRangeForm({ ...rangeForm, start: event.target.value })} />
            <label className="pq-label" htmlFor="rangeEnd">To</label>
            <input id="rangeEnd" type="date" className="pq-input mb-3" min={rangeForm.start} max={horizon} value={rangeForm.end} onChange={(event) => setRangeForm({ ...rangeForm, end: event.target.value })} />
            <label className="pq-label" htmlFor="rangeCapacity">Slots each day</label>
            <input id="rangeCapacity" type="number" min="1" className="pq-input mb-4" value={rangeForm.capacity} onChange={(event) => setRangeForm({ ...rangeForm, capacity: event.target.value })} />
            <div className="flex gap-2 justify-end">
              <button type="button" className="pq-btn-secondary" onClick={() => setRangeOpen(false)} disabled={busy}>Cancel</button>
              <button type="button" className="pq-btn-primary" onClick={reviewRange} disabled={busy}>Review</button>
            </div>
          </div>
        </div>
      )}

      <ConfirmationModal
        isOpen={Boolean(confirm)}
        title={confirm?.title || ""}
        message={confirm?.message || ""}
        confirmText={confirm?.confirmText || "Confirm"}
        cancelText="Cancel"
        onConfirm={runConfirm}
        onClose={() => !busy && setConfirm(null)}
        isLoading={busy}
        isDestructive={Boolean(confirm?.destructive)}
      />
    </section>
  );
}
