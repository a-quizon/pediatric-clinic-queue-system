import React, { useState, useEffect } from "react";
import { getSchedules, deleteSchedule, publishSchedule, completeSchedule } from "../../services/scheduleService";
import { subscribeToAllReservations } from "../../services/reservationService";
import ScheduleCard from "../../components/schedule/ScheduleCard";
import ScheduleFormModal from "../../components/schedule/ScheduleFormModal";
import { Plus } from "lucide-react";

export default function ScheduleManagement() {
  const [schedules, setSchedules] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("create");
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  const [message, setMessage] = useState("");
  const [activeTab, setActiveTab] = useState("active"); // 'active' or 'completed'
  const [reservations, setReservations] = useState([]);

  useEffect(() => {
    const unsub = subscribeToAllReservations((data) => {
      setReservations(data);
    });
    return () => unsub();
  }, []);

  const getAvailableSlots = (schedule) => {
    const count = reservations.filter(r => r.scheduleId === schedule.id && r.status !== 'cancelled').length;
    return schedule.slotCapacity - count;
  };

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

  const handleDelete = async (scheduleId) => {
    const confirmed = window.confirm("Delete this schedule?");
    if (!confirmed) return;
    try {
      await deleteSchedule(scheduleId);
      await loadSchedules();
    } catch (error) {
      console.error(error);
    }
  };

  const handlePublish = async (scheduleId) => {
    const confirmed = window.confirm("Publish this schedule?");
    if (!confirmed) return;
    try {
      await publishSchedule(scheduleId);
      await loadSchedules();
    } catch (error) {
      console.error(error);
    }
  };

  const handleComplete = async (scheduleId) => {
    const confirmed = window.confirm("Complete this schedule? No new reservations will be allowed.");
    if (!confirmed) return;
    try {
      await completeSchedule(scheduleId);
      await loadSchedules();
    } catch (error) {
      console.error(error);
    }
  };

  // Sort Active by nearest clinic date first
  const activeSchedules = schedules
    .filter((s) => s.status !== "completed")
    .sort((a, b) => new Date(a.clinicDate) - new Date(b.clinicDate));

  // Sort Completed by newest completed first (assuming clinicDate determines age, descending)
  const completedSchedules = schedules
    .filter((s) => s.status === "completed")
    .sort((a, b) => new Date(b.clinicDate) - new Date(a.clinicDate));

  return (
    <div className="w-full text-left">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
        <div className="flex bg-gray-100 p-1 rounded-xl w-fit">
          <button
            onClick={() => setActiveTab("active")}
            className={`px-6 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === "active" 
                ? "bg-white text-blue-600 shadow-sm" 
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Active Schedules
          </button>
          <button
            onClick={() => setActiveTab("completed")}
            className={`px-6 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === "completed" 
                ? "bg-white text-blue-600 shadow-sm" 
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Completed
          </button>
        </div>

        {activeTab === "active" && (
          <button 
            onClick={handleOpenCreateModal}
            className="flex items-center justify-center px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Schedule
          </button>
        )}
      </div>

      {message && (
        <div className="mb-6 p-4 bg-green-50 text-green-700 border border-green-100 rounded-xl text-sm font-medium">
          {message}
        </div>
      )}

      {/* Tabs Content */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {activeTab === "active" && (
          activeSchedules.length === 0 ? (
            <div className="col-span-full py-10 text-center text-gray-400 font-medium bg-gray-50 rounded-2xl border border-dashed border-gray-200">
              No active schedules found. Create one to get started.
            </div>
          ) : (
            activeSchedules.map((schedule) => (
              <ScheduleCard
                key={schedule.id}
                schedule={schedule}
                availableSlots={getAvailableSlots(schedule)}
                onEdit={handleOpenEditModal}
                onDelete={handleDelete}
                onPublish={handlePublish}
                onComplete={handleComplete}
              />
            ))
          )
        )}

        {activeTab === "completed" && (
          completedSchedules.length === 0 ? (
            <div className="col-span-full py-10 text-center text-gray-400 font-medium bg-gray-50 rounded-2xl border border-dashed border-gray-200">
              No completed schedules.
            </div>
          ) : (
            completedSchedules.map((schedule) => (
              <ScheduleCard
                key={schedule.id}
                schedule={schedule}
                availableSlots={0}
                onEdit={handleOpenEditModal}
                onDelete={handleDelete}
                onPublish={handlePublish}
                onComplete={handleComplete}
              />
            ))
          )
        )}
      </div>

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