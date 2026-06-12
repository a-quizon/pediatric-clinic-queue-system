import React, { useState, useEffect } from 'react';
import { createSchedule, updateSchedule, scheduleExists } from '../../services/scheduleService';
import { getBranchConfigurations, getClinicHours } from '../../services/branchConfigurationService';
import { useAuth } from '../../hooks/useAuth';
import { X, AlertCircle, Clock } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ScheduleModal({ isOpen, onClose, mode, schedule, onSuccess }) {
  const { user } = useAuth();
  
  const initialFormState = {
    branch: "",
    clinicDate: "",
    openingTime: "",
    closingTime: "",
    slotCapacity: "",
    validationWindow: "",
    lateLimit: "",
  };

  const [formData, setFormData] = useState(initialFormState);
  const [loading, setLoading] = useState(false);
  const [branches, setBranches] = useState([]);

  useEffect(() => {
    getBranchConfigurations().then(setBranches);
  }, []);

  useEffect(() => {
    if (isOpen) {
      if (mode === "edit" && schedule) {
        setFormData({
          branch: schedule.branch || "",
          clinicDate: schedule.clinicDate || "",
          openingTime: schedule.openingTime || "",
          closingTime: schedule.closingTime || "",
          slotCapacity: schedule.slotCapacity || "",
          validationWindow: schedule.validationWindow || "",
          lateLimit: schedule.lateLimit || "",
        });
      } else {
        setFormData(initialFormState);
      }
    }
  }, [isOpen, mode, schedule]);

  useEffect(() => {
    const fetchHours = async () => {
      if (formData.branch && formData.clinicDate && mode === "create") {
        const hours = await getClinicHours(formData.branch, formData.clinicDate);
        if (hours) {
          setFormData(prev => ({ ...prev, openingTime: hours.openingTime, closingTime: hours.closingTime }));
        } else {
          setFormData(prev => ({ ...prev, openingTime: "", closingTime: "" }));
          toast.error("This branch is closed on the selected date.");
        }
      }
    };
    fetchHours();
  }, [formData.branch, formData.clinicDate, mode]);
  
  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const formatTime = (time) => {
    if (!time) return '';
    const [hours, minutes] = time.split(':');
    const h = parseInt(hours, 10);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const formattedH = h % 12 || 12;
    return `${formattedH}:${minutes} ${ampm}`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    if (!formData.openingTime || !formData.closingTime) {
      toast.error("No schedule pattern found for this branch and date. Please check Branch Configuration.");
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
        toast.error("A schedule already exists for this branch and date.");
        setLoading(false);
        return;
      }

      const scheduleData = {
        doctorId: user.uid,
        doctorEmail: user.email,
        branch: formData.branch,
        clinicDate: formData.clinicDate,
        openingTime: formData.openingTime,
        closingTime: formData.closingTime,
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
      toast.error(`Failed to ${mode} schedule.`);
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
                {branches.map(b => (
                  <option key={b.id} value={b.name}>{b.name}</option>
                ))}
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

            <div className="mb-4">
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Clinic Hours</label>
              <div className="w-full px-4 py-2.5 bg-gray-100 border border-gray-200 rounded-xl text-gray-600 flex items-center font-medium">
                <Clock className="w-4 h-4 mr-2" />
                {formData.openingTime && formData.closingTime 
                  ? `${formatTime(formData.openingTime)} - ${formatTime(formData.closingTime)}` 
                  : "Select branch and date to view hours"}
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
            disabled={loading || (mode === "create" && (!formData.openingTime || !formData.closingTime))}
            className={`px-6 py-2.5 font-bold rounded-xl shadow-sm transition-all ${
              loading || (mode === "create" && (!formData.openingTime || !formData.closingTime))
                ? "bg-blue-400 text-white opacity-70 cursor-not-allowed" 
                : "bg-blue-600 text-white hover:bg-blue-700 hover:shadow"
            }`}
          >
            {loading ? (mode === "create" ? "Creating..." : "Updating...") : (mode === "create" ? "Create Schedule" : "Update Schedule")}
          </button>
        </div>

      </div>
    </div>
  );
}
