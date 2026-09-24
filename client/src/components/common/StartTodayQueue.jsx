import { useState } from "react";
import { Play } from "lucide-react";
import toast from "react-hot-toast";
import { updateQueueStatus } from "../../services/scheduleService";
import { manilaDateString, formatManilaLong } from "../../utils/manilaDate";
import { schedulesReadyToStart, startQueueConfirmMessage } from "../../utils/scheduleCalendar";
import { scheduleMatchesAssignedBranch, formatBranchLabel } from "../../utils/stringUtils";
import ConfirmationModal from "./ConfirmationModal";

export default function StartTodayQueue({ schedules, user, limitToAssignedBranch = false, onStarted }) {
  const [busyId, setBusyId] = useState(null);
  const [pending, setPending] = useState(null);
  const today = manilaDateString();
  const ready = schedulesReadyToStart(schedules, today).filter((schedule) =>
    limitToAssignedBranch ? scheduleMatchesAssignedBranch(schedule, user) : true
  );

  if (ready.length === 0 && !pending) return null;

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

  return (
    <>
      {ready.length > 0 && (
        <div className="flex flex-col items-center gap-2 mb-4">
          {ready.map((schedule) => (
            <button
              key={schedule.id}
              type="button"
              data-tour="queue-start"
              className="pq-btn-live"
              disabled={Boolean(busyId)}
              onClick={() => setPending(schedule)}
            >
              <Play className="w-4 h-4" aria-hidden="true" />
              Start Queue{ready.length > 1 ? ` · ${formatBranchLabel(schedule.branch)}` : ""}
            </button>
          ))}
        </div>
      )}

      <ConfirmationModal
        isOpen={Boolean(pending)}
        title="Start this queue?"
        message={
          pending
            ? startQueueConfirmMessage(pending, {
                formatDate: formatManilaLong,
                formatBranch: formatBranchLabel,
              })
            : ""
        }
        confirmText="Start Queue"
        cancelText="Cancel"
        onConfirm={() => pending && start(pending)}
        onClose={() => !busyId && setPending(null)}
        isLoading={Boolean(busyId)}
      />
    </>
  );
}
