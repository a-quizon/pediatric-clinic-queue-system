import React, { useState, useEffect } from 'react';
import { createSchedule, updateSchedule, scheduleExists } from '../../services/scheduleService';
import { useAuth } from '../../hooks/useAuth';

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
    <div style={{
      position: "fixed", top: 0, left: 0, width: "100%", height: "100%", 
      backgroundColor: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000
    }}>
      <div style={{ 
        backgroundColor: "white", padding: "20px", borderRadius: "8px", width: "100%", maxWidth: "500px", 
        maxHeight: "90vh", overflowY: "auto", position: "relative", textAlign: "left"
      }}>
        <button 
          onClick={onClose} 
          style={{ position: "absolute", top: "15px", right: "15px", cursor: "pointer", background: "none", border: "none", fontSize: "20px" }}
        >
          ✖
        </button>
        
        <h2 style={{ marginTop: 0 }}>{mode === "create" ? "Create Schedule" : "Edit Schedule"}</h2>
        
        {error && <p style={{ color: "red" }}>{error}</p>}

        {mode === "edit" && schedule?.status === "published" && (
          <div style={{ backgroundColor: "#fff3cd", color: "#856404", padding: "10px", borderRadius: "4px", marginBottom: "15px", border: "1px solid #ffeeba" }}>
            <strong>Notice:</strong> Branch and Clinic Date can no longer be changed after publication.
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: "15px" }}>
            <label htmlFor="branch" style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>Branch</label>
            <select
              id="branch"
              name="branch"
              value={formData.branch}
              onChange={handleChange}
              required
              disabled={loading || (mode === "edit" && schedule?.status === "published")}
              style={{ width: "100%", padding: "8px", boxSizing: "border-box", backgroundColor: (mode === "edit" && schedule?.status === "published") ? "#e9ecef" : "white" }}
            >
              <option value="">Select Branch</option>
              <option value="Angeles">Angeles</option>
              <option value="Magalang">Magalang</option>
            </select>
          </div>

          <div style={{ marginBottom: "15px" }}>
            <label htmlFor="clinicDate" style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>Clinic Date</label>
            <input
              type="date"
              min={new Date().toISOString().split("T")[0]}
              id="clinicDate"
              name="clinicDate"
              value={formData.clinicDate}
              onChange={handleChange}
              required
              disabled={loading || (mode === "edit" && schedule?.status === "published")}
              style={{ width: "100%", padding: "8px", boxSizing: "border-box", backgroundColor: (mode === "edit" && schedule?.status === "published") ? "#e9ecef" : "white" }}
            />
          </div>

          <div style={{ display: "flex", gap: "10px", marginBottom: "15px" }}>
            <div style={{ flex: 1 }}>
              <label htmlFor="openingTime" style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>Opening Time</label>
              <input
                type="time"
                id="openingTime"
                name="openingTime"
                value={formData.openingTime}
                onChange={handleChange}
                required
                disabled={loading}
                style={{ width: "100%", padding: "8px", boxSizing: "border-box" }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label htmlFor="queueStartTime" style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>Queue Start Time</label>
              <input
                type="time"
                id="queueStartTime"
                name="queueStartTime"
                value={formData.queueStartTime}
                onChange={handleChange}
                required
                disabled={loading}
                style={{ width: "100%", padding: "8px", boxSizing: "border-box" }}
              />
            </div>
          </div>

          <div style={{ marginBottom: "15px" }}>
            <label htmlFor="slotCapacity" style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>Slot Capacity (Patients)</label>
            <input
              type="number"
              id="slotCapacity"
              name="slotCapacity"
              value={formData.slotCapacity}
              onChange={handleChange}
              required
              min="1"
              disabled={loading}
              style={{ width: "100%", padding: "8px", boxSizing: "border-box" }}
            />
          </div>

          <div style={{ display: "flex", gap: "10px", marginBottom: "15px" }}>
            <div style={{ flex: 1 }}>
              <label htmlFor="validationWindow" style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>Validation Window (mins)</label>
              <input
                type="number"
                id="validationWindow"
                name="validationWindow"
                value={formData.validationWindow}
                onChange={handleChange}
                required
                min="0"
                disabled={loading}
                style={{ width: "100%", padding: "8px", boxSizing: "border-box" }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label htmlFor="lateLimit" style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>Late Limit (Times Allowed)</label>
              <input
                type="number"
                id="lateLimit"
                name="lateLimit"
                value={formData.lateLimit}
                onChange={handleChange}
                required
                min="0"
                disabled={loading}
                style={{ width: "100%", padding: "8px", boxSizing: "border-box" }}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{ width: "100%", padding: "10px", fontWeight: "bold", cursor: loading ? "not-allowed" : "pointer", marginTop: "10px" }}
          >
            {loading ? (mode === "create" ? "Creating..." : "Updating...") : (mode === "create" ? "Create Schedule" : "Update Schedule")}
          </button>
        </form>
      </div>
    </div>
  );
}
