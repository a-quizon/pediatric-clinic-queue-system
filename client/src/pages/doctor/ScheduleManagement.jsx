import React, { useState, useEffect } from "react";
import { getSchedules, deleteSchedule, publishSchedule, completeSchedule } from "../../services/scheduleService";
import { subscribeToAllReservations } from "../../services/reservationService";
import ScheduleCard from "../../components/schedule/ScheduleCard";
import ScheduleFormModal from "../../components/schedule/ScheduleFormModal";
import ScheduleDetailsModal from "../../components/doctor/ScheduleDetailsModal";
import ConfirmationModal from "../../components/common/ConfirmationModal";
import { Plus } from "lucide-react";
import toast from "react-hot-toast";

export default function ScheduleManagement() {
  const [schedules, setSchedules] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("create");
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  const [activeTab, setActiveTab] = useState("active"); // 'active' or 'completed'
  const [reservations, setReservations] = useState([]);
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, action: null, scheduleId: null, title: "", message: "", confirmText: "Confirm" });
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    const unsub = subscribeToAllReservations((data) => {
      setReservations(data);
    });
    return () => unsub();
  }, []);

  const getAvailableSlots = (schedule) => {
    const count = reservations.filter(r => r.scheduleId === schedule.id && ['reserved', 'checked_in', 'in_consultation'].includes(r.status)).length;
    return schedule.slotCapacity - count;
  };

  const getReservedCount = (schedule) => {
    return reservations.filter(r => r.scheduleId === schedule.id && ['reserved', 'checked_in', 'in_consultation'].includes(r.status)).length;
  };

  const getCheckedInCount = (schedule) => {
    return reservations.filter(r => r.scheduleId === schedule.id && (r.status === 'checked_in' || r.checkedIn)).length;
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

  const handleViewDetails = (schedule) => {
    setSelectedSchedule(schedule);
    setDetailsModalOpen(true);
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
    await loadSchedules();
    toast.success(successMessage);
  };

  const handleDelete = (scheduleId) => {
    setConfirmModal({
      isOpen: true,
      action: "delete",
      scheduleId,
      title: "Delete Schedule?",
      message: "Are you sure you want to delete this schedule?",
      confirmText: "Delete"
    });
  };

  const handlePublish = (scheduleId) => {
    setConfirmModal({
      isOpen: true,
      action: "publish",
      scheduleId,
      title: "Publish Schedule?",
      message: "This schedule will become visible to parents and reservations can begin.",
      confirmText: "Publish"
    });
  };

  const handleComplete = (scheduleId) => {
    setConfirmModal({
      isOpen: true,
      action: "complete",
      scheduleId,
      title: "Complete Schedule?",
      message: "No new reservations will be allowed and this clinic session will be closed.",
      confirmText: "Complete"
    });
  };

  const executeConfirmAction = async () => {
    if (!confirmModal.scheduleId || !confirmModal.action) return;
    setIsProcessing(true);
    try {
      if (confirmModal.action === "delete") {
        await deleteSchedule(confirmModal.scheduleId);
        await loadSchedules();
      } else if (confirmModal.action === "publish") {
        await publishSchedule(confirmModal.scheduleId);
        await loadSchedules();
        toast.success("The schedule is now visible to parents.");
      } else if (confirmModal.action === "complete") {
        await completeSchedule(confirmModal.scheduleId);
        await loadSchedules();
        toast.success("The schedule has been successfully closed.");
      }
      setConfirmModal(prev => ({ ...prev, isOpen: false }));
    } catch (error) {
      console.error(error);
      toast.error("An error occurred while processing your request.");
      setConfirmModal(prev => ({ ...prev, isOpen: false }));
    } finally {
      setIsProcessing(false);
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

      {/* Removed simple message block */}

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
                reservedCount={getReservedCount(schedule)}
                checkedInCount={getCheckedInCount(schedule)}
                onViewDetails={handleViewDetails}
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
                reservedCount={getReservedCount(schedule)}
                checkedInCount={getCheckedInCount(schedule)}
                onViewDetails={handleViewDetails}
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

      <ScheduleDetailsModal 
        isOpen={detailsModalOpen}
        onClose={() => setDetailsModalOpen(false)}
        schedule={selectedSchedule}
        reservations={reservations}
      />

      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText={confirmModal.confirmText}
        cancelText="Cancel"
        onConfirm={executeConfirmAction}
        onCancel={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
        loading={isProcessing}
      />
    </div>
  );
}