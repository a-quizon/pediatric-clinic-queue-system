import React, { useState } from "react";
import { Play, Pause, Square, Lock, X } from "lucide-react";
import { updateQueueStatus, completeSchedule } from "../../services/scheduleService";
import toast from "react-hot-toast";
import { useHistoryOverlay } from "../../hooks/useHistoryOverlay";

export default function QueueSessionControls({
  schedule,
  canEndSession = false,
  includeStartQueue = false,
  showStatusBadge = true,
  layout = "inline",
}) {
  const [isCloseQueueModalOpen, setIsCloseQueueModalOpen] = useState(false);
  const [isEndSessionModalOpen, setIsEndSessionModalOpen] = useState(false);
  useHistoryOverlay(isCloseQueueModalOpen, () => setIsCloseQueueModalOpen(false));
  useHistoryOverlay(isEndSessionModalOpen, () => setIsEndSessionModalOpen(false));

  if (!schedule?.id) return null;

  const queueStatus = schedule.queueStatus || "not_started";

  const getQueueStatusBadge = (status) => {
    const s = status || "not_started";
    switch (s) {
      case "not_started":
        return (
          <span className="pq-chip">
            <span className="w-2 h-2 rounded-full" style={{ background: "var(--pq-ink-faint)" }} />
            Not Started
          </span>
        );
      case "active":
        return (
          <span className="pq-chip pq-chip-live">
            <span className="pq-pip" style={{ width: 8, height: 8 }} />
            {layout === "cluster" ? "Active Session" : "Active"}
          </span>
        );
      case "paused":
        return (
          <span className="pq-chip pq-chip-wait">
            <span className="w-2 h-2 rounded-full" style={{ background: "var(--pq-wait)" }} />
            Paused
          </span>
        );
      case "closed":
        return (
          <span className="pq-chip pq-chip-wait">
            <span className="w-2 h-2 rounded-full" style={{ background: "var(--pq-wait)" }} />
            Queue Closed
          </span>
        );
      case "ended":
      case "completed":
        return (
          <span className="pq-chip pq-chip-alert">
            <span className="w-2 h-2 rounded-full" style={{ background: "var(--pq-alert)" }} />
            {s === "ended" ? "Ended" : "Completed"}
          </span>
        );
      default:
        return null;
    }
  };

  const handleQueueControl = async (status) => {
    if (status === "closed") {
      setIsCloseQueueModalOpen(true);
      return;
    }
    try {
      await updateQueueStatus(schedule.id, status);
      toast.success(`Queue status updated to ${status}`);
    } catch (err) {
      console.error(err);
      toast.error("Failed to update queue status");
    }
  };

  const confirmCloseQueue = async () => {
    try {
      await updateQueueStatus(schedule.id, "closed");
      toast.success("Queue closed to new reservations.");
      setIsCloseQueueModalOpen(false);
    } catch (err) {
      console.error(err);
      toast.error("Failed to close queue");
    }
  };

  const handleEndSessionClick = () => {
    if (!canEndSession) {
      toast.error("All remaining patients must be completed before ending the clinic session.");
      return;
    }
    setIsEndSessionModalOpen(true);
  };

  const confirmEndSession = async () => {
    try {
      await updateQueueStatus(schedule.id, "completed");
      await completeSchedule(schedule.id);
      toast.success("Clinic session ended successfully.");
      setIsEndSessionModalOpen(false);
    } catch (err) {
      console.error(err);
      toast.error("Failed to end clinic session");
    }
  };

  const isCluster = layout === "cluster";
  const orb = (tone) => (isCluster ? `pq-session-orb pq-session-orb-${tone}` : "pq-icon-btn");
  const orbStyle = (tone) => {
    if (isCluster) return undefined;
    if (tone === "wait") return { color: "var(--pq-wait)" };
    if (tone === "lock") return { color: "var(--pq-alert)" };
    if (tone === "live") return { color: "var(--pq-live)" };
    return undefined;
  };

  const actionButtons = (
    <div className={`flex items-center gap-2 min-w-0 ${isCluster ? "shrink-0" : "flex-wrap"}`}>
      {includeStartQueue && queueStatus === "published" && (
        <button type="button" onClick={() => handleQueueControl("active")} className="pq-btn-live">
          <Play className="w-4 h-4" aria-hidden="true" /> Start Queue
        </button>
      )}
      {queueStatus === "active" && (
        <>
          <button
            type="button"
            onClick={() => handleQueueControl("paused")}
            className={orb("wait")}
            style={orbStyle("wait")}
            aria-label="Pause Queue"
            title="Pause Queue"
          >
            <Pause className="w-4 h-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => handleQueueControl("closed")}
            className={orb("lock")}
            style={orbStyle("lock")}
            aria-label="Close Queue to New Reservations"
            title="Close Queue to New Reservations"
          >
            <Lock className="w-4 h-4" aria-hidden="true" />
          </button>
        </>
      )}
      {queueStatus === "paused" && (
        <>
          <button
            type="button"
            onClick={() => handleQueueControl("active")}
            className={orb("live")}
            style={orbStyle("live")}
            aria-label="Resume Queue"
            title="Resume Queue"
          >
            <Play className="w-4 h-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => handleQueueControl("closed")}
            className={orb("lock")}
            style={orbStyle("lock")}
            aria-label="Close Queue to New Reservations"
            title="Close Queue to New Reservations"
          >
            <Lock className="w-4 h-4" aria-hidden="true" />
          </button>
        </>
      )}
      {(queueStatus === "active" || queueStatus === "paused" || queueStatus === "closed") && (
        isCluster ? (
          <button
            type="button"
            onClick={handleEndSessionClick}
            className="pq-session-orb pq-session-orb-stop"
            style={!canEndSession ? { opacity: 0.55, cursor: "not-allowed" } : undefined}
            aria-label={!canEndSession ? "End Clinic Session (finish remaining consultations first)" : "End Clinic Session"}
            title={!canEndSession ? "Finish all remaining consultations to end session" : "End Clinic Session"}
          >
            <Square className="w-4 h-4" aria-hidden="true" />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleEndSessionClick}
            className={canEndSession ? "pq-btn-danger" : "pq-btn-secondary"}
            style={!canEndSession ? { opacity: 0.55, cursor: "not-allowed" } : undefined}
            title={!canEndSession ? "Finish all remaining consultations to end session" : "End Clinic Session"}
          >
            <Square className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span className="whitespace-nowrap">End Clinic Session</span>
          </button>
        )
      )}
      {(queueStatus === "ended" || queueStatus === "completed") && (
        <span className="pq-chip">Clinic Session Ended</span>
      )}
    </div>
  );

  return (
    <>
      <div className={isCluster
        ? "flex w-full min-w-0 flex-wrap items-center justify-between gap-2"
        : "flex flex-wrap items-center gap-2 sm:gap-3 min-w-0"
      }>
        {showStatusBadge && (
          isCluster
            ? <div className="shrink-0">{getQueueStatusBadge(queueStatus)}</div>
            : getQueueStatusBadge(queueStatus)
        )}
        {actionButtons}
      </div>

      {isCloseQueueModalOpen && (
        <div className="pq-modal-scrim">
          <div className="pq-modal w-full max-w-md overflow-hidden" role="dialog" aria-modal="true" aria-labelledby="close-queue-title">
            <div className="flex justify-between items-center p-5" style={{ borderBottom: "1px solid var(--pq-glass-line)" }}>
              <h2 id="close-queue-title" className="text-lg font-extrabold tracking-tight flex items-center" style={{ color: "var(--pq-wait)" }}>
                <Lock className="w-5 h-5 mr-2" aria-hidden="true" />
                Close Queue to New Reservations?
              </h2>
              <button type="button" onClick={() => setIsCloseQueueModalOpen(false)} className="pq-icon-btn" aria-label="Close">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6">
              <p className="font-medium text-center">
                Are you sure you want to close this queue to new reservations?
              </p>
              <p className="pq-muted text-sm text-center mt-2">
                No new reservations will be accepted. However, existing reservations remain valid and ongoing consultations will continue normally.
              </p>
            </div>

            <div className="p-5 flex justify-end gap-3" style={{ borderTop: "1px solid var(--pq-glass-line)" }}>
              <button
                type="button"
                onClick={() => setIsCloseQueueModalOpen(false)}
                className="pq-btn-secondary"
              >
                Cancel
              </button>
              <button type="button" onClick={confirmCloseQueue} className="pq-btn-warn">
                <Lock className="w-4 h-4" aria-hidden="true" /> Close Queue
              </button>
            </div>
          </div>
        </div>
      )}

      {isEndSessionModalOpen && (
        <div className="pq-modal-scrim">
          <div className="pq-modal w-full max-w-md overflow-hidden" role="dialog" aria-modal="true" aria-labelledby="end-session-title">
            <div className="flex justify-between items-center p-5" style={{ borderBottom: "1px solid var(--pq-glass-line)" }}>
              <h2 id="end-session-title" className="text-lg font-extrabold tracking-tight flex items-center" style={{ color: "var(--pq-alert)" }}>
                <Square className="w-5 h-5 mr-2" aria-hidden="true" />
                End Clinic Session?
              </h2>
              <button type="button" onClick={() => setIsEndSessionModalOpen(false)} className="pq-icon-btn" aria-label="Close">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6">
              <p className="font-medium text-center">
                Are you sure you want to end today's clinic session?
              </p>
              <p className="pq-muted text-sm text-center mt-2">
                All consultations have been completed. This will mark the schedule as Completed and finalize today's clinic.
              </p>
            </div>

            <div className="p-5 flex justify-end gap-3" style={{ borderTop: "1px solid var(--pq-glass-line)" }}>
              <button
                type="button"
                onClick={() => setIsEndSessionModalOpen(false)}
                className="pq-btn-secondary"
              >
                Cancel
              </button>
              <button type="button" onClick={confirmEndSession} className="pq-btn-danger">
                <Square className="w-4 h-4" aria-hidden="true" /> End Clinic Session
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
