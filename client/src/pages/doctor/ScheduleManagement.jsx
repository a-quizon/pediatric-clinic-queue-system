import React, { useState, useEffect } from "react";
import { getSchedules, deleteSchedule, publishSchedule, completeSchedule } from "../../services/scheduleService";
import ScheduleCard from "../../components/schedule/ScheduleCard";
import ScheduleFormModal from "../../components/schedule/ScheduleFormModal";

export default function ScheduleManagement() {
  const [schedules, setSchedules] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("create");
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  const [message, setMessage] = useState("");

  const loadSchedules = async () => {
    try {
      const data = await getSchedules();
      
      if (!data) {
        setSchedules([]);
        return;
      }
      
      const scheduleArray = Object.entries(data).map(([id, value]) => ({
        id,
        ...value,
      }));
      setSchedules(scheduleArray);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    loadSchedules();
  }, []);

  const handleOpenCreateModal = () => {
    setModalMode("create");
    setSelectedSchedule(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (schedule) => {
    setModalMode("edit");
    setSelectedSchedule(schedule);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  const handleSuccess = async (successMessage) => {
    setMessage(successMessage);
    await loadSchedules();
    
    setTimeout(() => setMessage(""), 5000);
  };

  const handleDelete = async ( scheduleId ) => {
    const confirmed = window.confirm( "Delete this schedule?");
    if (!confirmed) return;
    try {
        await deleteSchedule( scheduleId );
        await loadSchedules();
    } catch (error) {
        console.error(error);
    }
  };

  const handlePublish = async ( scheduleId ) => {
    const confirmed = window.confirm("Publish this schedule?");
    if (!confirmed) return;
    try {
      await publishSchedule(scheduleId);
      await loadSchedules();
    } catch (error) {
      console.error(error);
    }
  };

  const handleComplete = async ( scheduleId ) => {
    const confirmed = window.confirm("Complete this schedule? No new reservations will be allowed.");
    if (!confirmed) return;
    try {
      await completeSchedule(scheduleId);
      await loadSchedules();
    } catch (error) {
      console.error(error);
    }
  };

  const activeSchedules = schedules
    .filter((s) => s.status !== "completed")
    .sort((a, b) => {
      const order = { draft: 1, published: 2 };
      return (order[a.status] ?? 99) - (order[b.status] ?? 99);
    });

  const completedSchedules = schedules.filter((s) => s.status === "completed");

  return (
    <div style={{ maxWidth: "800px", margin: "20px auto", padding: "20px", textAlign: "left" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <h2 style={{ margin: 0 }}>Schedule Management</h2>
        <button 
          onClick={handleOpenCreateModal}
          style={{ padding: "10px 20px", cursor: "pointer", fontWeight: "bold", backgroundColor: "#4CAF50", color: "white", border: "none", borderRadius: "4px" }}
        >
          + Add Schedule
        </button>
      </div>

      {message && (
        <p style={{ color: "green", padding: "10px", border: "1px solid green", borderRadius: "5px", backgroundColor: "#e8f5e9" }}>
          {message}
        </p>
      )}

      <hr style={{ marginBottom: "20px" }} />

      {/* ── ACTIVE SCHEDULES ── */}
      <div>
        <h3 style={{ margin: "0 0 8px 0", fontSize: "1em", textTransform: "uppercase", letterSpacing: "0.05em", color: "#555" }}>Active Schedules</h3>
        <hr style={{ marginBottom: "15px", borderColor: "#ddd" }} />
        {activeSchedules.length === 0 ? (
          <p style={{ color: "#888" }}>No active schedules.</p>
        ) : (
          activeSchedules.map((schedule) => (
            <ScheduleCard
              key={schedule.id}
              schedule={schedule}
              onEdit={handleOpenEditModal}
              onDelete={handleDelete}
              onPublish={handlePublish}
              onComplete={handleComplete}
            />
          ))
        )}
      </div>

      {/* ── COMPLETED SCHEDULES ── */}
      {completedSchedules.length > 0 && (
        <div style={{ marginTop: "30px" }}>
          <h3 style={{ margin: "0 0 8px 0", fontSize: "1em", textTransform: "uppercase", letterSpacing: "0.05em", color: "#555" }}>Completed Schedules</h3>
          <hr style={{ marginBottom: "15px", borderColor: "#ddd" }} />
          {completedSchedules.map((schedule) => (
            <ScheduleCard
              key={schedule.id}
              schedule={schedule}
              onEdit={handleOpenEditModal}
              onDelete={handleDelete}
              onPublish={handlePublish}
              onComplete={handleComplete}
            />
          ))}
        </div>
      )}

      <ScheduleFormModal 
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        mode={modalMode}
        schedule={selectedSchedule}
        onSuccess={handleSuccess}
      />
    </div>
  );
}