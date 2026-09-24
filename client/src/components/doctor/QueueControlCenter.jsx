import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { subscribeToPublishedSchedules } from "../../services/scheduleService";
import { subscribeToScheduleReservations, startConsultation, completeConsultation, expireReservation, ACTIVE_RESERVATION_STATUSES } from "../../services/reservationService";
import { getNextEligiblePatient } from "../../services/queueEligibilityService";
import { isReservationExpired } from "../../services/timeService";
import { sortActiveQueue } from "../../services/queueEngine";
import { Activity, CheckCircle, User, AlertCircle, FileText, X, Clock, MapPin, Users, CheckCircle2, UserPlus } from "lucide-react";
import ScheduleConfirmModal from "../../components/schedule/ScheduleConfirmModal";
import ReservationStatusBadge from "../../components/common/ReservationStatusBadge";
import QueueSessionControls from "../common/QueueSessionControls";
import StartTodayQueue from "../common/StartTodayQueue";
import WalkInPatientModal from "../secretary/WalkInPatientModal";
import toast from "react-hot-toast";
import { useHistoryOverlay } from "../../hooks/useHistoryOverlay";
import { getReservationChildDisplayName, getReservationChildren } from "../../utils/reservationPatients";
import ReservationPatientNames from "../common/ReservationPatientNames";
import { PqSpinner } from "../parent/pqUi";
import { useTourSample } from "../../hooks/useTourPreview";
import { TourSampleDoctorQueue } from "../onboarding/DoctorTourSampleViews";

function WalkInChip({ reservation }) {
  if (reservation?.source !== "walk_in") return null;
  return <span className="pq-chip pq-chip-wait">Walk-in</span>;
}

export default function QueueControlCenter() {
  const navigate = useNavigate();
  const [schedules, setSchedules] = useState([]);
  const [schedulesLoaded, setSchedulesLoaded] = useState(false);
  const [reservations, setReservations] = useState([]);
  const [reservationsLoaded, setReservationsLoaded] = useState(false);

  const [isCompleteModalOpen, setIsCompleteModalOpen] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [doctorNotes, setDoctorNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
  const [infoPatient, setInfoPatient] = useState(null);
  const [isWalkInOpen, setIsWalkInOpen] = useState(false);
  useHistoryOverlay(isInfoModalOpen, () => setIsInfoModalOpen(false));
  useHistoryOverlay(isCompleteModalOpen, () => setIsCompleteModalOpen(false));

  useEffect(() => {
    const unsubSchedules = subscribeToPublishedSchedules((data) => {
      setSchedules(data);
      setSchedulesLoaded(true);
    });

    return () => unsubSchedules();
  }, []);

  const activeSchedule = useMemo(() => {
    return schedules.find(s => s.status === 'published' && (s.queueStatus === 'active' || s.queueStatus === 'paused' || s.queueStatus === 'closed'));
  }, [schedules]);
  const activeScheduleId = activeSchedule?.id;

  useEffect(() => {
    if (!activeScheduleId) {
      const timeoutId = setTimeout(() => {
        setReservations([]);
      }, 0);
      return () => clearTimeout(timeoutId);
    }

    const timeoutId = setTimeout(() => {
      setReservationsLoaded(false);
    }, 0);

    const unsubReservations = subscribeToScheduleReservations(activeScheduleId, (data) => {
      setReservations(data);
      setReservationsLoaded(true);
    });

    return () => {
      clearTimeout(timeoutId);
      unsubReservations();
    };
  }, [activeScheduleId]);
  
  const scheduleReservations = useMemo(() => {
    if (!activeSchedule) return [];
    return reservations.filter(r => r.scheduleId === activeSchedule.id);
  }, [reservations, activeSchedule]);

  const {
    waitingQueue,
    inConsultation,
  } = useMemo(() => {
    const activeWaitingStatuses = ["checked_in", "reserved", "waiting"];
    const waitingList = sortActiveQueue(
      scheduleReservations.filter(r => activeWaitingStatuses.includes(r.status))
    );

    const inCons = scheduleReservations.find(r => r.status === "in_consultation" || r.status === "with_doctor");
    
    return {
      waitingQueue: waitingList,
      inConsultation: inCons,
    };
  }, [scheduleReservations]);

  const canEndSession = waitingQueue.length === 0 && !inConsultation;
  const activeSlotCount = scheduleReservations.filter((r) =>
    ACTIVE_RESERVATION_STATUSES.includes(r.status)
  ).length;
  const slotCapacity = Number(activeSchedule?.slotCapacity || 0);
  const walkInQueueOpen = ["active", "paused"].includes(activeSchedule?.queueStatus);
  const walkInDayClosed = Boolean(activeSchedule?.dayClosed);
  const walkInFull = slotCapacity > 0 && activeSlotCount >= slotCapacity;
  const canAddWalkIn = Boolean(activeSchedule) && walkInQueueOpen && !walkInDayClosed && !walkInFull;
  const walkInDisabledReason = !activeSchedule
    ? "No live queue is running."
    : walkInDayClosed
      ? "This clinic day is closed."
      : !walkInQueueOpen
        ? "Walk-ins are only available while the queue is active or paused."
        : walkInFull
          ? "This day is full. A slot opens when someone cancels or finishes."
          : "";
  const showQueueSample = useTourSample([
    "doctor-queue-list",
    "doctor-queue-start",
    "doctor-queue-control",
    "doctor-consult-regular",
    "doctor-consult-walkin",
  ]);

  const handleOpenCompleteModal = (res) => {
    const currentQueueStatus = activeSchedule?.queueStatus || 'not_started';
    if (currentQueueStatus === "paused") {
      toast.error("Cannot complete consultation while queue is paused.");
      return;
    }
    if (currentQueueStatus === "ended" || currentQueueStatus === "completed") {
      toast.error("Cannot complete consultation. The queue has ended.");
      return;
    }
    setSelectedPatient(res);
    setDoctorNotes("");
    setIsCompleteModalOpen(true);
  };

  const handleComplete = async () => {
    if (!selectedPatient) return;
    setIsSubmitting(true);
    try {
      const isWalkIn = selectedPatient.source === "walk_in";
      await completeConsultation(
        selectedPatient.id,
        isWalkIn ? "" : doctorNotes.trim()
      );
      toast.success("Consultation completed successfully.");
      setIsCompleteModalOpen(false);
      setSelectedPatient(null);
    } catch (err) {
      console.error(err);
      toast.error("Failed to complete consultation.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const loading = !schedulesLoaded || (!!activeSchedule && !reservationsLoaded);

  if (showQueueSample) {
    return <TourSampleDoctorQueue />;
  }

  if (loading) {
    return (
      <div className="space-y-6 pb-6 mt-6">
        <div className="pq-glass p-10">
          <PqSpinner label="Loading queue" />
        </div>
      </div>
    );
  }

  if (!activeSchedule) {
    return (
      <div className="space-y-6 pb-6 text-center py-20 pq-glass mt-6">
        <Activity className="w-12 h-12 pq-faint mx-auto mb-4" aria-hidden="true" />
        <h2 className="text-xl font-extrabold tracking-tight mb-2">No Clinic Queue is Currently Active</h2>
        <p className="pq-muted max-w-md mx-auto mb-6">No queue is running. Start today's published schedule here, or open the calendar to publish or close a day.</p>
        <StartTodayQueue schedules={schedules} />
        <button type="button" className="pq-btn-secondary" onClick={() => navigate("/doctor/schedules")}>Open schedule calendar</button>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-6">
      <div className="pq-glass p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-extrabold tracking-tight flex items-center">
              <MapPin className="w-5 h-5 mr-2" style={{ color: "var(--pq-mark-blue)" }} aria-hidden="true" />
              {activeSchedule.branch}
            </h2>
            <div className="pq-muted text-sm mt-1 flex flex-wrap items-center gap-x-4 gap-y-1">
              <span className="flex items-center">
                <Clock className="w-4 h-4 mr-1.5" aria-hidden="true" />
                {new Date(activeSchedule.clinicDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </span>
            </div>
          </div>
          
          <QueueSessionControls
            schedule={activeSchedule}
            canEndSession={canEndSession}
          />
        </div>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={() => setIsWalkInOpen(true)}
            disabled={!canAddWalkIn}
            className="pq-btn-primary w-full sm:w-auto"
            title={walkInDisabledReason || "Add a walk-in patient to this queue"}
          >
            <UserPlus className="w-4 h-4 shrink-0" aria-hidden="true" />
            Add Walk-in
          </button>
          {walkInDisabledReason ? (
            <p className="text-xs pq-muted">{walkInDisabledReason}</p>
          ) : null}
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 items-stretch">
        <div className="flex-[4] pq-glass overflow-hidden flex flex-col">
        <div className="pq-now mx-0 rounded-none" style={{ borderRadius: 0, border: "none", borderBottom: "1px solid color-mix(in srgb, var(--pq-live) 18%, white)" }}>
          <h3 className="font-extrabold flex items-center" style={{ color: "var(--pq-live)" }}>
            {inConsultation ? <span className="pq-pip mr-2" /> : <Activity className="w-4 h-4 mr-2" aria-hidden="true" />}
            Current Consultation
          </h3>
          {inConsultation && (
            <span className="pq-chip pq-chip-live">
              Queue #{inConsultation.queueNumber || inConsultation.queuePosition}
            </span>
          )}
        </div>
        
        {inConsultation ? (
          <div 
            className="p-6 cursor-pointer"
            onClick={() => {
              setInfoPatient(inConsultation);
              setIsInfoModalOpen(true);
            }}
          >
            <div className="mb-6">
              <div className="flex justify-between items-start gap-3">
                <div className="min-w-0 flex-1 mb-1">
                  <ReservationPatientNames
                    reservation={inConsultation}
                    nameClassName="font-extrabold tracking-tight text-2xl"
                  />
                  <div className="mt-2 flex flex-wrap gap-2">
                    <WalkInChip reservation={inConsultation} />
                  </div>
                </div>
                <button
                  type="button"
                  className="pq-btn-ghost text-xs shrink-0 min-h-[44px]"
                  onClick={(e) => {
                    e.stopPropagation();
                    setInfoPatient(inConsultation);
                    setIsInfoModalOpen(true);
                  }}
                >
                  View Details
                </button>
              </div>
              <div className="text-sm pq-muted flex flex-col gap-1 mt-2">
                {getReservationChildren(inConsultation).length > 0 ? (
                  getReservationChildren(inConsultation).map((child, index) => (
                    <span key={child.childId || index} className="flex items-center">
                      <User className="w-4 h-4 mr-1.5" aria-hidden="true" />
                      {child.childName}: {child.age || "N/A"} • {child.sex || "N/A"}
                    </span>
                  ))
                ) : (
                  <>
                    <span className="flex items-center"><User className="w-4 h-4 mr-1.5" aria-hidden="true" /> Age: {inConsultation.age || "N/A"}</span>
                    <span className="flex items-center">Sex: {inConsultation.sex || "N/A"}</span>
                  </>
                )}
              </div>
            </div>
            
            <div className="pq-note pq-note-wait mb-6">
              <div className="text-xs font-extrabold uppercase tracking-wider mb-2 flex items-center">
                <AlertCircle className="w-4 h-4 mr-1.5" aria-hidden="true" /> Concern / Reason for Visit
              </div>
              <div className="font-medium text-sm whitespace-pre-wrap" style={{ color: "var(--pq-ink)" }}>
                {inConsultation.concern || "No specific concern provided by the parent."}
              </div>
            </div>
            
            <button 
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleOpenCompleteModal(inConsultation);
              }}
              className="pq-btn-live w-full relative z-10"
            >
              <CheckCircle className="w-5 h-5" aria-hidden="true" /> Complete Consultation
            </button>
          </div>
        ) : (
          <div className="p-10 text-center pq-faint">
            <Activity className="w-10 h-10 mx-auto mb-3 opacity-50" aria-hidden="true" />
            <p className="font-medium">No patient currently in consultation.</p>
          </div>
        )}
      </div>

        <div className="flex-[6] pq-glass p-5 flex flex-col">
        <h3 className="font-extrabold tracking-tight mb-4 flex items-center">
          <Users className="w-5 h-5 mr-2" style={{ color: "var(--pq-mark-blue)" }} aria-hidden="true" /> 
          Waiting Queue <span className="ml-2 pq-chip pq-chip-info">{waitingQueue.length}</span>
        </h3>
        
        {waitingQueue.length > 0 ? (
          <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
            {waitingQueue.map(res => {
              const expired = isReservationExpired(res, activeSchedule);
              return (
                <div 
                  key={res.id}
                  className="pq-row items-start sm:items-center"
                >
                  <div className="flex items-start min-w-0 flex-1 gap-4">
                    <div className="pq-queue-plate">
                      {res.queueNumber || res.queuePosition}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <ReservationPatientNames
                          reservation={res}
                          fallback={res.parentEmail || "Unnamed Patient"}
                        />
                        <WalkInChip reservation={res} />
                      </div>
                      <ReservationStatusBadge status={expired ? "expired" : res.status} />
                    </div>
                  </div>
                  {res.checkedInAt && (
                    <div className="text-right hidden sm:block shrink-0">
                      <div className="text-[10px] pq-faint font-extrabold uppercase tracking-wider mb-1">Checked In</div>
                      <div className="text-sm font-semibold pq-muted">
                        {new Date(res.checkedInAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-10 text-sm pq-muted rounded-xl border border-dashed" style={{ borderColor: "var(--pq-glass-line)", background: "color-mix(in srgb, #ffffff 45%, transparent)" }}>
            No patients currently in the waiting queue.
          </div>
        )}
        </div>
      </div>

      {isInfoModalOpen && infoPatient && (
        <div className="pq-modal-scrim">
          <div className="pq-modal w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]" role="dialog" aria-modal="true" aria-labelledby="patient-details-title">
            <div className="flex justify-between items-center p-5" style={{ borderBottom: "1px solid var(--pq-glass-line)" }}>
              <h2 id="patient-details-title" className="text-lg font-extrabold tracking-tight flex items-center">
                <FileText className="w-5 h-5 mr-2" style={{ color: "var(--pq-mark-blue)" }} aria-hidden="true" />
                Patient Details
              </h2>
              <button type="button" onClick={() => setIsInfoModalOpen(false)} className="pq-icon-btn" aria-label="Close">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
              <div className="flex justify-between items-start mb-6 gap-3">
                <div>
                  <div className="text-xs pq-faint font-extrabold uppercase tracking-wider mb-1">Patient</div>
                  <div className="text-2xl font-extrabold tracking-tight">{getReservationChildDisplayName(infoPatient)}</div>
                  <div className="mt-2"><WalkInChip reservation={infoPatient} /></div>
                </div>
                <div className="pq-queue-plate" style={{ width: "auto", minWidth: "3.25rem", padding: "0 0.75rem", background: "color-mix(in srgb, var(--pq-mark-blue) 12%, white)", color: "var(--pq-mark-blue-deep)", borderColor: "color-mix(in srgb, var(--pq-mark-blue) 22%, white)" }}>
                  #{infoPatient.queueNumber || infoPatient.queuePosition}
                </div>
              </div>
              
              <div className="space-y-4">
                <div className="space-y-3">
                  {getReservationChildren(infoPatient).length > 0 ? (
                    getReservationChildren(infoPatient).map((child, index) => (
                      <div key={child.childId || index} className="grid grid-cols-2 gap-3">
                        <div className="col-span-2 pq-row" style={{ minHeight: 0, display: "block" }}>
                          <div className="text-[10px] pq-faint font-extrabold uppercase tracking-wider mb-1">Child</div>
                          <div className="font-semibold text-sm">{child.childName || "N/A"}</div>
                        </div>
                        <div className="pq-row" style={{ minHeight: 0, display: "block" }}>
                          <div className="text-[10px] pq-faint font-extrabold uppercase tracking-wider mb-1">Age</div>
                          <div className="font-semibold text-sm">{child.age || "N/A"}</div>
                        </div>
                        <div className="pq-row" style={{ minHeight: 0, display: "block" }}>
                          <div className="text-[10px] pq-faint font-extrabold uppercase tracking-wider mb-1">Sex</div>
                          <div className="font-semibold text-sm">{child.sex || "N/A"}</div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="pq-row" style={{ minHeight: 0, display: "block" }}>
                        <div className="text-[10px] pq-faint font-extrabold uppercase tracking-wider mb-1">Age</div>
                        <div className="font-semibold text-sm">{infoPatient.age || "N/A"}</div>
                      </div>
                      <div className="pq-row" style={{ minHeight: 0, display: "block" }}>
                        <div className="text-[10px] pq-faint font-extrabold uppercase tracking-wider mb-1">Sex</div>
                        <div className="font-semibold text-sm">{infoPatient.sex || "N/A"}</div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="pq-note pq-note-wait">
                  <div className="text-xs font-extrabold uppercase tracking-wider mb-2 flex items-center">
                    <AlertCircle className="w-4 h-4 mr-1.5" aria-hidden="true" /> Concern / Reason for Visit
                  </div>
                  <div className="font-medium text-sm whitespace-pre-wrap" style={{ color: "var(--pq-ink)" }}>
                    {infoPatient.concern || "No concern provided by parent."}
                  </div>
                </div>
              </div>
            </div>

            <div className="p-5 flex justify-end shrink-0" style={{ borderTop: "1px solid var(--pq-glass-line)" }}>
              <button 
                type="button"
                onClick={() => setIsInfoModalOpen(false)}
                className="pq-btn-primary"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {isCompleteModalOpen && selectedPatient && (
        <div className="pq-modal-scrim">
          <div className="pq-modal w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]" role="dialog" aria-modal="true" aria-labelledby="complete-consult-title">
            <div className="flex justify-between items-center p-5" style={{ borderBottom: "1px solid var(--pq-glass-line)" }}>
              <h2 id="complete-consult-title" className="text-lg font-extrabold tracking-tight flex items-center">
                <CheckCircle className="w-5 h-5 mr-2" style={{ color: "var(--pq-live)" }} aria-hidden="true" />
                Complete Consultation
              </h2>
              <button type="button" onClick={() => setIsCompleteModalOpen(false)} className="pq-icon-btn" aria-label="Close">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto">
              <div className="pq-row mb-6">
                <div>
                  <div className="text-xs pq-faint font-extrabold uppercase tracking-wider mb-1">Patient</div>
                  <div className="font-extrabold text-lg tracking-tight">{getReservationChildDisplayName(selectedPatient)}</div>
                  <div className="mt-2"><WalkInChip reservation={selectedPatient} /></div>
                </div>
                <div className="pq-queue-plate">
                  #{selectedPatient.queueNumber || selectedPatient.queuePosition}
                </div>
              </div>

              <div>
                <label className="pq-label" htmlFor="doctor-notes">Doctor's Notes (Optional)</label>
                {selectedPatient.source === "walk_in" ? (
                  <>
                    <p className="pq-note pq-note-wait mb-3">
                      Notes are not available for walk-in reservations.
                    </p>
                    <textarea
                      id="doctor-notes"
                      value=""
                      disabled
                      placeholder="Notes are not available for walk-in reservations"
                      rows={5}
                      className="pq-input resize-none"
                    ></textarea>
                  </>
                ) : (
                  <>
                    <p className="text-xs pq-muted mb-3">Add any medical notes, prescriptions, or follow-up instructions. These will be visible to the parent.</p>
                    <textarea
                      id="doctor-notes"
                      value={doctorNotes}
                      onChange={(e) => setDoctorNotes(e.target.value)}
                      placeholder="Enter consultation notes here..."
                      rows={5}
                      className="pq-input resize-none"
                    ></textarea>
                  </>
                )}
              </div>
            </div>

            <div className="p-5 flex gap-3 justify-end" style={{ borderTop: "1px solid var(--pq-glass-line)" }}>
              <button 
                type="button"
                onClick={() => setIsCompleteModalOpen(false)}
                disabled={isSubmitting}
                className="pq-btn-secondary"
              >
                Cancel
              </button>
              <button 
                type="button"
                onClick={handleComplete}
                disabled={isSubmitting}
                className="pq-btn-live"
              >
                {isSubmitting ? (
                  <>
                    <span className="pq-spinner" style={{ width: 16, height: 16, borderWidth: 2 }} aria-hidden="true" />
                    Completing...
                  </>
                ) : "Complete Session"}
              </button>
            </div>
          </div>
        </div>
      )}

      {isWalkInOpen ? (
        <WalkInPatientModal
          isOpen
          onClose={() => setIsWalkInOpen(false)}
          schedule={activeSchedule}
        />
      ) : null}
    </div>
  );
}
