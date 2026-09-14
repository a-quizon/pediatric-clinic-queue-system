import React, { useState, useEffect } from "react";
import { Save, AlertCircle, Loader2, MapPin } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "../../hooks/useAuth";
import { formatBranchLabel } from "../../utils/stringUtils";
import {
  getQueueConfiguration,
  updatePenaltyMoveBack,
  validatePenaltyMoveBack,
  getLateLimit,
  updateLateLimit,
  validateLateLimit,
  getSmsConfiguration,
  updateSmsConfiguration,
  validateSmsConfiguration,
  DEFAULT_SMS_TEMPLATES,
  SMS_TEMPLATE_PLACEHOLDERS,
  MAX_SMS_TEMPLATE_LENGTH,
  MIN_NEARING_TURN_AHEAD,
  MAX_NEARING_TURN_AHEAD,
  MIN_LATE_LIMIT,
  MAX_LATE_LIMIT,
} from "../../services/systemConfigurationService";

export default function SystemSettings() {
  const { user } = useAuth();
  const branchId = user?.assignedBranchId;
  const branchLabel = formatBranchLabel(user?.assignedBranch) || "your assigned branch";

  const [penaltyMoveBack, setPenaltyMoveBack] = useState("");
  const [lateLimit, setLateLimit] = useState("");
  const [nearingTurnAheadCount, setNearingTurnAheadCount] = useState("");
  const [templateSlotReserved, setTemplateSlotReserved] = useState("");
  const [templateQueueStarted, setTemplateQueueStarted] = useState("");
  const [templateNearingTurn, setTemplateNearingTurn] = useState("");

  const [loading, setLoading] = useState(true);
  const [savingQueue, setSavingQueue] = useState(false);
  const [savingSms, setSavingSms] = useState(false);
  const [queueError, setQueueError] = useState(null);
  const [smsError, setSmsError] = useState(null);

  useEffect(() => {
    if (!branchId) {
      setLoading(false);
      return;
    }
    fetchConfig();
  }, [branchId]);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const [queueConfig, branchLateLimit, smsConfig] = await Promise.all([
        getQueueConfiguration(branchId),
        getLateLimit(branchId),
        getSmsConfiguration(branchId),
      ]);
      setPenaltyMoveBack(queueConfig.penaltyMoveBack.toString());
      setLateLimit(branchLateLimit.toString());
      setNearingTurnAheadCount(smsConfig.nearingTurnAheadCount.toString());
      setTemplateSlotReserved(smsConfig.templateSlotReserved);
      setTemplateQueueStarted(smsConfig.templateQueueStarted);
      setTemplateNearingTurn(smsConfig.templateNearingTurn);
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
      const limit = validateLateLimit(lateLimit);
      if (penalty.valid && limit.valid) setQueueError(null);
    }
  };

  const handleLateLimitChange = (e) => {
    const value = e.target.value;
    if (value !== "" && (value.includes("-") || Number(value) < 0)) {
      return;
    }
    setLateLimit(value);
    if (queueError) {
      const penalty = validatePenaltyMoveBack(penaltyMoveBack);
      const limit = validateLateLimit(value);
      if (penalty.valid && limit.valid) setQueueError(null);
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
        templateQueueStarted,
        templateNearingTurn,
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
    const limit = validateLateLimit(lateLimit);
    if (!limit.valid) {
      setQueueError(limit.error);
      return;
    }

    try {
      setSavingQueue(true);
      setQueueError(null);
      await Promise.all([
        updatePenaltyMoveBack(branchId, penalty.value),
        updateLateLimit(branchId, limit.value),
      ]);
      toast.success("Queue rules updated for this branch.");
      setPenaltyMoveBack(penalty.value.toString());
      setLateLimit(limit.value.toString());
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
      templateQueueStarted,
      templateNearingTurn,
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
      setTemplateQueueStarted(saved.templateQueueStarted);
      setTemplateNearingTurn(saved.templateNearingTurn);
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

      <section className="pq-glass overflow-hidden">
        <div className="p-5 sm:p-6" style={{ borderBottom: "1px solid var(--pq-glass-line)" }}>
          <h3 className="text-lg font-extrabold tracking-tight mb-1">Queue Rules</h3>
          <p className="pq-muted text-sm mb-5 max-w-2xl">
            These two values control how penalties work for this branch only.
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
                <label htmlFor="lateLimit" className="pq-label">
                  Late Limit ({MIN_LATE_LIMIT}–{MAX_LATE_LIMIT})
                </label>
                <p className="pq-muted text-sm">
                  Maximum penalties before a parent is forfeited. New schedules use this automatically. Older schedules keep their saved limit.
                </p>
              </div>
              <div className="w-full sm:w-32 shrink-0">
                <input
                  id="lateLimit"
                  type="number"
                  min={MIN_LATE_LIMIT}
                  max={MAX_LATE_LIMIT}
                  step="1"
                  value={lateLimit}
                  onChange={handleLateLimitChange}
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
            disabled={savingQueue || penaltyMoveBack === "" || lateLimit === ""}
            className="pq-btn-primary"
          >
            {savingQueue ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Save className="w-4 h-4" aria-hidden="true" />}
            {savingQueue ? "Saving..." : "Save Queue Rules"}
          </button>
        </div>
      </section>

      <section className="pq-glass overflow-hidden">
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
                    Send the near-turn SMS when exactly this many patients remain ahead ({MIN_NEARING_TURN_AHEAD}–{MAX_NEARING_TURN_AHEAD}).
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
            disabled={savingSms || nearingTurnAheadCount === ""}
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
