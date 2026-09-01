import React, { useState, useEffect } from "react";
import { Settings, Save, AlertCircle, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { 
  getQueueConfiguration, 
  updatePenaltyMoveBack,
  validatePenaltyMoveBack 
} from "../../services/systemConfigurationService";

export default function SystemSettings({ isEmbedded = false }) {
  const [penaltyMoveBack, setPenaltyMoveBack] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const config = await getQueueConfiguration();
      setPenaltyMoveBack(config.penaltyMoveBack.toString());
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
    
    // Clear error if the user starts typing a valid value
    if (error) {
      const validation = validatePenaltyMoveBack(value);
      if (validation.valid) setError(null);
    }
  };

  const handleSave = async () => {
    const validation = validatePenaltyMoveBack(penaltyMoveBack);
    if (!validation.valid) {
      setError(validation.error);
      return;
    }

    try {
      setSaving(true);
      setError(null);
      await updatePenaltyMoveBack(validation.value);
      toast.success("Queue configuration updated successfully.");
      
      // Update local state to matched saved value exactly (removes leading zeros, etc.)
      setPenaltyMoveBack(validation.value.toString());
    } catch (err) {
      console.error("Failed to save configuration", err);
      setError(err.message || "An unexpected error occurred while saving.");
      toast.error("Failed to update system settings");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  const content = (
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
                  Determines how many active queue positions a patient is moved backward when penalized by the Secretary.
                  Setting this to 0 results in an automatic forfeit for the parent.
                </p>
              </div>

              <div className="w-full sm:w-32 shrink-0">
                <div className="relative">
                  <input
                    id="penaltyMoveBack"
                    type="number"
                    min="0"
                    max="10"
                    step="1"
                    value={penaltyMoveBack}
                    onChange={handlePenaltyChange}
                    className={`w-full px-4 py-2.5 text-center text-lg font-bold text-gray-800 bg-white border ${
                      error ? 'border-red-300 focus:ring-red-500' : 'border-gray-200 focus:ring-blue-500'
                    } rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:border-transparent transition-all`}
                  />
                </div>
              </div>
            </div>

            {error && (
              <div className="mt-3 flex items-center text-red-600 text-sm bg-red-50 p-3 rounded-lg border border-red-100">
                <AlertCircle className="w-4 h-4 mr-2 shrink-0" />
                {error}
              </div>
            )}
          </div>
        </div>

        <div className="px-6 py-4 bg-gray-50 flex items-center justify-end">
          <button
            onClick={handleSave}
            disabled={saving || penaltyMoveBack === ""}
            className={`flex items-center px-6 py-2.5 rounded-xl font-semibold text-sm transition-all ${
              saving || penaltyMoveBack === ""
                ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                : "bg-blue-600 text-white hover:bg-blue-700 hover:shadow-md active:transform active:scale-95"
            }`}
          >
            {saving ? (
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
