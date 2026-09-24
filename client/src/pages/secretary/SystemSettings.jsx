import React, { useState, useEffect } from "react";
import { Save, AlertCircle, Loader2, MapPin } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "../../hooks/useAuth";
import { useTourSample } from "../../hooks/useTourPreview";
import { formatBranchLabel } from "../../utils/stringUtils";
import {
  getDefaultSlotCapacity,
  updateDefaultSlotCapacity,
  validateSlotCapacity,
  MIN_SLOT_CAPACITY,
  MAX_SLOT_CAPACITY,
  getQueueConfiguration,
  updatePenaltyMoveBack,
  validatePenaltyMoveBack,
  updatePenaltyTimerMinutes,
  validatePenaltyTimerMinutes,
  updatePenaltyGraceMinutes,
  validatePenaltyGraceMinutes,
  getSmsConfiguration,
  updateSmsConfiguration,
  validateSmsConfiguration,
  DEFAULT_SMS_TEMPLATES,
  SMS_TEMPLATE_PLACEHOLDERS,
  MAX_SMS_TEMPLATE_LENGTH,
  MIN_NEARING_TURN_AHEAD,
  MAX_NEARING_TURN_AHEAD,
  MIN_PENALTY_TIMER_MINUTES,
  MAX_PENALTY_TIMER_MINUTES,
  MIN_PENALTY_GRACE_MINUTES,
  MAX_PENALTY_GRACE_MINUTES,
} from "../../services/systemConfigurationService";
import { TourSampleSettings } from "../../components/onboarding/SecretaryTourSampleViews";

export default function SystemSettings() {
  const { user } = useAuth();
  const tourLock = useTourSample(["settings-queue-rules", "settings-sms"]);
  const branchId = user?.assignedBranchId;
  const branchLabel = formatBranchLabel(user?.assignedBranch) || "your assigned branch";

  const [penaltyMoveBack, setPenaltyMoveBack] = useState("");
  const [penaltyTimerMinutes, setPenaltyTimerMinutes] = useState("");
  const [penaltyGraceMinutes, setPenaltyGraceMinutes] = useState("");
  const [defaultSlotCapacity, setDefaultSlotCapacity] = useState("");
  const [nearingTurnAheadCount, setNearingTurnAheadCount] = useState("");
  const [templateSlotReserved, setTemplateSlotReserved] = useState("");
  const [templateSlotReservedActiveQueue, setTemplateSlotReservedActiveQueue] = useState("");
  const [templateQueueStarted, setTemplateQueueStarted] = useState("");
  const [templateNearingTurn, setTemplateNearingTurn] = useState("");
  const [templatePenalized, setTemplatePenalized] = useState("");
  const [templateForfeited, setTemplateForfeited] = useState("");
  const [templateClinicCancelled, setTemplateClinicCancelled] = useState("");

  const [loading, setLoading] = useState(true);
  const [savingQueue, setSavingQueue] = useState(false);
  const [savingSms, setSavingSms] = useState(false);
  const [queueError, setQueueError] = useState(null);
  const [smsError, setSmsError] = useState(null);

  useEffect(() => {
    if (tourLock) return undefined;
    if (!branchId) {
      setLoading(false);
      return undefined;
    }
    fetchConfig();
  }, [branchId, tourLock]);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const [queueConfig, smsConfig] = await Promise.all([
        getQueueConfiguration(branchId),
        getSmsConfiguration(branchId),
      ]);
      setPenaltyMoveBack(queueConfig.penaltyMoveBack.toString());
      setPenaltyTimerMinutes(queueConfig.penaltyTimerMinutes.toString());
      setPenaltyGraceMinutes(queueConfig.penaltyGraceMinutes.toString());
      const capacity = await getDefaultSlotCapacity(branchId);
      setDefaultSlotCapacity(String(capacity));
      setNearingTurnAheadCount(smsConfig.nearingTurnAheadCount.toString());
      setTemplateSlotReserved(smsConfig.templateSlotReserved);
      setTemplateSlotReservedActiveQueue(smsConfig.templateSlotReservedActiveQueue);
      setTemplateQueueStarted(smsConfig.templateQueueStarted);
      setTemplateNearingTurn(smsConfig.templateNearingTurn);
      setTemplatePenalized(smsConfig.templatePenalized);
      setTemplateForfeited(smsConfig.templateForfeited);
      setTemplateClinicCancelled(smsConfig.templateClinicCancelled);
    } catch (err) {
      console.error("Failed to load configuration", err);
      toast.error("Failed to load system settings");
    } finally {
      setLoading(false);
    }
  };

  const handlePenaltyChange = (e) => {
    const value = e.target.value;
    if (value !== "" && (value.includes("-") || Number(value) < 0)) {
      return;
    }
    setPenaltyMoveBack(value);

    if (queueError) {
      const penalty = validatePenaltyMoveBack(value);
      const timer = validatePenaltyTimerMinutes(penaltyTimerMinutes);
      const grace = validatePenaltyGraceMinutes(penaltyGraceMinutes);
      if (penalty.valid && timer.valid && grace.valid) setQueueError(null);
    }
  };

  const handleTimerChange = (e) => {
    const value = e.target.value;
    if (value !== "" && (value.includes("-") || Number(value) < 0)) {
      return;
    }
    setPenaltyTimerMinutes(value);
    if (queueError) {
      const penalty = validatePenaltyMoveBack(penaltyMoveBack);
      const timer = validatePenaltyTimerMinutes(value);
      const grace = validatePenaltyGraceMinutes(penaltyGraceMinutes);
      if (penalty.valid && timer.valid && grace.valid) setQueueError(null);
    }
  };

  const handleGraceChange = (e) => {
    const value = e.target.value;
    if (value !== "" && (value.includes("-") || Number(value) < 0)) {
      return;
    }
    setPenaltyGraceMinutes(value);
    if (queueError) {
      const penalty = validatePenaltyMoveBack(penaltyMoveBack);
      const timer = validatePenaltyTimerMinutes(penaltyTimerMinutes);
      const grace = validatePenaltyGraceMinutes(value);
      if (penalty.valid && timer.valid && grace.valid) setQueueError(null);
    }
  };

  const handleAheadCountChange = (e) => {
    const value = e.target.value;
    if (value !== "" && (value.includes("-") || Number(value) < 0)) {
      return;
    }
    setNearingTurnAheadCount(value);
    if (smsError) {
      const validation = validateSmsConfiguration({
        nearingTurnAheadCount: value,
        templateSlotReserved,
        templateSlotReservedActiveQueue,
        templateQueueStarted,
        templateNearingTurn,
        templatePenalized,
        templateForfeited,
      });
      if (validation.valid) setSmsError(null);
    }
  };

  const handleSaveQueue = async () => {
    const penalty = validatePenaltyMoveBack(penaltyMoveBack);
    if (!penalty.valid) {
      setQueueError(penalty.error);
      return;
    }
    const timer = validatePenaltyTimerMinutes(penaltyTimerMinutes);
    if (!timer.valid) {
      setQueueError(timer.error);
      return;
    }
    const grace = validatePenaltyGraceMinutes(penaltyGraceMinutes);
    if (!grace.valid) {
      setQueueError(grace.error);
      return;
    }
    const capacity = validateSlotCapacity(defaultSlotCapacity);
    if (!capacity.valid) {
      setQueueError(capacity.error);
      return;
    }

    try {
      setSavingQueue(true);
      setQueueError(null);
      await Promise.all([
        updatePenaltyMoveBack(branchId, penalty.value),
        updatePenaltyTimerMinutes(branchId, timer.value),
        updatePenaltyGraceMinutes(branchId, grace.value),
        updateDefaultSlotCapacity(branchId, capacity.value),
      ]);
      toast.success("Queue rules updated for this branch.");
      setPenaltyMoveBack(penalty.value.toString());
      setPenaltyTimerMinutes(timer.value.toString());
      setPenaltyGraceMinutes(grace.value.toString());
      setDefaultSlotCapacity(capacity.value.toString());
    } catch (err) {
      console.error("Failed to save queue configuration", err);
      setQueueError(err.message || "An unexpected error occurred while saving.");
      toast.error("Failed to update queue rules");
    } finally {
      setSavingQueue(false);
    }
  };

  const handleSaveSms = async () => {
    const validation = validateSmsConfiguration({
      nearingTurnAheadCount,
      templateSlotReserved,
      templateSlotReservedActiveQueue,
      templateQueueStarted,
      templateNearingTurn,
      templatePenalized,
      templateForfeited,
      templateClinicCancelled,
    });
    if (!validation.valid) {
      setSmsError(validation.error);
      return;
    }

    try {
      setSavingSms(true);
      setSmsError(null);
      const saved = await updateSmsConfiguration(branchId, validation.value);
      toast.success("SMS configuration updated for this branch.");
      setNearingTurnAheadCount(saved.nearingTurnAheadCount.toString());
      setTemplateSlotReserved(saved.templateSlotReserved);
      setTemplateSlotReservedActiveQueue(saved.templateSlotReservedActiveQueue);
      setTemplateQueueStarted(saved.templateQueueStarted);
      setTemplateNearingTurn(saved.templateNearingTurn);
      setTemplatePenalized(saved.templatePenalized);
      setTemplateForfeited(saved.templateForfeited);
      setTemplateClinicCancelled(saved.templateClinicCancelled);
    } catch (err) {
      console.error("Failed to save SMS configuration", err);
      setSmsError(err.message || "An unexpected error occurred while saving.");
      toast.error("Failed to update SMS settings");
    } finally {
      setSavingSms(false);
    }
  };

  const insertPlaceholder = (setter, current, placeholder) => {
    const token = `{${placeholder}}`;
    setter(`${current || ""}${token}`);
  };

  const renderCharHint = (text) => {
    const len = String(text || "").length;
    const soft = len > 160;
    return (
      <p className={`mt-1.5 text-xs ${soft ? "" : "pq-faint"}`} style={soft ? { color: "var(--pq-wait)" } : undefined}>
        {len} / {MAX_SMS_TEMPLATE_LENGTH} characters
        {soft ? " · over 160 may use multiple SMS segments" : ""}
      </p>
    );
  };

  if (tourLock) {
    return <TourSampleSettings />;
  }

  if (!branchId) {
    return (
      <div className="pq-glass p-8 text-center max-w-xl mx-auto">
        <AlertCircle className="w-10 h-10 mx-auto mb-3" style={{ color: "var(--pq-alert)" }} aria-hidden="true" />
        <h2 className="text-lg font-extrabold tracking-tight mb-2">Assigned branch required</h2>
        <p className="pq-muted text-sm">
          System Configuration is scoped to your assigned branch. Ask an administrator to assign a branch to this secretary account.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="pq-glass p-10 flex items-center justify-center min-h-[280px]">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: "var(--pq-mark-blue)" }} aria-hidden="true" />
        <span className="sr-only">Loading system settings</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8 max-w-3xl mx-auto">
      <div className="pq-glass p-5 sm:p-6 flex items-start gap-3">
        <div
          className="w-11 h-11 rounded-full flex items-center justify-center shrink-0"
          style={{ background: "color-mix(in srgb, var(--pq-mark-blue) 14%, white)", color: "var(--pq-mark-blue-deep)" }}
        >
          <MapPin className="w-5 h-5" aria-hidden="true" />
        </div>
        <div>
          <p className="pq-stat-label mb-1">Configuring rules for</p>
          <h2 className="text-xl font-extrabold tracking-tight">{branchLabel}</h2>
          <p className="pq-muted text-sm mt-1">
            These settings apply only to this branch. They do not change the other clinic’s queue or SMS rules.
          </p>
        </div>
      </div>

      <section className="pq-glass overflow-hidden" data-tour="settings-queue-rules">
        <div className="p-5 sm:p-6" style={{ borderBottom: "1px solid var(--pq-glass-line)" }}>
          <h3 className="text-lg font-extrabold tracking-tight mb-1">Queue Rules</h3>
          <p className="pq-muted text-sm mb-5 max-w-2xl">
            These values control how penalties and late forfeiture work for this branch only.
          </p>

          <div className="space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div className="flex-1 min-w-0">
                <label htmlFor="penaltyMoveBack" className="pq-label">
                  Penalty Move-Back (0–10)
                </label>
                <p className="pq-muted text-sm">
                  How many queue positions a parent is moved backward on each penalty. Setting this to 0 forfeits them immediately.
                </p>
              </div>
              <div className="w-full sm:w-32 shrink-0">
                <input
                  id="penaltyMoveBack"
                  type="number"
                  min="0"
                  max="10"
                  step="1"
                  value={penaltyMoveBack}
                  onChange={handlePenaltyChange}
                  className="pq-input text-center text-lg font-extrabold"
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div className="flex-1 min-w-0">
                <label htmlFor="penaltyGraceMinutes" className="pq-label">
                  Penalty Grace Period ({MIN_PENALTY_GRACE_MINUTES}–{MAX_PENALTY_GRACE_MINUTES} min)
                </label>
                <p className="pq-muted text-sm">
                  How long after a parent becomes next in line before Penalize is available. Protects parents who are walking in as they are called.
                </p>
              </div>
              <div className="w-full sm:w-32 shrink-0">
                <input
                  id="penaltyGraceMinutes"
                  type="number"
                  min={MIN_PENALTY_GRACE_MINUTES}
                  max={MAX_PENALTY_GRACE_MINUTES}
                  step="1"
                  value={penaltyGraceMinutes}
                  onChange={handleGraceChange}
                  className="pq-input text-center text-lg font-extrabold"
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div className="flex-1 min-w-0">
                <label htmlFor="penaltyTimerMinutes" className="pq-label">
                Validation Period ({MIN_PENALTY_TIMER_MINUTES}–{MAX_PENALTY_TIMER_MINUTES} min)
                </label>
                <p className="pq-muted text-sm">
                  After Penalize, the parent must validate their QR within this time or they are forfeited. Later penalties keep the first expiry.
                </p>
              </div>
              <div className="w-full sm:w-32 shrink-0">
                <input
                  id="penaltyTimerMinutes"
                  type="number"
                  min={MIN_PENALTY_TIMER_MINUTES}
                  max={MAX_PENALTY_TIMER_MINUTES}
                  step="1"
                  value={penaltyTimerMinutes}
                  onChange={handleTimerChange}
                  className="pq-input text-center text-lg font-extrabold"
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div className="flex-1 min-w-0">
                <label htmlFor="defaultSlotCapacity" className="pq-label">
                  Default slots per day ({MIN_SLOT_CAPACITY}–{MAX_SLOT_CAPACITY})
                </label>
                <p className="pq-muted text-sm">
                  Default capacity for each open clinic day. You can still change one day from the schedule calendar.
                </p>
              </div>
              <div className="w-full sm:w-32 shrink-0">
                <input
                  id="defaultSlotCapacity"
                  type="number"
                  min={MIN_SLOT_CAPACITY}
                  max={MAX_SLOT_CAPACITY}
                  step="1"
                  value={defaultSlotCapacity}
                  onChange={(e) => setDefaultSlotCapacity(e.target.value)}
                  className="pq-input text-center text-lg font-extrabold"
                />
              </div>
            </div>
          </div>

          {queueError && (
            <div className="mt-4 flex items-center text-sm p-3 rounded-lg" style={{ color: "var(--pq-alert)", background: "var(--pq-alert-wash)" }}>
              <AlertCircle className="w-4 h-4 mr-2 shrink-0" aria-hidden="true" />
              {queueError}
            </div>
          )}
        </div>
        <div className="px-5 py-4 flex justify-end">
          <button
            type="button"
            onClick={handleSaveQueue}
            disabled={tourLock || savingQueue || penaltyMoveBack === "" || penaltyTimerMinutes === "" || penaltyGraceMinutes === ""}
            className="pq-btn-primary"
          >
            {savingQueue ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Save className="w-4 h-4" aria-hidden="true" />}
            {savingQueue ? "Saving..." : "Save Queue Rules"}
          </button>
        </div>
      </section>

      <section className="pq-glass overflow-hidden" data-tour="settings-sms">
        <div className="p-5 sm:p-6" style={{ borderBottom: "1px solid var(--pq-glass-line)" }}>
          <h3 className="text-lg font-extrabold tracking-tight mb-1">SMS Notification Configuration</h3>
          <p className="pq-muted text-sm mb-6 max-w-2xl">
            Templates and near-turn timing for parents at {branchLabel} only. Parents who already received a near-turn SMS will not be notified again for the same reservation.
          </p>

          <div className="space-y-5">
            <div>
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div className="flex-1">
                  <label htmlFor="nearingTurnAheadCount" className="pq-label">
                    Near Turn — Patients Ahead
                  </label>
                  <p className="pq-muted text-sm">
                    Send the near-turn SMS when this many patients or fewer remain ahead ({MIN_NEARING_TURN_AHEAD}–{MAX_NEARING_TURN_AHEAD}). Each reservation receives this SMS only once.
                  </p>
                </div>
                <div className="w-full sm:w-32 shrink-0">
                  <input
                    id="nearingTurnAheadCount"
                    type="number"
                    min={MIN_NEARING_TURN_AHEAD}
                    max={MAX_NEARING_TURN_AHEAD}
                    step="1"
                    value={nearingTurnAheadCount}
                    onChange={handleAheadCountChange}
                    className="pq-input text-center text-lg font-extrabold"
                  />
                </div>
              </div>
            </div>

            <div>
              <label htmlFor="templateNearingTurn" className="pq-label">Near Turn Message</label>
              <p className="pq-muted text-sm mb-3">Default: {DEFAULT_SMS_TEMPLATES.templateNearingTurn}</p>
              <div className="flex flex-wrap gap-2 mb-3">
                {["count", "queueNumber", "branch"].map((ph) => (
                  <button
                    key={ph}
                    type="button"
                    onClick={() => insertPlaceholder(setTemplateNearingTurn, templateNearingTurn, ph)}
                    className="pq-btn-secondary text-xs py-1 px-2.5"
                  >
                    {`{${ph}}`}
                  </button>
                ))}
              </div>
              <textarea
                id="templateNearingTurn"
                rows={3}
                value={templateNearingTurn}
                onChange={(e) => setTemplateNearingTurn(e.target.value)}
                className="pq-input resize-y min-h-[5rem]"
              />
              {renderCharHint(templateNearingTurn)}
            </div>

            <div>
              <label htmlFor="templateSlotReserved" className="pq-label">Reservation Confirmed Message</label>
              <div className="flex flex-wrap gap-2 mb-3 mt-2">
                {["date", "timeRange", "queueNumber", "doctor", "branch"].map((ph) => (
                  <button
                    key={ph}
                    type="button"
                    onClick={() => insertPlaceholder(setTemplateSlotReserved, templateSlotReserved, ph)}
                    className="pq-btn-secondary text-xs py-1 px-2.5"
                  >
                    {`{${ph}}`}
                  </button>
                ))}
              </div>
              <textarea
                id="templateSlotReserved"
                rows={7}
                value={templateSlotReserved}
                onChange={(e) => setTemplateSlotReserved(e.target.value)}
                className="pq-input resize-y min-h-[8rem] font-mono text-sm"
              />
              {renderCharHint(templateSlotReserved)}
            </div>

            <div>
              <label htmlFor="templateSlotReservedActiveQueue" className="pq-label">Active Queue Reservation Message</label>
              <p className="pq-muted text-sm mb-3">Sent instead of the confirmed-reservation message when the parent books after the queue has already started.</p>
              <div className="flex flex-wrap gap-2 mb-3 mt-2">
                {["queueNumber", "queuePosition"].map((ph) => (
                  <button
                    key={ph}
                    type="button"
                    onClick={() => insertPlaceholder(setTemplateSlotReservedActiveQueue, templateSlotReservedActiveQueue, ph)}
                    className="pq-btn-secondary text-xs py-1 px-2.5"
                  >
                    {`{${ph}}`}
                  </button>
                ))}
              </div>
              <textarea
                id="templateSlotReservedActiveQueue"
                rows={4}
                value={templateSlotReservedActiveQueue}
                onChange={(e) => setTemplateSlotReservedActiveQueue(e.target.value)}
                className="pq-input resize-y min-h-[6rem]"
              />
              {renderCharHint(templateSlotReservedActiveQueue)}
            </div>

            <div>
              <label htmlFor="templatePenalized" className="pq-label">Penalty Message</label>
              <div className="flex flex-wrap gap-2 mb-3 mt-2">
                {["queueNumber", "queuePosition", "branch", "minutes"].map((ph) => (
                  <button
                    key={ph}
                    type="button"
                    onClick={() => insertPlaceholder(setTemplatePenalized, templatePenalized, ph)}
                    className="pq-btn-secondary text-xs py-1 px-2.5"
                  >
                    {`{${ph}}`}
                  </button>
                ))}
              </div>
              <textarea
                id="templatePenalized"
                rows={4}
                value={templatePenalized}
                onChange={(e) => setTemplatePenalized(e.target.value)}
                className="pq-input resize-y min-h-[6rem]"
              />
              {renderCharHint(templatePenalized)}
            </div>

            <div>
              <label htmlFor="templateForfeited" className="pq-label">Forfeiture Message</label>
              <div className="flex flex-wrap gap-2 mb-3 mt-2">
                {["queueNumber", "branch", "date"].map((ph) => (
                  <button
                    key={ph}
                    type="button"
                    onClick={() => insertPlaceholder(setTemplateForfeited, templateForfeited, ph)}
                    className="pq-btn-secondary text-xs py-1 px-2.5"
                  >
                    {`{${ph}}`}
                  </button>
                ))}
              </div>
              <textarea
                id="templateForfeited"
                rows={4}
                value={templateForfeited}
                onChange={(e) => setTemplateForfeited(e.target.value)}
                className="pq-input resize-y min-h-[6rem]"
              />
              {renderCharHint(templateForfeited)}
            </div>

            <div>
              <label htmlFor="templateClinicCancelled" className="pq-label">Clinic Closed Message</label>
              <p className="pq-muted text-sm mb-3">Sent when the clinic cancels a reservation because a day is closed.</p>
              <div className="flex flex-wrap gap-2 mb-3 mt-2">
                {["branch", "date", "reason"].map((ph) => (
                  <button
                    key={ph}
                    type="button"
                    onClick={() => insertPlaceholder(setTemplateClinicCancelled, templateClinicCancelled, ph)}
                    className="pq-btn-secondary text-xs py-1 px-2.5"
                  >
                    {`{${ph}}`}
                  </button>
                ))}
              </div>
              <textarea
                id="templateClinicCancelled"
                rows={4}
                value={templateClinicCancelled}
                onChange={(e) => setTemplateClinicCancelled(e.target.value)}
                className="pq-input resize-y min-h-[6rem]"
              />
              {renderCharHint(templateClinicCancelled)}
            </div>

            <div>
              <label htmlFor="templateQueueStarted" className="pq-label">Queue Started Message</label>
              <div className="flex flex-wrap gap-2 mb-3 mt-2">
                {["branch", "date"].map((ph) => (
                  <button
                    key={ph}
                    type="button"
                    onClick={() => insertPlaceholder(setTemplateQueueStarted, templateQueueStarted, ph)}
                    className="pq-btn-secondary text-xs py-1 px-2.5"
                  >
                    {`{${ph}}`}
                  </button>
                ))}
              </div>
              <textarea
                id="templateQueueStarted"
                rows={3}
                value={templateQueueStarted}
                onChange={(e) => setTemplateQueueStarted(e.target.value)}
                className="pq-input resize-y min-h-[5rem]"
              />
              {renderCharHint(templateQueueStarted)}
            </div>

            <p className="text-xs pq-faint">
              Allowed placeholders: {SMS_TEMPLATE_PLACEHOLDERS.map((p) => `{${p}}`).join(", ")}. Push/toast near-turn wording stays system-managed and only updates the patient count.
            </p>

            {smsError && (
              <div className="flex items-center text-sm p-3 rounded-lg" style={{ color: "var(--pq-alert)", background: "var(--pq-alert-wash)" }}>
                <AlertCircle className="w-4 h-4 mr-2 shrink-0" aria-hidden="true" />
                {smsError}
              </div>
            )}
          </div>
        </div>
        <div className="px-5 py-4 flex justify-end" style={{ borderTop: "1px solid var(--pq-glass-line)" }}>
          <button
            type="button"
            onClick={handleSaveSms}
            disabled={tourLock || savingSms || nearingTurnAheadCount === ""}
            className="pq-btn-primary"
          >
            {savingSms ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Save className="w-4 h-4" aria-hidden="true" />}
            {savingSms ? "Saving..." : "Save SMS Settings"}
          </button>
        </div>
      </section>
    </div>
  );
}
