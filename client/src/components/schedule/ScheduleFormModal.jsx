import React, { useState, useEffect } from 'react';
import { createSchedule, updateSchedule, scheduleExists, validateScheduleClosingTime } from '../../services/scheduleService';
import { getBranchConfigurations, getClinicHours } from '../../services/branchConfigurationService';
import { useAuth } from '../../hooks/useAuth';
import { X, AlertCircle, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import { branchesMatch } from '../../utils/stringUtils';
import { addManilaDays, manilaDateString } from '../../utils/manilaDate';
import { useHistoryOverlay } from '../../hooks/useHistoryOverlay';

export default function ScheduleModal({ isOpen, onClose, mode, schedule, onSuccess, lockBranch = false }) {
  const { user } = useAuth();
  useHistoryOverlay(isOpen, onClose);
  
  const initialFormState = {
    branch: "",
    clinicDate: "",
    openingTime: "",
    closingTime: "",
    slotCapacity: "",
  };

  const [formData, setFormData] = useState(initialFormState);
  const [loading, setLoading] = useState(false);
  const [branches, setBranches] = useState([]);

  const resolveLockedBranchName = (branchList) => {
    if (!lockBranch || !user) return "";
    const matched = branchList.find(
      (b) =>
        (user.assignedBranchId && b.id === user.assignedBranchId) ||
        branchesMatch(b.name, user.assignedBranch)
    );
    return matched?.name || user.assignedBranch || "";
  };

  // helper to get local date string yyyy-mm-dd
  const getLocalDateString = (offsetDays = 0) => addManilaDays(manilaDateString(), offsetDays);

  const [minSelectableDate, setMinSelectableDate] = useState(() => getLocalDateString(0));

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
        });
      } else {
        const lockedBranch = resolveLockedBranchName(branches);
        setFormData({
          ...initialFormState,
          branch: lockedBranch || "",
        });
      }
    }
  }, [isOpen, mode, schedule, branches, lockBranch, user?.assignedBranch, user?.assignedBranchId]);

  // Resolve stale schedule.branch strings (e.g. "Angeles Branch") to the current config name
  useEffect(() => {
    if (!isOpen || mode !== "edit" || !schedule || branches.length === 0) return;
    const matchedBranch = branches.find(b =>
      (schedule.branchId && b.id === schedule.branchId) ||
      branchesMatch(b.name, schedule.branch)
    );
    if (!matchedBranch) return;
    setFormData(prev => (
      prev.branch === matchedBranch.name
        ? prev
        : { ...prev, branch: matchedBranch.name }
    ));
  }, [branches, isOpen, mode, schedule]);

  // update min date: kung past closing time na ang branch ngayon, i-disable today by setting min date to tomorrow
  useEffect(() => {
    let isActive = true;
    const checkMinDate = async () => {
      const todayStr = getLocalDateString(0);
      if (!formData.branch) {
        if (isActive) setMinSelectableDate(todayStr);
        return;
      }
      const validation = await validateScheduleClosingTime(formData.branch, todayStr);
      if (!isActive) return;
      if (!validation.valid && validation.message?.includes("closing time")) {
        setMinSelectableDate(getLocalDateString(1));
        if (formData.clinicDate === todayStr) {
          setFormData(prev => ({ ...prev, clinicDate: "", openingTime: "", closingTime: "" }));
        }
      } else {
        setMinSelectableDate(todayStr);
      }
    };
    checkMinDate();
    return () => { isActive = false; };
  }, [formData.branch]);

  // load clinic hours automatically from branch config when branch or date changes
  useEffect(() => {
    let isActive = true;
    // check if past closing time na bago i-load clinic hours or i-submit
    const fetchHours = async () => {
      if (formData.branch && formData.clinicDate && (mode === "create" || (mode === "edit" && schedule?.status !== "published"))) {
        const timeValidation = await validateScheduleClosingTime(formData.branch, formData.clinicDate);
        if (!isActive) return;
        if (!timeValidation.valid && timeValidation.message?.includes("closing time")) {
          setFormData(prev => ({ ...prev, openingTime: "", closingTime: "" }));
          return;
        } else if (!timeValidation.valid) {
          setFormData(prev => ({ ...prev, openingTime: "", closingTime: "" }));
          toast.error(timeValidation.message);
          return;
        }
        const hours = await getClinicHours(formData.branch, formData.clinicDate);
        if (!isActive) return;
        if (hours) {
          setFormData(prev => ({ ...prev, openingTime: hours.openingTime, closingTime: hours.closingTime }));
        } else {
          setFormData(prev => ({ ...prev, openingTime: "", closingTime: "" }));
          toast.error("This branch is closed on the selected date.");
        }
      }
    };
    fetchHours();
    return () => {
      isActive = false;
    };
  }, [formData.branch, formData.clinicDate, mode, schedule?.status]);
  
  if (!isOpen) return null;

  // update form fields and clear old clinic hours if branch or date changes
  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === "branch" || name === "clinicDate") {
      setFormData((prev) => ({
        ...prev,
        [name]: value,
        openingTime: "",
        closingTime: "",
      }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
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

    const timeValidation = await validateScheduleClosingTime(formData.branch, formData.clinicDate);
    if (!timeValidation.valid) {
      if (timeValidation.message?.includes("closing time")) {
        setLoading(false);
        return;
      }
      toast.error(timeValidation.message);
      setLoading(false);
      return;
    }

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

      const selectedBranch = branches.find(b => b.name === formData.branch || b.id === formData.branch);
      let doctorId = user.uid;
      let doctorEmail = user.email;
      if (lockBranch || user?.role === "secretary") {
        try {
          const { getActiveDoctor } = await import("../../services/adminService");
          const activeDoctor = await getActiveDoctor();
          if (activeDoctor) {
            doctorId = activeDoctor.id || activeDoctor.uid;
            doctorEmail = activeDoctor.email || doctorEmail;
          }
        } catch (err) {
          console.warn("Could not resolve active doctor for schedule; using creator id.", err);
        }
      }
      const scheduleData = {
        doctorId,
        doctorEmail,
        createdBy: user.uid,
        createdByRole: user.role || "secretary",
        branch: selectedBranch?.name || formData.branch,
        branchId: selectedBranch?.id || null,
        clinicDate: formData.clinicDate,
        openingTime: formData.openingTime,
        closingTime: formData.closingTime,
        slotCapacity: Number(formData.slotCapacity),
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
    <div className="pq-modal-scrim z-50">
      <div className="pq-modal w-full max-w-lg flex flex-col max-h-[90vh] overflow-hidden" role="dialog" aria-modal="true" aria-labelledby="schedule-form-title">
        
        <div className="flex items-center justify-between p-5" style={{ borderBottom: "1px solid var(--pq-glass-line)" }}>
          <h2 id="schedule-form-title" className="text-xl font-extrabold tracking-tight">
            {mode === "create" ? "Create Schedule" : "Edit Schedule"}
          </h2>
          <button 
            type="button"
            onClick={onClose}
            className="pq-icon-btn"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto flex-1">

          {mode === "edit" && schedule?.status === "published" && (
            <div className="mb-5 pq-note pq-note-wait">
              <strong>Notice:</strong> Branch and Clinic Date can no longer be changed after publication.
            </div>
          )}

          <form id="schedule-form" onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="branch" className="pq-label">Branch</label>
              <select
                id="branch"
                name="branch"
                value={formData.branch}
                onChange={handleChange}
                required
                disabled={loading || lockBranch || (mode === "edit" && schedule?.status === "published")}
                className="pq-input"
              >
                <option value="">Select Branch</option>
                {(lockBranch
                  ? branches.filter(
                      (b) =>
                        (user?.assignedBranchId && b.id === user.assignedBranchId) ||
                        branchesMatch(b.name, user?.assignedBranch)
                    )
                  : branches
                ).map((b) => (
                  <option key={b.id} value={b.name}>{b.name}</option>
                ))}
              </select>
              {formData.branch && (
                <p className="mt-2 text-sm pq-muted pq-row block min-h-0 whitespace-pre-line leading-relaxed">
                  {branches.find(b => branchesMatch(b.name, formData.branch))?.clinicAddress || "No clinic address provided."}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="clinicDate" className="pq-label">Clinic Date</label>
              <input
                type="date"
                min={minSelectableDate}
                id="clinicDate"
                name="clinicDate"
                value={formData.clinicDate}
                onChange={handleChange}
                required
                disabled={loading || (mode === "edit" && schedule?.status === "published")}
                className="pq-input"
              />
            </div>

            <div className="mb-4">
              <label className="pq-label">Clinic Hours</label>
              <div className="pq-input opacity-80 flex items-center">
                <Clock className="w-4 h-4 mr-2" aria-hidden="true" />
                {formData.openingTime && formData.closingTime 
                  ? `${formatTime(formData.openingTime)} - ${formatTime(formData.closingTime)}` 
                  : "Select branch and date to view hours"}
              </div>
            </div>

            <div>
              <label htmlFor="slotCapacity" className="pq-label">Slot Capacity (Patients)</label>
              <input
                type="number"
                id="slotCapacity"
                name="slotCapacity"
                value={formData.slotCapacity}
                onChange={handleChange}
                required
                min="1"
                disabled={loading}
                className="pq-input"
              />
            </div>
          </form>
        </div>

        <div className="p-5 shrink-0 flex items-center justify-end gap-3" style={{ borderTop: "1px solid var(--pq-glass-line)" }}>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="pq-btn-secondary"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="schedule-form"
            disabled={loading || !formData.openingTime || !formData.closingTime}
            className="pq-btn-primary"
          >
            {loading ? (mode === "create" ? "Creating..." : "Updating...") : (mode === "create" ? "Create Schedule" : "Update Schedule")}
          </button>
        </div>

      </div>
    </div>
  );
}
