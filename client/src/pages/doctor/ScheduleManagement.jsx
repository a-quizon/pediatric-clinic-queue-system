import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { getSchedules, deleteSchedule, publishSchedule, completeSchedule } from "../../services/scheduleService";
import { subscribeToAllReservations } from "../../services/reservationService";
import ScheduleCard from "../../components/schedule/ScheduleCard";
import ScheduleFormModal from "../../components/schedule/ScheduleFormModal";
import ScheduleDetailsModal from "../../components/doctor/ScheduleDetailsModal";
import ConfirmationModal from "../../components/common/ConfirmationModal";
import ScheduleConfirmModal from "../../components/schedule/ScheduleConfirmModal";
import { Plus, Search, Filter, PlayCircle, CalendarX, CalendarCheck, Activity } from "lucide-react";
import toast from "react-hot-toast";

export default function ScheduleManagement() {
  const navigate = useNavigate();
  const [schedules, setSchedules] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("create");
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  
  const [currentFilter, setCurrentFilter] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  
  const [reservations, setReservations] = useState([]);
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, action: null, scheduleId: null, title: "", message: "", confirmText: "Confirm" });
  const [scheduleActionModal, setScheduleActionModal] = useState({ isOpen: false, action: null, schedule: null });
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    const unsub = subscribeToAllReservations((data) => {
      setReservations(data);
    });
    return () => unsub();
  }, []);

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
  const handleCloseModal = () => setIsModalOpen(false);
  const handleSuccess = async (successMessage) => {
    await loadSchedules();
    toast.success(successMessage);
  };
  const handleDelete = (scheduleId) => {
    setConfirmModal({
      isOpen: true, action: "delete", scheduleId, title: "Delete Schedule?", message: "Are you sure you want to delete this schedule?", confirmText: "Delete"
    });
  };
  const handlePublish = (scheduleOrId) => {
    const scheduleObj = typeof scheduleOrId === 'string' ? schedules.find(s => s.id === scheduleOrId) : scheduleOrId;
    setScheduleActionModal({
      isOpen: true,
      action: "publish",
      schedule: scheduleObj,
    });
  };
  const handleComplete = (scheduleId) => {
    setConfirmModal({
      isOpen: true, action: "complete", scheduleId, title: "Complete Schedule?", message: "No new reservations will be allowed and this clinic session will be closed.", confirmText: "Complete"
    });
  };
  const executeConfirmAction = async () => {
    if (!confirmModal.scheduleId || !confirmModal.action) return;
    setIsProcessing(true);
    try {
      if (confirmModal.action === "delete") {
        await deleteSchedule(confirmModal.scheduleId);
        await loadSchedules();
      } else if (confirmModal.action === "complete") {
        await completeSchedule(confirmModal.scheduleId);
        await loadSchedules();
        toast.success("The schedule has been successfully closed.");
      }
      setConfirmModal(prev => ({ ...prev, isOpen: false }));
    } catch (error) {
      toast.error("An error occurred while processing your request.");
      setConfirmModal(prev => ({ ...prev, isOpen: false }));
    } finally {
      setIsProcessing(false);
    }
  };
  const handleStartQueue = (scheduleOrId) => {
    const scheduleObj = typeof scheduleOrId === 'string' ? schedules.find(s => s.id === scheduleOrId) : scheduleOrId;
    setScheduleActionModal({
      isOpen: true,
      action: "startQueue",
      schedule: scheduleObj,
    });
  };
  const executeScheduleAction = async () => {
    if (!scheduleActionModal.schedule || !scheduleActionModal.action) return;
    setIsProcessing(true);
    try {
      if (scheduleActionModal.action === "publish") {
        await publishSchedule(scheduleActionModal.schedule.id);
        await loadSchedules();
        toast.success("The schedule is now visible to parents.");
        setScheduleActionModal({ isOpen: false, action: null, schedule: null });
      } else if (scheduleActionModal.action === "startQueue") {
        const { updateQueueStatus } = await import("../../services/scheduleService");
        await updateQueueStatus(scheduleActionModal.schedule.id, 'active');
        await loadSchedules();
        toast.success("Clinic queue has been started.");
        setScheduleActionModal({ isOpen: false, action: null, schedule: null });
        navigate("/doctor/queue");
      }
    } catch (error) {
      console.error(error);
      toast.error("An error occurred while processing your request.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleOpenQueueControl = () => {
    navigate("/doctor/queue");
  };

  const getAvailableSlots = (schedule) => {
    const count = reservations.filter(r => r.scheduleId === schedule.id && ['reserved', 'checked_in', 'in_consultation', 'validation_open', 'waiting_for_window'].includes(r.status)).length;
    return schedule.slotCapacity - count;
  };
  const getReservedCount = (schedule) => {
    return reservations.filter(r => r.scheduleId === schedule.id && ['reserved', 'checked_in', 'in_consultation', 'validation_open', 'waiting_for_window'].includes(r.status)).length;
  };
  const getCheckedInCount = (schedule) => {
    return reservations.filter(r => r.scheduleId === schedule.id && (r.status === 'checked_in' || r.checkedIn)).length;
  };

  const getLocalStatus = (schedule) => {
    if (schedule.status === 'draft') return 'Draft';
    if (schedule.status === 'completed' || schedule.queueStatus === 'completed' || schedule.queueStatus === 'ended') return 'Completed';
    if (schedule.status === 'published') return 'Published';
    return 'Unknown';
  };

  const isAnyQueueActive = schedules.some(s => s.status === 'published' && (s.queueStatus === 'active' || s.queueStatus === 'paused' || s.queueStatus === 'closed'));

  const activeQueue = useMemo(() => {
    return schedules.find(s => s.status === 'published' && (s.queueStatus === 'active' || s.queueStatus === 'paused' || s.queueStatus === 'closed'));
  }, [schedules]);

  const formatTime = (time) => {
    if (!time) return '';
    const [hours, minutes] = time.split(':');
    const h = parseInt(hours, 10);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const formattedH = h % 12 || 12;
    return `${formattedH}:${minutes} ${ampm}`;
  };

  // Filter & Search
  const filteredSchedules = useMemo(() => {
    return schedules.filter(s => {
      const isActiveQueue = s.status === 'published' && (s.queueStatus === 'active' || s.queueStatus === 'paused' || s.queueStatus === 'closed');
      if (isActiveQueue) {
        return false;
      }

      const stat = getLocalStatus(s);
      
      // Filter dropdown
      if (currentFilter !== 'All' && stat !== currentFilter) {
        return false;
      }
      
      // Search text
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (
          !s.branch.toLowerCase().includes(query) &&
          !s.clinicDate.toLowerCase().includes(query) &&
          !stat.toLowerCase().includes(query)
        ) {
          return false;
        }
      }
      return true;
    }).sort((a, b) => new Date(a.clinicDate) - new Date(b.clinicDate));
  }, [schedules, currentFilter, searchQuery]);

  return (
    <div className="w-full pb-20 pt-4">
      
      {/* Dedicated Active Queue Card */}
      {activeQueue && (
        <div className="bg-gradient-to-r from-green-600 to-emerald-700 rounded-2xl p-6 text-white shadow-lg mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 animate-in fade-in">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-black bg-white/20 text-white uppercase tracking-wider">
                Current Active Queue
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-green-900/40 text-green-200">
                Status: {activeQueue.queueStatus === 'closed' ? 'Queue Closed' : activeQueue.queueStatus === 'paused' ? 'Paused' : 'Active'}
              </span>
            </div>
            <h2 className="text-2xl font-black">{activeQueue.branch} Branch</h2>
            <div className="text-green-100 text-sm mt-1 flex flex-wrap items-center gap-2 sm:gap-4">
              <span>Clinic Date: <strong className="text-white">{new Date(activeQueue.clinicDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</strong></span>
              <span>•</span>
              <span>Time: <strong className="text-white">{formatTime(activeQueue.openingTime)} – {formatTime(activeQueue.closingTime)}</strong></span>
            </div>
          </div>
          <button 
            onClick={() => navigate("/doctor/queue")}
            className="px-6 py-3.5 bg-white text-green-700 font-bold rounded-xl shadow-md hover:bg-green-50 transition-all flex items-center shrink-0 w-full sm:w-auto justify-center"
          >
            Open Queue Control <Activity className="w-4 h-4 ml-2" />
          </button>
        </div>
      )}

      {/* Filter and Search */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input 
            type="text" 
            placeholder="Search branch, date, or status..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all shadow-sm"
          />
        </div>
        <div className="relative min-w-[200px]">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
          <select 
            value={currentFilter}
            onChange={(e) => setCurrentFilter(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all shadow-sm appearance-none font-medium text-gray-700 cursor-pointer"
          >
            <option value="All">All Statuses</option>
            <option value="Draft">Draft</option>
            <option value="Published">Published</option>
            <option value="Completed">Completed</option>
          </select>
        </div>
      </div>

      {/* Active Queue Warning */}
      {isAnyQueueActive && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-amber-800 flex items-start text-sm font-medium mb-6 animate-in fade-in">
          <p>You already have an active clinic queue. End the current queue before starting another.</p>
        </div>
      )}

      {/* Schedule List */}
      {filteredSchedules.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-12 text-center mt-4">
          <CalendarX className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-gray-800 mb-2">No schedules found</h3>
          <p className="text-gray-500">Try adjusting your filters or search query.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filteredSchedules.map((schedule) => (
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
              onStartQueue={handleStartQueue}
              onOpenQueueControl={handleOpenQueueControl}
              isStartQueueDisabled={isAnyQueueActive}
            />
          ))}
        </div>
      )}

      {/* Floating Action Button */}
      <button
        onClick={handleOpenCreateModal}
        className="fixed bottom-20 right-8 w-14 h-14 bg-blue-600 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-blue-700 hover:scale-105 transition-all z-100"
        title="Add Schedule"
      >
        <Plus className="w-6 h-6" />
      </button>

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

      <ScheduleConfirmModal
        isOpen={scheduleActionModal.isOpen}
        title={scheduleActionModal.action === "publish" ? "Publish Schedule" : "Start Clinic Queue"}
        description={
          scheduleActionModal.action === "publish"
            ? "Please review the schedule details below before publishing. Once published, parents will immediately be able to reserve available slots for this clinic schedule."
            : "Please review the selected clinic schedule before starting today's queue.\n\nOnce the queue starts:\n• Parents may begin QR validation.\n• The secretary may begin checking in patients.\n• Consultations may begin."
        }
        schedule={scheduleActionModal.schedule}
        confirmText={scheduleActionModal.action === "publish" ? "Publish Schedule" : "Start Queue"}
        cancelText="Cancel"
        onConfirm={executeScheduleAction}
        onCancel={() => setScheduleActionModal({ isOpen: false, action: null, schedule: null })}
        loading={isProcessing}
        icon={scheduleActionModal.action === "publish" ? CalendarCheck : PlayCircle}
      />
    </div>
  );
}