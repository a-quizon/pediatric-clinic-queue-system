import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { getSchedules, deleteSchedule, publishSchedule } from "../../services/scheduleService";
import { subscribeToAllReservations, ACTIVE_RESERVATION_STATUSES } from "../../services/reservationService";
import { getBranchConfigurations } from "../../services/branchConfigurationService";
import ScheduleCard from "./ScheduleCard";
import ScheduleFormModal from "./ScheduleFormModal";
import ScheduleDetailsModal from "../doctor/ScheduleDetailsModal";
import ConfirmationModal from "../common/ConfirmationModal";
import ScheduleConfirmModal from "./ScheduleConfirmModal";
import { Plus, Search, ChevronDown, PlayCircle, CalendarX, CalendarCheck } from "lucide-react";
import toast from "react-hot-toast";
import { sortSchedules } from "../../utils/scheduleUtils";
import { useAuth } from "../../hooks/useAuth";
import { useTourSample } from "../../hooks/useTourPreview";
import { scheduleMatchesAssignedBranch } from "../../utils/stringUtils";
import { TourSampleSchedulePublish } from "../onboarding/SecretaryTourSampleViews";

/**
 * Shared schedule lifecycle UI (create / publish / start queue).
 * Used by Secretary and Doctor. Filters to assigned branch when the user is a secretary.
 */
export default function ScheduleManagement({
  queuePath = "/secretary/queue",
  queueControlLabel = "Manage Queue",
}) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const showSecretaryScheduleSample = useTourSample(["schedule-publish", "schedule-form"]);
  const showDoctorScheduleSample = useTourSample(["doctor-schedule-publish", "doctor-schedule-form"]);
  const showScheduleSample = showSecretaryScheduleSample || showDoctorScheduleSample;
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

  const lockBranch = user?.role === "secretary";

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
      let scheduleArray = Object.entries(data).map(([id, value]) => ({
        id,
        ...value,
      }));
      if (lockBranch && user) {
        scheduleArray = scheduleArray.filter((s) => scheduleMatchesAssignedBranch(s, user));
      }
      setSchedules(scheduleArray);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    loadSchedules();
  }, [user?.assignedBranch, user?.assignedBranchId, lockBranch]);

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
    const scheduleObj = typeof scheduleOrId === "string" ? schedules.find((s) => s.id === scheduleOrId) : scheduleOrId;
    setScheduleActionModal({
      isOpen: true,
      action: "publish",
      schedule: scheduleObj,
    });
  };
  const executeConfirmAction = async () => {
    if (!confirmModal.scheduleId || !confirmModal.action) return;
    setIsProcessing(true);
    try {
      if (confirmModal.action === "delete") {
        await deleteSchedule(confirmModal.scheduleId);
        await loadSchedules();
      }
      setConfirmModal((prev) => ({ ...prev, isOpen: false }));
    } catch (error) {
      toast.error("An error occurred while processing your request.");
      setConfirmModal((prev) => ({ ...prev, isOpen: false }));
    } finally {
      setIsProcessing(false);
    }
  };
  const handleStartQueue = (scheduleOrId) => {
    const scheduleObj = typeof scheduleOrId === "string" ? schedules.find((s) => s.id === scheduleOrId) : scheduleOrId;
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
        await updateQueueStatus(scheduleActionModal.schedule.id, "active");
        await loadSchedules();
        toast.success("Clinic queue has been started.");
        setScheduleActionModal({ isOpen: false, action: null, schedule: null });
        navigate(queuePath);
      }
    } catch (error) {
      console.error(error);
      toast.error(error.message || "An error occurred while processing your request.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleOpenQueueControl = () => {
    navigate(queuePath);
  };

  const getAvailableSlots = (schedule) => {
    const count = reservations.filter((r) => r.scheduleId === schedule.id && ACTIVE_RESERVATION_STATUSES.includes(r.status)).length;
    return schedule.slotCapacity - count;
  };
  const getReservedCount = (schedule) => {
    return reservations.filter((r) => r.scheduleId === schedule.id && ACTIVE_RESERVATION_STATUSES.includes(r.status)).length;
  };
  const getCheckedInCount = (schedule) => {
    return reservations.filter((r) => r.scheduleId === schedule.id && (r.status === "checked_in" || r.checkedIn)).length;
  };
  const getTotalReservations = (schedule) => {
    return reservations.filter((r) => r.scheduleId === schedule.id).length;
  };
  const getCheckedUpCount = (schedule) => {
    return reservations.filter((r) => r.scheduleId === schedule.id && ["completed", "consultation_completed"].includes(r.status)).length;
  };
  const getCancelledCount = (schedule) => {
    return reservations.filter((r) => r.scheduleId === schedule.id && r.status === "cancelled").length;
  };
  const getForfeitedCount = (schedule) => {
    return reservations.filter((r) => r.scheduleId === schedule.id && ["forfeited", "penalized", "late_limit_reached"].includes(r.status)).length;
  };

  const getLocalStatus = (schedule) => {
    if (schedule.status === "draft") return "Draft";
    if (schedule.status === "completed" || schedule.queueStatus === "completed" || schedule.queueStatus === "ended") return "Completed";
    if (schedule.status === "published") return "Published";
    return "Unknown";
  };

  const isAnyQueueActive = schedules.some((s) => s.status === "published" && (s.queueStatus === "active" || s.queueStatus === "paused" || s.queueStatus === "closed"));

  const filteredSchedules = useMemo(() => {
    const validSchedules = schedules.filter((s) => {
      const stat = getLocalStatus(s);

      if (currentFilter !== "All" && stat !== currentFilter) {
        return false;
      }

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

  const PAGE_SIZE = 10;
  const totalPages = Math.max(1, Math.ceil(filteredSchedules.length / PAGE_SIZE));
  const validCurrentPage = Math.min(currentPage, totalPages);

  const startIndex = (validCurrentPage - 1) * PAGE_SIZE;
  const paginatedSchedules = filteredSchedules.slice(startIndex, startIndex + PAGE_SIZE);

  if (showScheduleSample) {
    return (
      <TourSampleSchedulePublish
        showForm
        publishTourId={showDoctorScheduleSample ? "doctor-schedule-publish" : "schedule-publish"}
        formTourId={showDoctorScheduleSample ? "doctor-schedule-form" : "schedule-form"}
      />
    );
  }

  return (
    <div className="w-full pb-20 pt-2">
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 pq-faint" aria-hidden="true" />
          <input
            type="text"
            placeholder="Search branch, date, or status..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="pq-input pl-10"
            aria-label="Search schedules"
          />
        </div>
        <div className="relative min-w-[200px]">
          <select
            value={currentFilter}
            onChange={(e) => {
              setCurrentFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="pq-input pr-10 appearance-none cursor-pointer"
            aria-label="Filter by status"
          >
            <option value="All">All Statuses</option>
            <option value="Draft">Draft</option>
            <option value="Published">Published</option>
            <option value="Completed">Completed</option>
          </select>
          <div className="pq-field-icon" style={{ left: "auto", right: "0.85rem" }}>
            <ChevronDown className="w-4 h-4" aria-hidden="true" />
          </div>
        </div>
      </div>

      {isAnyQueueActive && (
        <div className="pq-note pq-note-wait mb-6">
          <p>You already have an active clinic queue. End the current queue before starting another.</p>
        </div>
      )}

      {filteredSchedules.length === 0 ? (
        <div className="pq-glass p-12 text-center mt-4">
          <CalendarX className="w-16 h-16 pq-faint mx-auto mb-4" aria-hidden="true" />
          <h3 className="text-xl font-extrabold tracking-tight mb-2">No schedules found</h3>
          <p className="pq-muted">Try adjusting your filters or create a new schedule.</p>
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
                queueControlLabel={queueControlLabel}
                isStartQueueDisabled={isAnyQueueActive}
                clinicAddress={branches.find((b) => b.name === schedule.branch)?.clinicAddress}
              />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between px-2 py-4 gap-4">
              <div className="text-sm pq-muted font-medium text-center sm:text-left">
                Showing {startIndex + 1}–{Math.min(validCurrentPage * PAGE_SIZE, filteredSchedules.length)} of {filteredSchedules.length} schedules
              </div>
              <div className="flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={validCurrentPage === 1}
                  className="pq-btn-secondary"
                >
                  Previous
                </button>

                <div className="hidden sm:flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                    <button
                      type="button"
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={validCurrentPage === page ? "pq-btn-primary" : "pq-btn-secondary"}
                      style={{ width: 44, height: 44, padding: 0 }}
                      aria-current={validCurrentPage === page ? "page" : undefined}
                    >
                      {page}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={validCurrentPage === totalPages}
                  className="pq-btn-secondary"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={handleOpenCreateModal}
        className="pq-btn-primary fixed bottom-24 right-6 md:bottom-8 md:right-8 z-30"
        style={{ width: 56, height: 56, padding: 0, borderRadius: 999 }}
        title="Add Schedule"
        aria-label="Add Schedule"
      >
        <Plus className="w-6 h-6" />
      </button>

      <ScheduleFormModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        mode={modalMode}
        schedule={selectedSchedule}
        onSuccess={handleSuccess}
        lockBranch={lockBranch}
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
        onClose={() => !isProcessing && setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
        isLoading={isProcessing}
        isDestructive
      />

      <ScheduleConfirmModal
        isOpen={scheduleActionModal.isOpen}
        title={scheduleActionModal.action === "publish" ? "Publish Schedule" : "Start Clinic Queue"}
        description={
          scheduleActionModal.action === "publish"
            ? "Please review the schedule details below before publishing. Once published, parents will immediately be able to reserve available slots for this clinic schedule."
            : "Please review the selected clinic schedule before starting today's queue.\n\nOnce the queue starts:\n• Parents may begin QR validation.\n• Check-in may begin at the desk.\n• Consultations may begin."
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
