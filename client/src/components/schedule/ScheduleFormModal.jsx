import React, { useState, useEffect } from 'react';
import { createSchedule, updateSchedule, scheduleExists } from '../../services/scheduleService';
import { useAuth } from '../../hooks/useAuth';
import { X, AlertCircle } from 'lucide-react';

export default function ScheduleModal({ isOpen, onClose, mode, schedule, onSuccess }) {
  const { user } = useAuth();
  
  const initialFormState = {
    branch: "",
    clinicDate: "",
    openingTime: "",
    queueStartTime: "",
    slotCapacity: "",
    validationWindow: "",
    lateLimit: "",
  };

  const [formData, setFormData] = useState(initialFormState);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen) {
      if (mode === "edit" && schedule) {
        setFormData({
          branch: schedule.branch || "",
          clinicDate: schedule.clinicDate || "",
          openingTime: schedule.openingTime || "",
          queueStartTime: schedule.queueStartTime || "",
          slotCapacity: schedule.slotCapacity || "",
          validationWindow: schedule.validationWindow || "",
          lateLimit: schedule.lateLimit || "",
        });
      } else {
        setFormData(initialFormState);
      }
      setError("");
    }
  }, [isOpen, mode, schedule]);

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (formData.queueStartTime <= formData.openingTime) {
      setError("Queue start time must be after opening time.");
      setLoading(false);
      return;
    }

    try {
      const exists = await scheduleExists(formData.branch, formData.clinicDate);
      
      let isDuplicate = false;
      if (mode === "create") {
        isDuplicate = exists;
      } else if (mode === "edit") {
        if (formData.branch !== schedule.branch || formData.clinicDate !== schedule.clinicDate) {
          isDuplicate = exists;
        }
      }

      if (isDuplicate) {
        setError("A schedule already exists for this branch and date.");
        setLoading(false);
        return;
      }

      const scheduleData = {
        doctorId: user.uid,
        doctorEmail: user.email,
        branch: formData.branch,
        clinicDate: formData.clinicDate,
        openingTime: formData.openingTime,
        queueStartTime: formData.queueStartTime,
        slotCapacity: Number(formData.slotCapacity),
        validationWindow: Number(formData.validationWindow),
        lateLimit: Number(formData.lateLimit),
      };

      if (mode === "create") {
        scheduleData.status = "draft";
        scheduleData.createdAt = Date.now();
        await createSchedule(scheduleData);
      } else {
        await updateSchedule(schedule.id, scheduleData);
      }

      onSuccess(mode === "create" ? "Schedule created successfully!" : "Schedule updated successfully!");
      onClose();
    } catch (err) {
      console.error(err);
      setError(`Failed to ${mode} schedule.`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header (Sticky) */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100 bg-white">
          <h2 className="text-xl font-bold text-gray-800">
            {mode === "create" ? "Create Schedule" : "Edit Schedule"}
          </h2>
          <button 
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body (Scrollable) */}
        <div className="p-5 overflow-y-auto flex-1">
          {error && (
            <div className="mb-5 p-4 bg-red-50 text-red-600 border border-red-100 rounded-xl text-sm font-medium flex items-start">
              <AlertCircle className="w-5 h-5 mr-2 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {mode === "edit" && schedule?.status === "published" && (
            <div className="mb-5 p-4 bg-amber-50 text-amber-700 border border-amber-200 rounded-xl text-sm font-medium">
              <strong>Notice:</strong> Branch and Clinic Date can no longer be changed after publication.
            </div>
          )}

          <form id="schedule-form" onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="branch" className="block text-sm font-semibold text-gray-700 mb-1.5">Branch</label>
              <select
                id="branch"
                name="branch"
                value={formData.branch}
                onChange={handleChange}
                required
                disabled={loading || (mode === "edit" && schedule?.status === "published")}
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-colors disabled:opacity-60 disabled:bg-gray-100 text-gray-800"
              >
                <option value="">Select Branch</option>
                <option value="Angeles">Angeles</option>
                <option value="Magalang">Magalang</option>
              </select>
            </div>

            <div>
              <label htmlFor="clinicDate" className="block text-sm font-semibold text-gray-700 mb-1.5">Clinic Date</label>
              <input
                type="date"
                min={new Date().toISOString().split("T")[0]}
                id="clinicDate"
                name="clinicDate"
                value={formData.clinicDate}
                onChange={handleChange}
                required
                disabled={loading || (mode === "edit" && schedule?.status === "published")}
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-colors disabled:opacity-60 disabled:bg-gray-100 text-gray-800"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="openingTime" className="block text-sm font-semibold text-gray-700 mb-1.5">Opening Time</label>
                <input
                  type="time"
                  id="openingTime"
                  name="openingTime"
                  value={formData.openingTime}
                  onChange={handleChange}
                  required
                  disabled={loading}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-colors disabled:opacity-60 text-gray-800"
                />
              </div>
              <div>
                <label htmlFor="queueStartTime" className="block text-sm font-semibold text-gray-700 mb-1.5">Queue Start Time</label>
                <input
                  type="time"
                  id="queueStartTime"
                  name="queueStartTime"
                  value={formData.queueStartTime}
                  onChange={handleChange}
                  required
                  disabled={loading}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-colors disabled:opacity-60 text-gray-800"
                />
              </div>
            </div>

            <div>
              <label htmlFor="slotCapacity" className="block text-sm font-semibold text-gray-700 mb-1.5">Slot Capacity (Patients)</label>
              <input
                type="number"
                id="slotCapacity"
                name="slotCapacity"
                value={formData.slotCapacity}
                onChange={handleChange}
                required
                min="1"
                disabled={loading}
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-colors disabled:opacity-60 text-gray-800"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="validationWindow" className="block text-sm font-semibold text-gray-700 mb-1.5">Validation Window (mins)</label>
                <input
                  type="number"
                  id="validationWindow"
                  name="validationWindow"
                  value={formData.validationWindow}
                  onChange={handleChange}
                  required
                  min="0"
                  disabled={loading}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-colors disabled:opacity-60 text-gray-800"
                />
              </div>
              <div>
                <label htmlFor="lateLimit" className="block text-sm font-semibold text-gray-700 mb-1.5">Late Limit (Times Allowed)</label>
                <input
                  type="number"
                  id="lateLimit"
                  name="lateLimit"
                  value={formData.lateLimit}
                  onChange={handleChange}
                  required
                  min="0"
                  disabled={loading}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-colors disabled:opacity-60 text-gray-800"
                />
              </div>
            </div>
          </form>
        </div>

        {/* Footer (Sticky) */}
        <div className="p-5 border-t border-gray-100 bg-gray-50 shrink-0 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-5 py-2.5 text-gray-600 font-semibold rounded-xl hover:bg-gray-200 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="schedule-form"
            disabled={loading}
            className={`px-6 py-2.5 bg-blue-600 text-white font-bold rounded-xl shadow-sm transition-all ${
              loading ? "opacity-70 cursor-not-allowed" : "hover:bg-blue-700 hover:shadow"
            }`}
          >
            {loading ? (mode === "create" ? "Creating..." : "Updating...") : (mode === "create" ? "Create Schedule" : "Update Schedule")}
          </button>
        </div>

      </div>
    </div>
  );
}
