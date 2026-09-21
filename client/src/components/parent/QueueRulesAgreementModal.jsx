import { useEffect, useRef, useState } from "react";
import { AlertCircle, ScrollText, X } from "lucide-react";
import { useHistoryOverlay } from "../../hooks/useHistoryOverlay";
import {
  queueRulesValuesEqual,
  subscribeToQueueRulesForSchedule,
} from "../../services/systemConfigurationService";
import { formatBranchLabel } from "../../utils/stringUtils";

const countLabel = (count, singular, pluralWord) =>
  `${count} ${count === 1 ? singular : pluralWord}`;

export default function QueueRulesAgreementModal({
  isOpen,
  schedule,
  isSubmitting = false,
  onCancel,
  onAgree,
}) {
  const seenRulesRef = useRef(null);
  const [queueRules, setQueueRules] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [retryNonce, setRetryNonce] = useState(0);
  const [hasAgreed, setHasAgreed] = useState(false);
  const [rulesUpdated, setRulesUpdated] = useState(false);

  const canShow = Boolean(isOpen && schedule);
  useHistoryOverlay(canShow, onCancel);

  useEffect(() => {
    if (!canShow) {
      setQueueRules(null);
      setLoadError(null);
      setIsLoading(false);
      setHasAgreed(false);
      setRulesUpdated(false);
      seenRulesRef.current = null;
      return undefined;
    }

    setQueueRules(null);
    setLoadError(null);
    setHasAgreed(false);
    setRulesUpdated(false);
    seenRulesRef.current = null;
    setIsLoading(true);

    const unsub = subscribeToQueueRulesForSchedule(
      schedule,
      (nextRules) => {
        setQueueRules((current) =>
          queueRulesValuesEqual(current, nextRules) ? current : nextRules
        );
        setIsLoading(false);
        setLoadError(null);
      },
      () => {
        setQueueRules(null);
        setIsLoading(false);
        setLoadError("We could not load this branch's queue rules. Please try again.");
      }
    );

    return unsub;
  }, [canShow, schedule, retryNonce]);

  useEffect(() => {
    if (!canShow || !queueRules) return;
    const previous = seenRulesRef.current;
    if (previous && !queueRulesValuesEqual(previous, queueRules)) {
      setRulesUpdated(true);
      setHasAgreed(false);
    }
    seenRulesRef.current = queueRules;
  }, [canShow, queueRules]);

  if (!canShow) return null;

  const branchLabel = formatBranchLabel(schedule.branch) || "this clinic";
  const canProceed = Boolean(queueRules) && hasAgreed && !isLoading && !isSubmitting;
  const instantForfeit = queueRules?.penaltyMoveBack === 0;

  return (
    <div className="pq-modal-scrim">
      <div className="pq-modal w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center p-5" style={{ borderBottom: "1px solid var(--pq-glass-line)" }}>
          <h2 className="text-lg font-bold flex items-center min-w-0 pr-3">
            <ScrollText className="w-5 h-5 mr-2 shrink-0" style={{ color: "var(--pq-mark-blue)" }} />
            <span className="truncate">Queue Rules for {branchLabel}</span>
          </h2>
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="pq-icon-btn"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto overscroll-contain min-h-0 flex-1">
          {(isLoading || (!queueRules && !loadError)) && (
            <div className="flex flex-col items-center justify-center py-10">
              <span className="pq-spinner mb-3" />
              <p className="text-sm pq-muted">Loading this branch's queue rules…</p>
            </div>
          )}

          {loadError && !isLoading && (
            <div className="flex items-start pq-note pq-note-warn">
              <AlertCircle className="w-5 h-5 mr-3 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium mb-3">{loadError}</p>
                <button
                  type="button"
                  className="pq-btn-secondary text-sm"
                  onClick={() => setRetryNonce((n) => n + 1)}
                >
                  Try again
                </button>
              </div>
            </div>
          )}

          {queueRules && !isLoading && (
            <div className="space-y-4">
              {rulesUpdated && (
                <div className="flex items-start pq-note pq-note-wait">
                  <AlertCircle className="w-5 h-5 mr-3 mt-0.5 shrink-0" />
                  <p className="text-sm font-medium">
                    The clinic just updated these rules. Please review them again before you agree.
                  </p>
                </div>
              )}

              <ul className="list-disc pl-5 space-y-2.5 text-sm leading-relaxed">
                <li>
                  {queueRules.penaltyGraceMinutes === 0
                    ? "If you are next and not at the clinic, staff may mark you late right away."
                    : `If you are next and not at the clinic, staff may mark you late after ${countLabel(queueRules.penaltyGraceMinutes, "minute", "minutes")}.`}
                </li>
                {instantForfeit ? (
                  <li>
                    If you are marked late, this reservation is forfeited immediately. There is no extra time to check in.
                  </li>
                ) : (
                  <>
                    <li>
                      If you are marked late, you will be moved back{" "}
                      {countLabel(queueRules.penaltyMoveBack, "place", "places")} in line.
                    </li>
                    <li>
                      You then have {countLabel(queueRules.penaltyTimerMinutes, "minute", "minutes")} to show your QR
                      code or reservation code at the clinic. If you check in on time, you keep your new place. If not,
                      this reservation is forfeited.
                    </li>
                  </>
                )}
                <li>
                  You may hold only one active reservation per day, even at a different branch. Cancelled or forfeited
                  tickets no longer count.
                </li>
              </ul>
            </div>
          )}
        </div>

        <div className="p-5 space-y-4" style={{ borderTop: "1px solid var(--pq-glass-line)" }}>
          {queueRules && !isLoading && (
            <label className="flex items-start gap-3 cursor-pointer text-sm leading-snug">
              <input
                type="checkbox"
                checked={hasAgreed}
                onChange={(event) => setHasAgreed(event.target.checked)}
                disabled={isSubmitting}
                className="mt-0.5 w-4 h-4 shrink-0 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span>
                I understand these queue rules for {branchLabel} and agree to follow them for this reservation.
              </span>
            </label>
          )}
          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={onCancel}
              disabled={isSubmitting}
              className="pq-btn-secondary w-full sm:w-auto text-sm"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                if (!canProceed) return;
                onAgree();
              }}
              disabled={!canProceed}
              className="pq-btn-primary w-full text-sm"
            >
              {isSubmitting ? (
                <>
                  <span className="pq-spinner" />
                  Reserving...
                </>
              ) : (
                "Proceed"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
