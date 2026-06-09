import React from 'react';
export default function ScheduleCard({ schedule, onEdit, onDelete, onPublish, onComplete }) {
  return (
    <div style={{ border: "1px solid #ccc", padding: "15px", marginBottom: "15px", borderRadius: "8px" }}>
      <h3 style={{ marginTop: 0, marginBottom: "10px" }}>{schedule.branch} Branch</h3>
      <p style={{ margin: "5px 0" }}><strong>Date:</strong> {schedule.clinicDate}</p>
      <p style={{ margin: "5px 0" }}><strong>Opening Time:</strong> {schedule.openingTime}</p>
      <p style={{ margin: "5px 0" }}><strong>Queue Start:</strong> {schedule.queueStartTime}</p>
      <p style={{ margin: "5px 0" }}><strong>Capacity:</strong> {schedule.slotCapacity}</p>
      <p style={{ margin: "5px 0" }}>
        <strong>Status:</strong>{" "}
        <span style={{
          padding: "4px 8px",
          borderRadius: "12px",
          backgroundColor: schedule.status === "completed" ? "#2196F3" : schedule.status === "published" ? "#4CAF50" : "#ff9800",
          color: "white",
          fontSize: "0.85em",
          fontWeight: "bold",
          textTransform: "capitalize"
        }}>
          {schedule.status}
        </span>
      </p>
      
      {schedule.status !== "completed" && (
        <button onClick={() => onEdit(schedule)} style={{ marginTop: "10px", padding: "8px 16px", cursor: "pointer", fontWeight: "bold" }}>Edit</button>
      )}

      {schedule.status === "draft" && (
        <button onClick={() => onDelete(schedule.id)} style={{ marginTop: "10px", padding: "8px 16px", cursor: "pointer", fontWeight: "bold", backgroundColor: "#f44336", marginLeft: "10px" }}>Delete</button>
      )}

      {schedule.status === "draft" && (
        <button onClick={() => onPublish(schedule.id)} style={{ marginTop: "10px", padding: "8px 16px", cursor: "pointer", fontWeight: "bold", backgroundColor: "#4CAF50", marginLeft: "10px" }}>Publish</button>
      )}

      {schedule.status === "published" && (
        <button onClick={() => onComplete(schedule.id)} style={{ marginTop: "10px", padding: "8px 16px", cursor: "pointer", fontWeight: "bold", backgroundColor: "#2196F3", marginLeft: "10px", color: "white" }}>Complete Schedule</button>
      )}
    </div>
  );
}
