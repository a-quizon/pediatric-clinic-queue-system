import React, { useState, useEffect } from "react";
import { Save, AlertCircle, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import {
  getQueueConfiguration,
  updatePenaltyMoveBack,
  validatePenaltyMoveBack,
  getSmsConfiguration,
  updateSmsConfiguration,
  validateSmsConfiguration,
  DEFAULT_SMS_TEMPLATES,
  SMS_TEMPLATE_PLACEHOLDERS,
  MAX_SMS_TEMPLATE_LENGTH,
  MIN_NEARING_TURN_AHEAD,
  MAX_NEARING_TURN_AHEAD,
} from "../../services/systemConfigurationService";

export default function SystemSettings({ isEmbedded = false }) {
  const [penaltyMoveBack, setPenaltyMoveBack] = useState("");
  const [nearingTurnAheadCount, setNearingTurnAheadCount] = useState("");
  const [templateQueueStarted, setTemplateQueueStarted] = useState("");
  const [templateNearingTurn, setTemplateNearingTurn] = useState("");

  const [loading, setLoading] = useState(true);
  const [savingQueue, setSavingQueue] = useState(false);
  const [savingSms, setSavingSms] = useState(false);
  const [queueError, setQueueError] = useState(null);
  const [smsError, setSmsError] = useState(null);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const [queueConfig, smsConfig] = await Promise.all([
        getQueueConfiguration(),
        getSmsConfiguration(),
      ]);
      setPenaltyMoveBack(queueConfig.penaltyMoveBack.toString());
      setNearingTurnAheadCount(smsConfig.nearingTurnAheadCount.toString());
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
      const validation = validatePenaltyMoveBack(value);
      if (validation.valid) setQueueError(null);
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
        templateQueueStarted,
        templateNearingTurn,
      });
      if (validation.valid) setSmsError(null);
    }
  };

  const handleSaveQueue = async () => {
    const validation = validatePenaltyMoveBack(penaltyMoveBack);
    if (!validation.valid) {
      setQueueError(validation.error);
      return;
    }

    try {
      setSavingQueue(true);
      setQueueError(null);
      await updatePenaltyMoveBack(validation.value);
      toast.success("Queue configuration updated successfully.");
      setPenaltyMoveBack(validation.value.toString());
    } catch (err) {
      console.error("Failed to save queue configuration", err);
      setQueueError(err.message || "An unexpected error occurred while saving.");
      toast.error("Failed to update system settings");
    } finally {
      setSavingQueue(false);
    }
  };

  const handleSaveSms = async () => {
    const validation = validateSmsConfiguration({
      nearingTurnAheadCount,
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
      const saved = await updateSmsConfiguration(validation.value);
      toast.success("SMS configuration updated successfully.");
      setNearingTurnAheadCount(saved.nearingTurnAheadCount.toString());
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  const renderCharHint = (text) => {
    const len = String(text || "").length;
    const soft = len > 160;
    return (
      <p className={`mt-1.5 text-xs ${soft ? "text-amber-600" : "text-gray-400"}`}>
        {len} / {MAX_SMS_TEMPLATE_LENGTH} characters
        {soft ? " · over 160 may use multiple SMS segments" : ""}
      </p>
    );
  };

  const content = (
    <div className="space-y-6">
      {/* Queue Configuration */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 md:p-8 border-b border-gray-100">
          <h3 className="text-lg font-bold text-gray-800 mb-2">Queue Configuration</h3>
          <p className="text-sm text-gray-500 mb-6 max-w-2xl">
            These settings govern the automated behavior of the queue system across all branches.
            Modifications will apply immediately to any active or upcoming queues.
          </p>

          <div className="bg-gray-50/50 rounded-xl p-5 border border-gray-100">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div className="flex-1">
                <label
                  htmlFor="penaltyMoveBack"
                  className="block text-sm font-semibold text-gray-700 mb-1"
                >
                  Penalty Move-Back
                </label>
                <p className="text-sm text-gray-500 mb-4 max-w-md">
                  Determines how many active queue positions a patient is moved backward when
                  penalized by the Secretary. Setting this to 0 results in an automatic forfeit for
                  the parent.
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
                  className={`w-full px-4 py-2.5 text-center text-lg font-bold text-gray-800 bg-white border ${
                    queueError ? "border-red-300 focus:ring-red-500" : "border-gray-200 focus:ring-blue-500"
                  } rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:border-transparent transition-all`}
                />
              </div>
            </div>

            {queueError && (
              <div className="mt-3 flex items-center text-red-600 text-sm bg-red-50 p-3 rounded-lg border border-red-100">
                <AlertCircle className="w-4 h-4 mr-2 shrink-0" />
                {queueError}
              </div>
            )}
          </div>
        </div>

        <div className="px-6 py-4 bg-gray-50 flex items-center justify-end">
          <button
            onClick={handleSaveQueue}
            disabled={savingQueue || penaltyMoveBack === ""}
            className={`flex items-center px-6 py-2.5 rounded-xl font-semibold text-sm transition-all ${
              savingQueue || penaltyMoveBack === ""
                ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                : "bg-blue-600 text-white hover:bg-blue-700 hover:shadow-md active:transform active:scale-95"
            }`}
          >
            {savingQueue ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Save Changes
              </>
            )}
          </button>
        </div>
      </div>

      {/* SMS Notifications */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 md:p-8 border-b border-gray-100">
          <h3 className="text-lg font-bold text-gray-800 mb-2">SMS Notifications</h3>
          <p className="text-sm text-gray-500 mb-6 max-w-2xl">
            Global SMS templates and near-turn timing for all branches. Changes apply on the next
            queue position check — patients who already received a near-turn SMS will not be notified
            again for the same reservation.
          </p>

          <div className="space-y-5">
            <div className="bg-gray-50/50 rounded-xl p-5 border border-gray-100">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div className="flex-1">
                  <label
                    htmlFor="nearingTurnAheadCount"
                    className="block text-sm font-semibold text-gray-700 mb-1"
                  >
                    Near Turn — Patients Ahead
                  </label>
                  <p className="text-sm text-gray-500 max-w-md">
                    Send the near-turn SMS when exactly this many patients remain ahead in the
                    active queue ({MIN_NEARING_TURN_AHEAD}–{MAX_NEARING_TURN_AHEAD}).
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
                    className="w-full px-4 py-2.5 text-center text-lg font-bold text-gray-800 bg-white border border-gray-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  />
                </div>
              </div>
            </div>

            <div className="bg-gray-50/50 rounded-xl p-5 border border-gray-100">
              <label
                htmlFor="templateNearingTurn"
                className="block text-sm font-semibold text-gray-700 mb-1"
              >
                Near Turn Message
              </label>
              <p className="text-sm text-gray-500 mb-3">
                Default: {DEFAULT_SMS_TEMPLATES.templateNearingTurn}
              </p>
              <div className="flex flex-wrap gap-2 mb-3">
                {["count", "queueNumber", "branch"].map((ph) => (
                  <button
                    key={ph}
                    type="button"
                    onClick={() =>
                      insertPlaceholder(setTemplateNearingTurn, templateNearingTurn, ph)
                    }
                    className="px-2.5 py-1 text-xs font-medium rounded-lg bg-white border border-gray-200 text-gray-600 hover:border-blue-300 hover:text-blue-700"
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
                className="w-full px-4 py-3 text-sm text-gray-800 bg-white border border-gray-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y"
              />
              {renderCharHint(templateNearingTurn)}
            </div>

            <div className="bg-gray-50/50 rounded-xl p-5 border border-gray-100">
              <label
                htmlFor="templateQueueStarted"
                className="block text-sm font-semibold text-gray-700 mb-1"
              >
                Queue Started Message
              </label>
              <div className="flex flex-wrap gap-2 mb-3 mt-2">
                {["branch", "date", "queueNumber"].map((ph) => (
                  <button
                    key={ph}
                    type="button"
                    onClick={() =>
                      insertPlaceholder(setTemplateQueueStarted, templateQueueStarted, ph)
                    }
                    className="px-2.5 py-1 text-xs font-medium rounded-lg bg-white border border-gray-200 text-gray-600 hover:border-blue-300 hover:text-blue-700"
                  >
                    {`{${ph}}`}
                  </button>
                ))}
              </div>
              <textarea
                id="templateQueueStarted"
                rows={4}
                value={templateQueueStarted}
                onChange={(e) => setTemplateQueueStarted(e.target.value)}
                className="w-full px-4 py-3 text-sm text-gray-800 bg-white border border-gray-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y"
              />
              {renderCharHint(templateQueueStarted)}
            </div>

            <p className="text-xs text-gray-400">
              Allowed placeholders:{" "}
              {SMS_TEMPLATE_PLACEHOLDERS.map((p) => `{${p}}`).join(", ")}. Push/toast near-turn
              wording stays system-managed and only updates the patient count.
            </p>

            {smsError && (
              <div className="flex items-center text-red-600 text-sm bg-red-50 p-3 rounded-lg border border-red-100">
                <AlertCircle className="w-4 h-4 mr-2 shrink-0" />
                {smsError}
              </div>
            )}
          </div>
        </div>

        <div className="px-6 py-4 bg-gray-50 flex items-center justify-end">
          <button
            onClick={handleSaveSms}
            disabled={savingSms || nearingTurnAheadCount === ""}
            className={`flex items-center px-6 py-2.5 rounded-xl font-semibold text-sm transition-all ${
              savingSms || nearingTurnAheadCount === ""
                ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                : "bg-blue-600 text-white hover:bg-blue-700 hover:shadow-md active:transform active:scale-95"
            }`}
          >
            {savingSms ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Save SMS Settings
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );

  if (isEmbedded) {
    return (
      <div className="animate-fadeIn mt-8">
        <h2 className="text-xl font-bold text-gray-800 mb-4 px-1">System Configuration</h2>
        {content}
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto animate-fadeIn pt-4 px-4 sm:px-6 lg:px-8 pb-8">
      {content}
    </div>
  );
}
