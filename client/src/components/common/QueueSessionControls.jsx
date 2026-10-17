import React, { useState } from "react";
import { Play, Pause, Square, Lock, X } from "lucide-react";
import { updateQueueStatus, completeSchedule } from "../../services/scheduleService";
import toast from "react-hot-toast";
import { useHistoryOverlay } from "../../hooks/useHistoryOverlay";
import { useRtdbConnection } from "../../hooks/useRtdbConnection";
import ModalScrim from "./ModalScrim";

export default function QueueSessionControls({
  schedule,
  canEndSession = false,
  showStatusBadge = true,
  layout = "inline",
  mutationsEnabled,
}) {
  const { canMutateRealtime } = useRtdbConnection();
  const allowMutations = mutationsEnabled ?? canMutateRealtime;
  const [isCloseQueueModalOpen, setIsCloseQueueModalOpen] = useState(false);
  const [isEndSessionModalOpen, setIsEndSessionModalOpen] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  useHistoryOverlay(isCloseQueueModalOpen, () => !isBusy && setIsCloseQueueModalOpen(false));
  useHistoryOverlay(isEndSessionModalOpen, () => !isBusy && setIsEndSessionModalOpen(false));

  if (!schedule?.id) return null;

  const queueStatus = schedule.queueStatus || "not_started";
  const controlsDisabled = !allowMutations || isBusy;

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
    if (!allowMutations || isBusy) return;
    if (status === "closed") {
      setIsCloseQueueModalOpen(true);
      return;
    }
    setIsBusy(true);
    try {
      await updateQueueStatus(schedule.id, status);
      toast.success(`Queue status updated to ${status}`);
    } catch (err) {
      console.error(err);
      toast.error(err?.message || "Failed to update queue status");
    } finally {
      setIsBusy(false);
    }
  };

  const confirmCloseQueue = async () => {
    if (!allowMutations || isBusy) return;
    setIsBusy(true);
    try {
      await updateQueueStatus(schedule.id, "closed");
      toast.success("Queue closed to new reservations.");
      setIsCloseQueueModalOpen(false);
    } catch (err) {
      console.error(err);
      toast.error(err?.message || "Failed to close queue");
    } finally {
      setIsBusy(false);
    }
  };

  const handleEndSessionClick = () => {
    if (!allowMutations || isBusy) return;
    if (!canEndSession) {
      toast.error("All remaining patients must be completed before ending the clinic session.");
      return;
    }
    setIsEndSessionModalOpen(true);
  };

  const confirmEndSession = async () => {
    if (!allowMutations || isBusy) return;
    setIsBusy(true);
    try {
      await completeSchedule(schedule.id);
      toast.success("Clinic session ended successfully.");
      setIsEndSessionModalOpen(false);
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Failed to end clinic session");
    } finally {
      setIsBusy(false);
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
      {queueStatus === "active" && (
        <>
          <button
            type="button"
            onClick={() => handleQueueControl("paused")}
            disabled={controlsDisabled}
            className={orb("wait")}
            style={orbStyle("wait")}
            aria-label="Pause Queue"
            title={allowMutations ? "Pause Queue" : "Reconnect to control the queue"}
          >
            <Pause className="w-4 h-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => handleQueueControl("closed")}
            disabled={controlsDisabled}
            className={orb("lock")}
            style={orbStyle("lock")}
            aria-label="Close Queue to New Reservations"
            title={allowMutations ? "Close Queue to New Reservations" : "Reconnect to control the queue"}
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
            disabled={controlsDisabled}
            className={orb("live")}
            style={orbStyle("live")}
            aria-label="Resume Queue"
            title={allowMutations ? "Resume Queue" : "Reconnect to control the queue"}
          >
            <Play className="w-4 h-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => handleQueueControl("closed")}
            disabled={controlsDisabled}
            className={orb("lock")}
            style={orbStyle("lock")}
            aria-label="Close Queue to New Reservations"
            title={allowMutations ? "Close Queue to New Reservations" : "Reconnect to control the queue"}
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
            disabled={controlsDisabled}
            className="pq-session-orb pq-session-orb-stop"
            style={!canEndSession || controlsDisabled ? { opacity: 0.55, cursor: "not-allowed" } : undefined}
            aria-label={!canEndSession ? "End Clinic Session (finish remaining consultations first)" : "End Clinic Session"}
            title={
              !allowMutations
                ? "Reconnect to end the session"
                : !canEndSession
                  ? "Finish all remaining consultations to end session"
                  : "End Clinic Session"
            }
          >
            <Square className="w-4 h-4" aria-hidden="true" />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleEndSessionClick}
            disabled={controlsDisabled}
            className={canEndSession ? "pq-btn-danger" : "pq-btn-secondary"}
            style={!canEndSession || controlsDisabled ? { opacity: 0.55, cursor: "not-allowed" } : undefined}
            title={
              !allowMutations
                ? "Reconnect to end the session"
                : !canEndSession
                  ? "Finish all remaining consultations to end session"
                  : "End Clinic Session"
            }
          >
            <Square className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span className="truncate">End Clinic Session</span>
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
      <div
        data-tour="queue-session-controls"
        className={isCluster
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
        <ModalScrim className="z-[60]" onClick={(e) => e.target === e.currentTarget && setIsCloseQueueModalOpen(false)}>
          <div className="pq-modal pq-modal--md" role="dialog" aria-modal="true" aria-labelledby="close-queue-title">
            <div className="pq-modal-header flex justify-between items-center p-5" style={{ borderBottom: "1px solid var(--pq-glass-line)" }}>
              <h2 id="close-queue-title" className="text-lg font-extrabold tracking-tight flex items-center" style={{ color: "var(--pq-wait)" }}>
                <Lock className="w-5 h-5 mr-2" aria-hidden="true" />
                Close Queue to New Reservations?
              </h2>
              <button type="button" onClick={() => setIsCloseQueueModalOpen(false)} className="pq-icon-btn" aria-label="Close">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="pq-modal-body pq-scroll-y p-6">
              <p className="font-medium text-center">
                Are you sure you want to close this queue to new reservations?
              </p>
              <p className="pq-muted text-sm text-center mt-2">
                No new reservations will be accepted. However, existing reservations remain valid and ongoing consultations will continue normally.
              </p>
            </div>

            <div className="pq-modal-footer p-5 flex justify-end gap-3" style={{ borderTop: "1px solid var(--pq-glass-line)" }}>
              <button
                type="button"
                onClick={() => setIsCloseQueueModalOpen(false)}
                className="pq-btn-secondary"
              >
                Cancel
              </button>
              <button type="button" onClick={confirmCloseQueue} disabled={controlsDisabled} className="pq-btn-warn">
                <Lock className="w-4 h-4" aria-hidden="true" /> {isBusy ? "Closing…" : "Close Queue"}
              </button>
            </div>
          </div>
        </ModalScrim>
      )}

      {isEndSessionModalOpen && (
        <ModalScrim className="z-[60]" onClick={(e) => e.target === e.currentTarget && setIsEndSessionModalOpen(false)}>
          <div className="pq-modal pq-modal--md" role="dialog" aria-modal="true" aria-labelledby="end-session-title">
            <div className="pq-modal-header flex justify-between items-center p-5" style={{ borderBottom: "1px solid var(--pq-glass-line)" }}>
              <h2 id="end-session-title" className="text-lg font-extrabold tracking-tight flex items-center" style={{ color: "var(--pq-alert)" }}>
                <Square className="w-5 h-5 mr-2" aria-hidden="true" />
                End Clinic Session?
              </h2>
              <button type="button" onClick={() => setIsEndSessionModalOpen(false)} className="pq-icon-btn" aria-label="Close">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="pq-modal-body pq-scroll-y p-6">
              <p className="font-medium text-center">
                Are you sure you want to end today's clinic session?
              </p>
              <p className="pq-muted text-sm text-center mt-2">
                All consultations have been completed. This will mark the schedule as Completed and finalize today's clinic.
              </p>
            </div>

            <div className="pq-modal-footer p-5 flex justify-end gap-3" style={{ borderTop: "1px solid var(--pq-glass-line)" }}>
              <button
                type="button"
                onClick={() => setIsEndSessionModalOpen(false)}
                className="pq-btn-secondary"
              >
                Cancel
              </button>
              <button type="button" onClick={confirmEndSession} disabled={controlsDisabled} className="pq-btn-danger">
                <Square className="w-4 h-4" aria-hidden="true" /> {isBusy ? "Ending…" : "End Clinic Session"}
              </button>
            </div>
          </div>
        </ModalScrim>
      )}
    </>
  );
}
