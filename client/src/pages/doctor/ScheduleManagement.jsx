import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { getSchedules, deleteSchedule, publishSchedule, completeSchedule } from "../../services/scheduleService";
import { subscribeToAllReservations, ACTIVE_RESERVATION_STATUSES } from "../../services/reservationService";
import { getBranchConfigurations } from "../../services/branchConfigurationService";
import ScheduleCard from "../../components/schedule/ScheduleCard";
import ScheduleFormModal from "../../components/schedule/ScheduleFormModal";
import ScheduleDetailsModal from "../../components/doctor/ScheduleDetailsModal";
import ConfirmationModal from "../../components/common/ConfirmationModal";
import ScheduleConfirmModal from "../../components/schedule/ScheduleConfirmModal";
import { Plus, Search, Filter, PlayCircle, CalendarX, CalendarCheck, Activity } from "lucide-react";
import toast from "react-hot-toast";
import { sortSchedules } from "../../utils/scheduleUtils";

export default function ScheduleManagement() {
  const navigate = useNavigate();
  const [schedules, setSchedules] = useState([]);
  const [branches, setBranches] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("create");
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  
  const [currentFilter, setCurrentFilter] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  
  const [reservations, setReservations] = useState([]);
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, action: null, scheduleId: null, title: "", message: "", confirmText: "Confirm" });
  const [scheduleActionModal, setScheduleActionModal] = useState({ isOpen: false, action: null, schedule: null });
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    const unsub = subscribeToAllReservations((data) => {
      setReservations(data);
    });
    getBranchConfigurations().then(setBranches);
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
  // check closing time validation bago i-publish
  const executeScheduleAction = async () => {
    if (!scheduleActionModal.schedule || !scheduleActionModal.action) return;
    setIsProcessing(true);
    try {
      if (scheduleActionModal.action === "publish") {
        const { validateScheduleClosingTime } = await import("../../services/scheduleService");
        const timeValidation = await validateScheduleClosingTime(scheduleActionModal.schedule.branch, scheduleActionModal.schedule.clinicDate);
        if (!timeValidation.valid) {
          toast.error(timeValidation.message);
          setIsProcessing(false);
          return;
        }
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
      toast.error(error.message || "An error occurred while processing your request.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleOpenQueueControl = () => {
    navigate("/doctor/queue");
  };

  // compute available and reserved slots gamit ang active statuses para hindi mag-release habang in_consultation/with_doctor pa
  const getAvailableSlots = (schedule) => {
    const count = reservations.filter(r => r.scheduleId === schedule.id && ACTIVE_RESERVATION_STATUSES.includes(r.status)).length;
    return schedule.slotCapacity - count;
  };
  const getReservedCount = (schedule) => {
    return reservations.filter(r => r.scheduleId === schedule.id && ACTIVE_RESERVATION_STATUSES.includes(r.status)).length;
  };
  const getCheckedInCount = (schedule) => {
    return reservations.filter(r => r.scheduleId === schedule.id && (r.status === 'checked_in' || r.checkedIn)).length;
  };
  const getTotalReservations = (schedule) => {
    return reservations.filter(r => r.scheduleId === schedule.id).length;
  };
  const getCheckedUpCount = (schedule) => {
    return reservations.filter(r => r.scheduleId === schedule.id && ["completed", "consultation_completed"].includes(r.status)).length;
  };
  const getCancelledCount = (schedule) => {
    return reservations.filter(r => r.scheduleId === schedule.id && r.status === 'cancelled').length;
  };
  const getForfeitedCount = (schedule) => {
    return reservations.filter(r => r.scheduleId === schedule.id && ["forfeited", "penalized", "late_limit_reached"].includes(r.status)).length;
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
    const validSchedules = schedules.filter(s => {
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
    });

    return sortSchedules(validSchedules);
  }, [schedules, currentFilter, searchQuery]);

  // Pagination
  const PAGE_SIZE = 10;
  const totalPages = Math.max(1, Math.ceil(filteredSchedules.length / PAGE_SIZE));
  const validCurrentPage = Math.min(currentPage, totalPages);

  const startIndex = (validCurrentPage - 1) * PAGE_SIZE;
  const paginatedSchedules = filteredSchedules.slice(startIndex, startIndex + PAGE_SIZE);

  return (
    <div className="w-full pb-20 pt-4">
      
      {/* Filter and Search */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input 
            type="text" 
            placeholder="Search branch, date, or status..." 
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all shadow-sm"
          />
        </div>
        <div className="relative min-w-[200px]">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
          <select 
            value={currentFilter}
            onChange={(e) => {
              setCurrentFilter(e.target.value);
              setCurrentPage(1);
            }}
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
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {paginatedSchedules.map((schedule) => (
              <ScheduleCard
                key={schedule.id}
                schedule={schedule}
                availableSlots={getAvailableSlots(schedule)}
                reservedCount={getReservedCount(schedule)}
                checkedInCount={getCheckedInCount(schedule)}
                totalReservations={getTotalReservations(schedule)}
                checkedUpCount={getCheckedUpCount(schedule)}
                cancelledCount={getCancelledCount(schedule)}
                forfeitedCount={getForfeitedCount(schedule)}
                onViewDetails={handleViewDetails}
                onEdit={handleOpenEditModal}
                onDelete={handleDelete}
                onPublish={handlePublish}
                onStartQueue={handleStartQueue}
                onOpenQueueControl={handleOpenQueueControl}
                isStartQueueDisabled={isAnyQueueActive}
                clinicAddress={branches.find(b => b.name === schedule.branch)?.clinicAddress}
              />
            ))}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50/50 gap-4 md:flex-none z-10 rounded-b-xl">
              <div className="text-sm text-gray-500 font-medium text-center sm:text-left">
                Showing {startIndex + 1}–{Math.min(validCurrentPage * PAGE_SIZE, filteredSchedules.length)} of {filteredSchedules.length} schedules
              </div>
              <div className="flex items-center justify-center gap-2">
                <button 
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={validCurrentPage === 1}
                  className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Previous
                </button>
                
                <div className="hidden sm:flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`w-8 h-8 flex items-center justify-center rounded-lg border text-sm font-medium transition-colors ${
                        validCurrentPage === page 
                          ? 'bg-blue-600 text-white border-blue-600' 
                          : 'border-gray-200 text-gray-600 bg-white hover:bg-gray-50'
                      }`}
                    >
                      {page}
                    </button>
                  ))}
                </div>

                <button 
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={validCurrentPage === totalPages}
                  className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}
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