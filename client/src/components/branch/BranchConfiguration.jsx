import React, { useState, useEffect } from "react";
import { createBranch, updateBranch } from "../../services/branchConfigurationService";
import { AlertCircle, X } from "lucide-react";
import toast from "react-hot-toast";

export default function BranchConfiguration({ isOpen, mode, branch, existingBranches = [], onClose, onSuccess }) {
  const defaultScheduleState = {
    monday: { isOpen: true, openingTime: "09:00", closingTime: "17:00" },
    tuesday: { isOpen: true, openingTime: "09:00", closingTime: "17:00" },
    wednesday: { isOpen: true, openingTime: "09:00", closingTime: "17:00" },
    thursday: { isOpen: true, openingTime: "09:00", closingTime: "17:00" },
    friday: { isOpen: true, openingTime: "09:00", closingTime: "17:00" },
    saturday: { isOpen: false, openingTime: "09:00", closingTime: "17:00" },
    sunday: { isOpen: false, openingTime: "09:00", closingTime: "17:00" },
  };

  const [branchName, setBranchName] = useState("");
  const [clinicAddress, setClinicAddress] = useState("");
  const [schedule, setSchedule] = useState(defaultScheduleState);
  const [errorMsg, setErrorMsg] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setErrorMsg("");
      if (mode === "edit" && branch) {
        setBranchName(branch.name);
        setClinicAddress(branch.clinicAddress || "");
        const loadedSchedule = { ...defaultScheduleState };
        if (branch.schedule) {
          Object.keys(defaultScheduleState).forEach((day) => {
            if (branch.schedule[day]) {
              loadedSchedule[day] = {
                isOpen: branch.schedule[day].isOpen || false,
                openingTime: branch.schedule[day].openingTime || "09:00",
                closingTime: branch.schedule[day].closingTime || "17:00"
              };
            }
          });
        }
        setSchedule(loadedSchedule);
      } else {
        setBranchName("");
        setClinicAddress("");
        setSchedule(defaultScheduleState);
      }
    }
  }, [isOpen, mode, branch]);

  const handleScheduleChange = (day, field, value) => {
    setSchedule((prev) => ({
      ...prev,
      [day]: { ...prev[day], [field]: value }
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg("");

    if (!branchName.trim()) {
      setErrorMsg("Branch name is required.");
      return;
    }

    if (!clinicAddress.trim()) {
      setErrorMsg("Clinic address is required.");
      return;
    }

    const isDuplicate = existingBranches.some((b) =>
      b.name.toLowerCase() === branchName.trim().toLowerCase() &&
      (mode === "add" || b.id !== branch?.id)
    );
    if (isDuplicate) {
      setErrorMsg("Branch name must be unique.");
      return;
    }

    const hasInvalidOpenDay = Object.values(schedule).some((day) =>
      day.isOpen && (!day.openingTime || !day.closingTime)
    );
    if (hasInvalidOpenDay) {
      setErrorMsg("Opening and closing times are required for open days.");
      return;
    }

    setIsSubmitting(true);

    const branchData = {
      name: branchName.trim(),
      clinicAddress: clinicAddress.trim(),
      schedule
    };

    try {
      if (mode === "add") {
        await createBranch(branchData);
        toast.success("Branch has been successfully created.");
      } else if (mode === "edit") {
        await updateBranch(branch.id, branchData);
        toast.success("Branch has been successfully updated.");
      }

      onSuccess();
      onClose();
    } catch (err) {
      console.error(err);
      setErrorMsg("An error occurred while saving the branch.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const daysOfWeek = [
    { key: "monday", label: "Monday" },
    { key: "tuesday", label: "Tuesday" },
    { key: "wednesday", label: "Wednesday" },
    { key: "thursday", label: "Thursday" },
    { key: "friday", label: "Friday" },
    { key: "saturday", label: "Saturday" },
    { key: "sunday", label: "Sunday" },
  ];

  if (!isOpen) return null;

  return (
    <div className="pq-modal-scrim z-[60]">
      <div className="pq-modal w-full max-w-lg flex flex-col max-h-[90vh] overflow-hidden" role="dialog" aria-modal="true" aria-labelledby="branch-form-title">
        <div className="flex items-center justify-between p-5" style={{ borderBottom: "1px solid var(--pq-glass-line)" }}>
          <h2 id="branch-form-title" className="text-xl font-extrabold tracking-tight">
            {mode === "add" ? "Add Branch" : "Edit Branch"}
          </h2>
          <button type="button" onClick={onClose} className="pq-icon-btn" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto flex-1">
          {errorMsg && (
            <div className="mb-5 pq-note pq-note-alert flex items-start">
              <AlertCircle className="w-5 h-5 mr-2 shrink-0" aria-hidden="true" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form id="branch-form" onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="branch-name" className="pq-label">Branch Name</label>
              <input
                id="branch-name"
                type="text"
                value={branchName}
                onChange={(e) => setBranchName(e.target.value)}
                placeholder="e.g. San Fernando"
                className="pq-input"
              />
            </div>

            <div>
              <label htmlFor="branch-address" className="pq-label">Clinic Address</label>
              <textarea
                id="branch-address"
                value={clinicAddress}
                onChange={(e) => setClinicAddress(e.target.value)}
                placeholder="Enter the full clinic address..."
                rows="3"
                className="pq-input resize-none"
              />
            </div>

            <div>
              <p className="pq-label">Weekly Schedule</p>
              <div className="space-y-3">
                {daysOfWeek.map(({ key, label }) => {
                  const dayState = schedule[key];
                  return (
                    <div key={key} className="pq-row" style={{ display: "block", minHeight: 0, padding: "1rem" }}>
                      <div className="flex items-center justify-between mb-1">
                        <span className={`font-extrabold tracking-tight ${dayState.isOpen ? "" : "pq-muted"}`}>{label}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-medium" style={{ color: dayState.isOpen ? "var(--pq-mark-blue)" : "var(--pq-ink-faint)" }}>
                            {dayState.isOpen ? "Open" : "Closed"}
                          </span>
                          <button
                            type="button"
                            role="switch"
                            aria-checked={dayState.isOpen}
                            aria-label={`${label} ${dayState.isOpen ? "open" : "closed"}`}
                            onClick={() => handleScheduleChange(key, "isOpen", !dayState.isOpen)}
                            className="pq-switch"
                          >
                            <span className="pq-switch-knob" />
                          </button>
                        </div>
                      </div>

                      {dayState.isOpen && (
                        <div className="grid grid-cols-2 gap-4 mt-3 pt-3" style={{ borderTop: "1px solid var(--pq-glass-line)" }}>
                          <div>
                            <label htmlFor={`${key}-open`} className="pq-label">Opening Time</label>
                            <input
                              id={`${key}-open`}
                              type="time"
                              value={dayState.openingTime}
                              onChange={(e) => handleScheduleChange(key, "openingTime", e.target.value)}
                              className="pq-input"
                            />
                          </div>
                          <div>
                            <label htmlFor={`${key}-close`} className="pq-label">Closing Time</label>
                            <input
                              id={`${key}-close`}
                              type="time"
                              value={dayState.closingTime}
                              onChange={(e) => handleScheduleChange(key, "closingTime", e.target.value)}
                              className="pq-input"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </form>
        </div>

        <div className="p-5 flex items-center justify-end gap-3 shrink-0" style={{ borderTop: "1px solid var(--pq-glass-line)" }}>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="pq-btn-secondary"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="branch-form"
            disabled={isSubmitting}
            className="pq-btn-primary"
          >
            {isSubmitting ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
