import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { getSchedules, deleteSchedule, publishSchedule, completeSchedule } from "../../services/scheduleService";
import { subscribeToAllReservations } from "../../services/reservationService";
import ScheduleCard from "../../components/schedule/ScheduleCard";
import ScheduleFormModal from "../../components/schedule/ScheduleFormModal";
import ScheduleDetailsModal from "../../components/doctor/ScheduleDetailsModal";
import ConfirmationModal from "../../components/common/ConfirmationModal";
import ScheduleConfirmModal from "../../components/schedule/ScheduleConfirmModal";
import { Plus, Search, Filter, AlertCircle, CheckCircle2, PlayCircle, CalendarX, CalendarCheck } from "lucide-react";
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
    const count = reservations.filter(r => r.scheduleId === schedule.id && ['reserved', 'checked_in', 'in_consultation'].includes(r.status)).length;
    return schedule.slotCapacity - count;
  };
  const getReservedCount = (schedule) => {
    return reservations.filter(r => r.scheduleId === schedule.id && ['reserved', 'checked_in', 'in_consultation'].includes(r.status)).length;
  };
  const getCheckedInCount = (schedule) => {
    return reservations.filter(r => r.scheduleId === schedule.id && (r.status === 'checked_in' || r.checkedIn)).length;
  };

  const getLocalStatus = (schedule) => {
    if (schedule.status === 'draft') return 'Draft';
    if (schedule.status === 'completed' || schedule.queueStatus === 'completed' || schedule.queueStatus === 'ended') return 'Completed';
    if (schedule.queueStatus === 'active' || schedule.queueStatus === 'paused') return 'Active';
    if (schedule.status === 'published') {
      if (schedule.isReady) return 'Ready';
      return 'Published';
    }
    return 'Unknown';
  };

  const isAnyQueueActive = schedules.some(s => s.status === 'published' && (s.queueStatus === 'active' || s.queueStatus === 'paused'));

  // Stats
  const stats = useMemo(() => {
    let draft = 0, published = 0, ready = 0, completed = 0;
    schedules.forEach(s => {
      const stat = getLocalStatus(s);
      if (stat === 'Draft') draft++;
      else if (stat === 'Published') published++;
      else if (stat === 'Ready') ready++;
      else if (stat === 'Completed') completed++;
    });
    return { draft, published, ready, completed };
  }, [schedules]);

  // Filter & Search
  const filteredSchedules = useMemo(() => {
    return schedules.filter(s => {
      const stat = getLocalStatus(s);
      
      // Filter dropdown
      if (currentFilter !== 'All' && stat !== currentFilter && !(currentFilter === 'Active' && stat === 'Active')) {
        if (currentFilter !== stat) return false;
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
    <div className="w-full pb-20">
      
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Schedule Management</h1>
        <p className="text-gray-500 mt-1">Manage all clinic schedules and monitor statuses in one place.</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div 
          onClick={() => setCurrentFilter(currentFilter === 'Draft' ? 'All' : 'Draft')}
          className={`bg-white p-5 rounded-2xl border cursor-pointer transition-all ${currentFilter === 'Draft' ? 'border-gray-800 shadow-md ring-2 ring-gray-200' : 'border-gray-200 shadow-sm hover:border-gray-400'}`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-600"><AlertCircle className="w-5 h-5"/></div>
            <div className="text-2xl font-black text-gray-800">{stats.draft}</div>
          </div>
          <div className="font-bold text-gray-600 text-sm">Draft</div>
        </div>

        <div 
          onClick={() => setCurrentFilter(currentFilter === 'Published' ? 'All' : 'Published')}
          className={`bg-white p-5 rounded-2xl border cursor-pointer transition-all ${currentFilter === 'Published' ? 'border-amber-500 shadow-md ring-2 ring-amber-200' : 'border-gray-200 shadow-sm hover:border-amber-300'}`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center text-amber-600"><CheckCircle2 className="w-5 h-5"/></div>
            <div className="text-2xl font-black text-gray-800">{stats.published}</div>
          </div>
          <div className="font-bold text-gray-600 text-sm">Published</div>
        </div>

        <div 
          onClick={() => setCurrentFilter(currentFilter === 'Ready' ? 'All' : 'Ready')}
          className={`bg-white p-5 rounded-2xl border cursor-pointer transition-all ${currentFilter === 'Ready' ? 'border-blue-500 shadow-md ring-2 ring-blue-200' : 'border-gray-200 shadow-sm hover:border-blue-300'}`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600"><PlayCircle className="w-5 h-5"/></div>
            <div className="text-2xl font-black text-gray-800">{stats.ready}</div>
          </div>
          <div className="font-bold text-gray-600 text-sm">Ready</div>
        </div>

        <div 
          onClick={() => setCurrentFilter(currentFilter === 'Completed' ? 'All' : 'Completed')}
          className={`bg-white p-5 rounded-2xl border cursor-pointer transition-all ${currentFilter === 'Completed' ? 'border-gray-500 shadow-md ring-2 ring-gray-200' : 'border-gray-200 shadow-sm hover:border-gray-300'}`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-500"><CheckCircle2 className="w-5 h-5"/></div>
            <div className="text-2xl font-black text-gray-800">{stats.completed}</div>
          </div>
          <div className="font-bold text-gray-600 text-sm">Completed</div>
        </div>
      </div>

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
            <option value="Ready">Ready</option>
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