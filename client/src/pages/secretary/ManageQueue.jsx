import React, { useState, useEffect } from "react";
import { Users, UserCheck, Clock, CheckCircle, Activity, PlayCircle, AlertTriangle, Monitor } from "lucide-react";
import { subscribeToScheduleReservations, startConsultation, sendToDoctor, penalizeReservation, requestCheckInReminder, cancelReservation } from "../../services/reservationService";
import { subscribeToPublishedSchedules } from "../../services/scheduleService";
import { subscribeToQueueConfiguration, resolveLateLimitForSchedule } from "../../services/systemConfigurationService";
import { computeReservationState, QUEUE_STATES, sortActiveQueue } from "../../services/queueEngine";
import { useAuth } from "../../hooks/useAuth";
import { get, ref } from "firebase/database";
import { database } from "../../firebase/database";
import toast from "react-hot-toast";
import { getReservationChildDisplayName } from "../../utils/reservationPatients";
import ReservationPatientNames from "../../components/common/ReservationPatientNames";
import ConfirmationModal from "../../components/common/ConfirmationModal";
import { scheduleMatchesAssignedBranch } from "../../utils/stringUtils";
import { PqSpinner } from "../../components/parent/pqUi";

const isWalkInReservation = (res) => res?.source === "walk_in";

export default function ManageQueue({ hideHeader = false }) {
  const { user } = useAuth();
  const [reservations, setReservations] = useState([]);
  const [schedules, setSchedules] = useState({});
  const [schedulesLoaded, setSchedulesLoaded] = useState(false);
  const [reservationsLoaded, setReservationsLoaded] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const [requestingCheckIn, setRequestingCheckIn] = useState(false);
  const [penaltyMoveBack, setPenaltyMoveBack] = useState(2);
  const [nowTs, setNowTs] = useState(Date.now());
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [parentContactInfo, setParentContactInfo] = useState(null);
  const [loadingContactInfo, setLoadingContactInfo] = useState(false);
  const [contactIsWalkIn, setContactIsWalkIn] = useState(false);
  const [contactReservation, setContactReservation] = useState(null);
  const [isCancelConfirmOpen, setIsCancelConfirmOpen] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  const closeContactModal = () => {
    if (isCancelling) return;
    setIsContactModalOpen(false);
    setContactReservation(null);
    setParentContactInfo(null);
    setContactIsWalkIn(false);
    setIsCancelConfirmOpen(false);
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && isContactModalOpen && !isCancelConfirmOpen && !isCancelling) {
        closeContactModal();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isContactModalOpen, isCancelConfirmOpen, isCancelling]);

  useEffect(() => {
    const timer = setInterval(() => setNowTs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const unsubSchedules = subscribeToPublishedSchedules((data) => {
      const schedulesMap = {};
      data.forEach(s => schedulesMap[s.id] = s);
      setSchedules(schedulesMap);
      setSchedulesLoaded(true);
    });

    const unsubConfig = subscribeToQueueConfiguration(user?.assignedBranchId, (config) => {
      setPenaltyMoveBack(config.penaltyMoveBack);
    });

    return () => {
      unsubSchedules();
      unsubConfig();
    };
  }, [user?.assignedBranchId]);

  // Find active schedule started by the Doctor for the secretary's assigned branch
  const activeStartedSchedule = Object.values(schedules).find(s =>
    s.status === "published" && 
    ["active", "paused", "closed"].includes(s.queueStatus) &&
    scheduleMatchesAssignedBranch(s, user)
  );

  useEffect(() => {
    if (!activeStartedSchedule) {
      setReservations([]);
      return;
    }

    setReservationsLoaded(false);
    const unsubReservations = subscribeToScheduleReservations(activeStartedSchedule.id, (data) => {
      setReservations(data);
      setReservationsLoaded(true);
    });

    return () => unsubReservations();
  }, [activeStartedSchedule?.id]);

  const loading = !schedulesLoaded || (!!activeStartedSchedule && !reservationsLoaded);

  if (loading) {
    return (
      <div className="pq-glass p-10">
        <PqSpinner label="Loading queue" />
      </div>
    );
  }

  if (!activeStartedSchedule) {
    return (
      <div className="space-y-6 pb-8">
        {!hideHeader && (
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <p className="text-sm pq-muted">Control patient flow and consultations for your assigned branch: <span className="font-extrabold" style={{ color: "var(--pq-ink)" }}>{user.assignedBranch}</span>.</p>
            </div>
            <a
              href="/secretary/monitor"
              target="_blank"
              rel="noopener noreferrer"
              className="pq-btn-secondary"
            >
              <Monitor className="w-4 h-4" aria-hidden="true" />
              <span>Live Queue Monitor</span>
            </a>
          </div>
        )}

        <div className="pq-glass p-12 text-center max-w-xl mx-auto">
          <Clock className="w-12 h-12 pq-faint mx-auto mb-4" aria-hidden="true" />
          <h2 className="text-xl font-extrabold tracking-tight mb-2">No Active Queue For {user.assignedBranch}</h2>
          <p className="pq-muted text-sm leading-relaxed max-w-md mx-auto">
            There is currently no active clinic queue running for your assigned branch ({user.assignedBranch}). Wait for the Doctor to start the session for this branch.
          </p>
        </div>
      </div>
    );
  }

  // Active queue for today's started schedule
  const activeReservations = reservations.filter(r => r.scheduleId === activeStartedSchedule.id);
  
  // Region 1 data: Current active consultation(s) / with doctor
  const inConsultationPatients = activeReservations.filter(r => r.status === "in_consultation" || r.status === "with_doctor");

  // Region 2 data: Remaining patients waiting in line sorted by current queue order (turn in line)
  const waitingQueue = sortActiveQueue(
    activeReservations.filter(r => ["checked_in", "reserved", "waiting"].includes(r.status))
  );

  const firstUncheckedIdx = waitingQueue.findIndex(
    (r) => r.status === "reserved" || r.status === "waiting"
  );

  const formatTime = (timestamp) => {
    if (!timestamp) return "N/A";
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const renderStatusBadge = (status) => {
    switch (status) {
      case "with_doctor":
        return (
          <span className="pq-chip pq-chip-live shrink-0">
            <span className="pq-pip" style={{ width: 6, height: 6 }} />
            With Doctor
          </span>
        );
      case "in_consultation":
        return (
          <span className="pq-chip pq-chip-info shrink-0">
            <span className="pq-pip" style={{ width: 6, height: 6 }} />
            In Consultation
          </span>
        );
      case "checked_in":
        return (
          <span className="pq-chip pq-chip-live shrink-0">
            <UserCheck className="w-3.5 h-3.5" aria-hidden="true" />
            Checked In
          </span>
        );
      case "reserved":
      case "waiting":
        return (
          <span className="pq-chip pq-chip-wait shrink-0">
            <Clock className="w-3.5 h-3.5" aria-hidden="true" />
            Not Checked In
          </span>
        );
      default:
        return null;
    }
  };

  const handleSendToDoctor = async (res) => {
    try {
      setActionLoading(res.id);
      await sendToDoctor(res.id);
      toast.success(`Sent ${getReservationChildDisplayName(res, "patient")} to Doctor room`);
    } catch (err) {
      toast.error("Failed to send patient to Doctor");
    } finally {
      setActionLoading(null);
    }
  };

  const handlePenalize = async (res) => {
    try {
      setActionLoading(res.id);
      const schedule = schedules[res.scheduleId] || {};
      await penalizeReservation(res.id, schedule, reservations, penaltyMoveBack);
      const newPenaltyCount = (res.penaltyCount || 0) + 1;
      const lateLimit = await resolveLateLimitForSchedule(schedule);
      if (penaltyMoveBack === 0 || newPenaltyCount >= lateLimit) {
        toast.error(
          penaltyMoveBack === 0
            ? `${getReservationChildDisplayName(res, "Patient")} was forfeited because Penalty Move-Back is 0.`
            : `${getReservationChildDisplayName(res, "Patient")} reached late limit (${lateLimit}) and was removed from the queue.`
        );
      } else {
        toast.success(`Penalty applied to ${getReservationChildDisplayName(res, "Patient")} (${newPenaltyCount}/${lateLimit}). Moved back in queue.`);
      }
    } catch (err) {
      toast.error("Failed to apply penalty");
    } finally {
      setActionLoading(null);
    }
  };

  const getNextEligibleCheckIn = () => {
    const awaitingPatients = activeReservations
      .filter((r) =>
        !["checked_in", "with_doctor", "in_consultation", "completed", "consultation_completed", "cancelled", "forfeited", "penalized", "late_limit_reached"].includes(r.status)
      )
      .sort((a, b) => {
        const timeA = a.sortTimestamp || a.createdAt || 0;
        const timeB = b.sortTimestamp || b.createdAt || 0;
        return timeA - timeB;
      });
    return awaitingPatients[0];
  };

  const nextEligibleRes = getNextEligibleCheckIn();
  const nextEligibleElapsed = nextEligibleRes
    ? nowTs - (nextEligibleRes.checkInRequestedAt || 0)
    : 999999;
  const nextEligibleCooldownSec =
    nextEligibleElapsed < 30000
      ? Math.ceil((30000 - nextEligibleElapsed) / 1000)
      : 0;

  const handleRequestCheckIn = async () => {
    if (!nextEligibleRes) {
      toast.error("All patients in queue are already checked in or processed.");
      return;
    }

    if (nextEligibleCooldownSec > 0) {
      toast.error("Check-in request already sent. Please wait before sending another reminder.");
      return;
    }

    try {
      setRequestingCheckIn(true);
      await requestCheckInReminder(nextEligibleRes.id);
      toast.success(
        `Check-in reminder sent to Queue #${nextEligibleRes.queueNumber || "?"} (${getReservationChildDisplayName(nextEligibleRes, "Patient")})`
      );
    } catch (err) {
      toast.error("Failed to send check-in reminder.");
    } finally {
      setRequestingCheckIn(false);
    }
  };

  const handleCardClick = async (res, e) => {
    // Prevent triggering if clicking a button inside the card
    if (e.target.closest('button')) return;

    setIsContactModalOpen(true);
    setParentContactInfo(null);
    setContactReservation(res);
    setIsCancelConfirmOpen(false);

    const isWalkIn = isWalkInReservation(res) || !res.parentId;
    setContactIsWalkIn(isWalkIn);

    if (isWalkIn) {
      setLoadingContactInfo(false);
      return;
    }

    setLoadingContactInfo(true);

    try {
      const parentRef = ref(database, `users/${res.parentId}`);
      const snapshot = await get(parentRef);
      if (snapshot.exists()) {
        setParentContactInfo(snapshot.val());
      }
    } catch (err) {
      console.error("Failed to fetch parent info", err);
    } finally {
      setLoadingContactInfo(false);
    }
  };

  const handleCancelWalkIn = async () => {
    if (!contactReservation?.id || isCancelling) return;
    if (!isWalkInReservation(contactReservation)) return;

    setIsCancelling(true);
    try {
      await cancelReservation(contactReservation.id);
      toast.success(
        `Walk-in reservation for ${getReservationChildDisplayName(contactReservation, "Patient")} cancelled.`
      );
      setIsCancelConfirmOpen(false);
      setIsContactModalOpen(false);
      setContactReservation(null);
      setParentContactInfo(null);
      setContactIsWalkIn(false);
    } catch (err) {
      console.error(err);
      toast.error("Failed to cancel walk-in reservation.");
    } finally {
      setIsCancelling(false);
    }
  };

  const renderWalkInBadge = () => (
    <span className="pq-chip pq-chip-wait self-start shrink-0">Walk-in</span>
  );


  return (
    <div className="space-y-6 pb-8 max-w-4xl mx-auto">
      {!hideHeader && (
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-2">
          <p className="text-sm pq-muted">Control patient flow and consultations for your assigned branch: <span className="font-extrabold" style={{ color: "var(--pq-ink)" }}>{user.assignedBranch}</span>.</p>
          <a
            href="/secretary/monitor"
            target="_blank"
            rel="noopener noreferrer"
            className="pq-btn-secondary"
          >
            <Monitor className="w-4 h-4" aria-hidden="true" />
            <span>Live Queue Monitor</span>
          </a>
        </div>
      )}

      <div className="flex flex-col sm:flex-row justify-end items-start sm:items-center gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={handleRequestCheckIn}
            disabled={requestingCheckIn || nextEligibleCooldownSec > 0}
            className="pq-btn-primary"
            title={
              nextEligibleCooldownSec > 0
                ? "Check-in request already sent. Please wait before sending another reminder."
                : "Remind the next awaiting patient to proceed to the clinic for QR validation"
            }
          >
            <UserCheck className="w-4 h-4" aria-hidden="true" />
            <span>
              {nextEligibleCooldownSec > 0
                ? `Request Check-In (${nextEligibleCooldownSec}s)`
                : "Request Check-In"}
            </span>
          </button>
          <span className="pq-chip pq-chip-info min-h-11 px-3.5">
            <Users className="w-4 h-4" aria-hidden="true" />
            {inConsultationPatients.length + waitingQueue.length} Total Active
          </span>
        </div>
      </div>

      <section className="pq-glass overflow-hidden">
        <div className="pq-now mx-0 rounded-none" style={{ borderRadius: 0, border: "none", borderBottom: "1px solid color-mix(in srgb, var(--pq-live) 18%, white)" }}>
          <h2 className="font-extrabold flex items-center" style={{ color: "var(--pq-live)" }}>
            {inConsultationPatients.length > 0 ? <span className="pq-pip mr-2" /> : <Activity className="w-4 h-4 mr-2" aria-hidden="true" />}
            Current Consultation
          </h2>
        </div>

        {inConsultationPatients.length > 0 ? (
          inConsultationPatients.map((res) => (
            <div
              key={res.id}
              role="button"
              tabIndex={0}
              onClick={(e) => handleCardClick(res, e)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleCardClick(res, e);
                }
              }}
              className="p-4 sm:p-5 cursor-pointer"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5 min-w-0 flex-1">
                  <div className="pq-queue-plate pq-queue-plate-live flex-col w-12 h-12">
                    <span className="text-[9px] uppercase font-extrabold leading-none opacity-80 mb-0.5">
                      Queue
                    </span>
                    <span>#{res.queueNumber || res.queuePosition}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-col sm:flex-row sm:items-start gap-1.5 sm:gap-2 min-w-0">
                      <h3 className="min-w-0 flex-1">
                        <ReservationPatientNames
                          reservation={res}
                          fallback="Unnamed Patient"
                          nameClassName="font-extrabold tracking-tight text-base"
                        />
                      </h3>
                      {isWalkInReservation(res) && renderWalkInBadge()}
                    </div>
                    <div className="text-xs font-semibold mt-1" style={{ color: "var(--pq-live)" }}>
                      <span>Inside Doctor Room</span>
                      {res.consultationStartedAt && (
                        <span> • Started at {formatTime(res.consultationStartedAt)}</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 shrink-0" style={{ borderTop: "1px solid transparent" }}>
                  {renderStatusBadge(res.status)}
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="p-8 text-center">
            <p className="text-sm font-extrabold">No active consultation</p>
            <p className="text-xs pq-muted mt-0.5">The consultation room is currently empty.</p>
          </div>
        )}
      </section>

      <section className="pq-glass p-5">
        <h2 className="font-extrabold tracking-tight mb-4 flex items-center gap-2">
          <Clock className="w-4 h-4" style={{ color: "var(--pq-wait)" }} aria-hidden="true" />
          Waiting Queue <span className="pq-chip pq-chip-info">{waitingQueue.length}</span>
        </h2>

        {waitingQueue.length > 0 ? (
          <div className="space-y-2">
            {waitingQueue.map((res, idx) => {
              const isFirstWaiting = idx === 0;
              const canSendToDoctor =
                isFirstWaiting &&
                res.status === "checked_in" &&
                inConsultationPatients.length === 0;
              const canPenalize =
                idx === firstUncheckedIdx && firstUncheckedIdx !== -1;
              const hasRowActions = canSendToDoctor || canPenalize;

              return (
                <div
                  key={res.id}
                  onClick={(e) => handleCardClick(res, e)}
                  className={`pq-row cursor-pointer ${isFirstWaiting ? "pq-row-you" : ""}`}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "3rem minmax(0, 1fr) auto",
                    alignItems: "center",
                    columnGap: "0.85rem",
                    rowGap: "0.55rem",
                  }}
                >
                  <div
                    className={`pq-queue-plate ${isFirstWaiting ? "pq-queue-plate-next" : ""}`}
                    style={hasRowActions ? { gridRow: "1 / span 2" } : undefined}
                  >
                    {res.queueNumber || res.queuePosition}
                  </div>

                  <div className="min-w-0 flex items-center gap-2 flex-wrap">
                    <h3 className="min-w-0 truncate">
                      <ReservationPatientNames
                        reservation={res}
                        fallback="Unnamed Patient"
                      />
                    </h3>
                    {isWalkInReservation(res) && renderWalkInBadge()}
                    {res.penaltyCount > 0 && (
                      <span className="pq-chip pq-chip-wait shrink-0">
                        Late ({res.penaltyCount})
                      </span>
                    )}
                  </div>

                  <div className="justify-self-end">
                    {renderStatusBadge(res.status)}
                  </div>

                  {hasRowActions && (
                    <div className="flex items-center gap-2" style={{ gridColumn: "2 / -1" }}>
                      {canSendToDoctor && (
                        <button
                          type="button"
                          onClick={() => handleSendToDoctor(res)}
                          disabled={actionLoading === res.id}
                          className="pq-btn-primary flex-1"
                          title="Send patient to Doctor room"
                        >
                          <PlayCircle className="w-4 h-4" aria-hidden="true" />
                          Send to Doctor
                        </button>
                      )}

                      {canPenalize && (
                        <button
                          type="button"
                          onClick={() => handlePenalize(res)}
                          disabled={actionLoading === res.id}
                          className="pq-btn-warn flex-1"
                          title="Penalize absent patient (#1 waiting patient)"
                        >
                          <AlertTriangle className="w-4 h-4" aria-hidden="true" />
                          Penalize
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-8 text-center">
            <CheckCircle className="w-8 h-8 mx-auto mb-2" style={{ color: "var(--pq-live)" }} aria-hidden="true" />
            <p className="text-sm font-extrabold">No patients waiting in the queue.</p>
          </div>
        )}
      </section>

      {isContactModalOpen && (
        <div
          className="pq-modal-scrim z-[60]"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isCancelling) closeContactModal();
          }}
        >
          <div
            className="pq-modal w-full max-w-sm overflow-hidden flex flex-col"
            role="dialog"
            aria-modal="true"
            aria-labelledby="contact-modal-title"
          >
            <div className="p-6">
              <h2 id="contact-modal-title" className="text-xl font-extrabold tracking-tight mb-1">
                {contactIsWalkIn ? "Walk-in Patient" : "Parent / Guardian"}
              </h2>
              {loadingContactInfo ? (
                <PqSpinner label="Loading contact" />
              ) : contactIsWalkIn ? (
                <div className="py-6 text-center pq-muted space-y-2">
                  <p className="text-base font-extrabold" style={{ color: "var(--pq-ink)" }}>
                    {getReservationChildDisplayName(contactReservation, "Walk-in patient")}
                  </p>
                  <p>Walk-in patient (no parent account).</p>
                </div>
              ) : parentContactInfo ? (
                <div className="mt-4 space-y-4">
                  <div className="pq-row block min-h-0">
                    <p className="pq-stat-label">Name</p>
                    <p className="text-base font-semibold mt-0.5">{parentContactInfo.name || "Not available"}</p>
                  </div>
                  <div className="pq-row block min-h-0">
                    <p className="pq-stat-label">Email</p>
                    {parentContactInfo.email ? (
                      <a href={`mailto:${parentContactInfo.email}`} className="pq-link mt-0.5 block break-all">{parentContactInfo.email}</a>
                    ) : (
                      <p className="mt-0.5">Not available</p>
                    )}
                  </div>
                  <div className="pq-row block min-h-0">
                    <p className="pq-stat-label">Phone</p>
                    {parentContactInfo.phone ? (
                      <a href={`tel:${parentContactInfo.phone}`} className="pq-link mt-0.5 block">{parentContactInfo.phone}</a>
                    ) : (
                      <p className="mt-0.5">Not available</p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="py-6 text-center pq-muted">
                  <p>Could not retrieve contact information.</p>
                </div>
              )}
            </div>
            <div className="p-4 flex flex-col-reverse sm:flex-row justify-end gap-2" style={{ borderTop: "1px solid var(--pq-glass-line)" }}>
              {isWalkInReservation(contactReservation) && (
                <button
                  type="button"
                  onClick={() => setIsCancelConfirmOpen(true)}
                  disabled={isCancelling}
                  className="pq-btn-danger"
                >
                  Cancel Reservation
                </button>
              )}
              <button
                type="button"
                onClick={closeContactModal}
                disabled={isCancelling}
                className="pq-btn-secondary"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmationModal
        isOpen={isCancelConfirmOpen}
        title="Cancel Walk-in Reservation?"
        message={`Are you sure you want to cancel this walk-in reservation for ${getReservationChildDisplayName(contactReservation, "this patient")}? The slot will be released and the queue will update.`}
        confirmText="Cancel Reservation"
        cancelText="Keep Reservation"
        isDestructive
        isLoading={isCancelling}
        onConfirm={handleCancelWalkIn}
        onClose={() => {
          if (!isCancelling) setIsCancelConfirmOpen(false);
        }}
      />
    </div>
  );
}
