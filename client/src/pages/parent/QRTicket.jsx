import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Ticket as TicketIcon, Clock, MapPin, CheckCircle2, XCircle, User, Maximize2, Download, Activity, AlertCircle, X } from "lucide-react";
import QRCode from "qrcode";
import { subscribeToAllSchedules } from "../../services/scheduleService";
import { subscribeToParentReservations, cancelReservation, updatePatientInfo, expireReservation } from "../../services/reservationService";
import { formatName } from "../../utils/stringUtils";
import { buildPatientInfoPayload, getReservationChildDisplayName, getReservationChildren } from "../../utils/reservationPatients";
import { getBranchConfigurations } from "../../services/branchConfigurationService";
import { isReservationExpired } from "../../services/timeService";
import { useAuth } from "../../hooks/useAuth";
import ConfirmationModal from "../../components/common/ConfirmationModal";
import ReservationStatusBadge from "../../components/common/ReservationStatusBadge";
import ChildProfileForm, { isChildProfileValid } from "../../components/parent/ChildProfileForm";
import toast from "react-hot-toast";

export default function QRTicket() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [schedules, setSchedules] = useState({});
  const [allReservations, setAllReservations] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [qrImageUrl, setQrImageUrl] = useState("");

  // Modals
  const [isCancelConfirmOpen, setIsCancelConfirmOpen] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);

  // Patient Info Modal
  const [isPatientInfoModalOpen, setIsPatientInfoModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({ childName: "", age: "", sex: "", concern: "" });

  useEffect(() => {
    const unsubSchedules = subscribeToAllSchedules((data) => {
      setSchedules(data || {});
    });

    let unsubReservations = () => {};
    if (user) {
      unsubReservations = subscribeToParentReservations(user.uid, (data) => {
        setAllReservations(data || []);
        setLoading(false);
      });
    }

    getBranchConfigurations().then(setBranches);

    return () => {
      unsubSchedules();
      unsubReservations();
    };
  }, [user]);

  const activeReservation = useMemo(() => {
    return allReservations.find(r => r.id === id) || null;
  }, [allReservations, id]);

  const schedule = activeReservation ? schedules[activeReservation.scheduleId] : null;

  const [tick, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const isExpired = useMemo(() => {
    return activeReservation && isReservationExpired(activeReservation, schedule);
  }, [activeReservation, schedule, tick]);

  useEffect(() => {
    if (activeReservation && isExpired && (activeReservation.status === "reserved" || activeReservation.status === "waiting" || activeReservation.status === "validation_open")) {
      expireReservation(activeReservation.id);
    }
  }, [activeReservation, isExpired]);

  const permanentQueueNumber = useMemo(() => {
    if (!activeReservation) return null;
    return activeReservation.queueNumber || activeReservation.originalQueueNumber || activeReservation.queuePosition || null;
  }, [activeReservation]);

  const isValidated = activeReservation && (activeReservation.checkedIn || ["checked_in", "in_consultation", "with_doctor", "consultation_completed", "completed"].includes(activeReservation.status));

  useEffect(() => {
    if (activeReservation && activeReservation.reservationCode && !isValidated && activeReservation.status !== 'waiting_for_window') {
      const payload = {
        reservationId: activeReservation.id,
        reservationCode: activeReservation.reservationCode,
      };

      QRCode.toDataURL(JSON.stringify(payload), {
        width: 340,
        margin: 2,
        color: {
          dark: '#16344A',
          light: '#ffffff'
        }
      })
      .then(url => {
        setQrImageUrl(url);
      })
      .catch(err => {
        console.error("Failed to generate QR:", err);
      });
    } else {
      setQrImageUrl("");
      setIsQrModalOpen(false);
    }
  }, [activeReservation, isValidated]);

  const formatTime = (time) => {
    if (!time) return '';
    const [hours, minutes] = time.split(':');
    const h = parseInt(hours, 10);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const formattedH = h % 12 || 12;
    return `${formattedH}:${minutes} ${ampm}`;
  };

  const handleCancelReservation = async () => {
    if (!activeReservation) return;
    setIsCancelling(true);
    try {
      await cancelReservation(activeReservation.id);
      setIsCancelConfirmOpen(false);
      toast.success('Your reservation has been cancelled successfully.');
      navigate("/parent/reservations");
    } catch (error) {
      console.error(error);
      setIsCancelConfirmOpen(false);
      toast.error('There was an error cancelling your reservation.');
    } finally {
      setIsCancelling(false);
    }
  };

  const handleOpenPatientInfo = () => {
    if (!activeReservation) return;
    const existing = getReservationChildren(activeReservation)[0] || {};
    setFormData({
      childName: existing.childName || activeReservation.childName || "",
      age: existing.age || activeReservation.age || "",
      sex: existing.sex || activeReservation.sex || "",
      concern: activeReservation.concern || ""
    });
    setIsPatientInfoModalOpen(true);
  };

  const handleSubmitPatientInfo = async () => {
    if (!activeReservation) return;
    setIsSubmitting(true);
    try {
      await updatePatientInfo(activeReservation.id, buildPatientInfoPayload(
        [{
          childName: formatName(formData.childName),
          age: formData.age.trim(),
          sex: formData.sex
        }],
        formData.concern
      ));
      setIsPatientInfoModalOpen(false);
      toast.success("Patient information updated successfully.");
    } catch (err) {
      toast.error("Failed to update patient information.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'validation_open':
        return { text: 'Validation Open', color: 'bg-green-100 text-green-800 border-green-200' };
      case 'waiting_for_window':
        return { text: 'Waiting for Window', color: 'bg-amber-100 text-amber-800 border-amber-200' };
      case 'reserved': 
      case 'waiting': 
        return { text: 'Awaiting Arrival', color: 'bg-blue-50 text-blue-700 border-blue-200' };
      case 'checked_in': 
        return { text: 'Checked In', color: 'bg-indigo-100 text-indigo-800 border-indigo-200' };
      case 'with_doctor': 
        return { text: 'With Doctor', color: 'bg-purple-100 text-purple-800 border-purple-200' };
      case 'in_consultation': 
        return { text: 'In Consultation', color: 'bg-purple-100 text-purple-800 border-purple-200' };
      case 'consultation_completed': 
      case 'completed':
        return { text: 'Completed', color: 'bg-green-100 text-green-800 border-green-200' };
      case 'cancelled': 
        return { text: 'Cancelled', color: 'bg-red-100 text-red-800 border-red-200' };
      case 'expired': 
      case 'validation_expired': 
        return { text: 'Validation Expired', color: 'bg-red-100 text-red-800 border-red-200' };
      case 'penalized': 
        return { text: 'Penalized', color: 'bg-amber-100 text-amber-800 border-amber-200' };
      default: 
        return { text: status ? status.replace('_', ' ') : 'Unknown', color: 'bg-gray-100 text-gray-800 border-gray-200' };
    }
  };

  const isIncomplete = activeReservation && getReservationChildren(activeReservation).length === 0;

  return (
    <div className="space-y-6 pb-8 relative">
      {loading ? (
        <div className="flex justify-center items-center py-20">
          <span className="pq-spinner" />
        </div>
      ) : activeReservation && schedule ? (
        <div className="max-w-md mx-auto animate-in fade-in slide-in-from-bottom-4">
          
          {/* THE DIGITAL RESERVATION CARD */}
          <div className="pq-glass overflow-hidden relative">
            
            {/* Warning Strip if Patient Info Required */}
            {isIncomplete && (
              <div className="pq-note pq-note-wait px-5 py-3 flex items-center justify-between rounded-none">
                <div className="flex items-center text-xs font-bold">
                  <AlertCircle className="w-4 h-4 mr-2 shrink-0" /> Patient Information Required
                </div>
                <button 
                  onClick={handleOpenPatientInfo}
                  className="text-xs font-extrabold px-3 py-1 rounded-lg min-h-[32px]"
                  style={{ background: "color-mix(in srgb, var(--pq-wait) 18%, white)", color: "var(--pq-wait)" }}
                >
                  Complete Now
                </button>
              </div>
            )}

            {/* Section 1: Reservation Header Banner */}
            <div className="p-6 sm:p-7 relative" style={{ background: "color-mix(in srgb, var(--pq-mark-blue) 16%, transparent)" }}>
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
                    Queue #{permanentQueueNumber || "-"}
                  </h2>
                  <p className="text-[11px] font-bold pq-muted mt-1">My Reservation</p>
                </div>
                <ReservationStatusBadge status={activeReservation.status} className="shadow-2xs" />
              </div>

              <div className="mt-5 pt-5 grid grid-cols-2 gap-3 text-xs" style={{ borderTop: "1px solid var(--pq-glass-line)" }}>
                <div>
                  <div className="pq-muted font-semibold mb-0.5">Clinic Branch</div>
                  <div className="flex flex-col">
                    <div className="font-bold text-sm flex items-center truncate">
                      <MapPin className="w-3.5 h-3.5 mr-1.5 shrink-0" style={{ color: "var(--pq-mark-blue)" }} /> {schedule.branch}
                    </div>
                    <div className="text-[10px] pq-muted mt-1 whitespace-pre-line leading-snug max-w-[150px]">
                      {branches.find(b => b.name === schedule.branch)?.clinicAddress || "No clinic address provided."}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="pq-muted font-semibold mb-0.5">Date & Time</div>
                  <div className="font-bold text-sm">
                    {new Date(schedule.clinicDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} • {formatTime(schedule.openingTime)}
                  </div>
                </div>
              </div>
            </div>

            {/* Section 2: Boarding Pass Cutout Divider */}
            <div className="relative flex items-center justify-between px-2 py-3">
              <div className="w-6 h-6 rounded-full -ml-5" style={{ background: "var(--pq-paper)" }}></div>
              <div className="flex-1 border-t border-dashed mx-2" style={{ borderColor: "var(--pq-glass-line)" }}></div>
              <div className="w-6 h-6 rounded-full -mr-5" style={{ background: "var(--pq-paper)" }}></div>
            </div>

            {/* Section 3: Arrival Pass (Before Check-in) vs Arrival Confirmation (After Check-in) */}
            {!isValidated ? (
              isExpired ? (
                <div className="px-6 sm:px-8 py-8 text-center flex flex-col items-center">
                  <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4" style={{ background: "var(--pq-alert-wash)", color: "var(--pq-alert)" }}>
                    <AlertCircle className="w-8 h-8" />
                  </div>
                  <h3 className="text-lg font-extrabold mb-1.5">Validation Window Expired</h3>
                  <p className="text-xs sm:text-sm font-medium pq-muted max-w-xs leading-relaxed mb-6">
                    You were unable to validate within the allowed time. Your queue reservation has expired.
                  </p>
                  <button
                    onClick={() => navigate("/parent/reserve")}
                    className="pq-btn-primary"
                  >
                    Reserve Another Slot
                  </button>
                </div>
              ) : (
                <div className="px-6 sm:px-8 py-4 text-center flex flex-col items-center">
                  <div className="pq-note pq-note-info mb-4 w-full text-center">
                    <div className="text-xs font-bold mb-0.5">Clinic Check-In QR Pass</div>
                    <div className="text-[11px] font-medium">
                      Present this QR Code to the Secretary when you arrive at the clinic.
                    </div>
                  </div>

                  <div className="pq-row mb-4 w-52 h-52 sm:w-56 sm:h-56 flex items-center justify-center">
                    {qrImageUrl ? (
                      <img src={qrImageUrl} alt="QR Arrival Pass" className="w-full h-full object-contain" />
                    ) : (
                      <div className="flex flex-col items-center justify-center pq-muted text-xs">
                        <span className="pq-spinner mb-2" />
                        Generating QR...
                      </div>
                    )}
                  </div>

                  <span className="text-[11px] font-bold pq-muted">Reservation Code</span>
                  <div className="text-3xl font-extrabold tracking-wider mt-0.5 font-mono">
                    {activeReservation.reservationCode || "------"}
                  </div>

                  <div className="flex flex-col items-center justify-center gap-2.5 mt-4 w-full">
                    <button 
                      onClick={() => setIsQrModalOpen(true)}
                      className="pq-btn-secondary w-full text-xs sm:text-sm"
                    >
                      <Maximize2 className="w-4 h-4 mr-2" /> Expand QR Code
                    </button>
                    {activeReservation.status !== "checked_in" && activeReservation.status !== "in_consultation" && activeReservation.status !== "with_doctor" && (
                      <button
                        onClick={() => setIsCancelConfirmOpen(true)}
                        className="pq-btn-danger w-full text-xs sm:text-sm"
                      >
                        <XCircle className="w-4 h-4 mr-1.5" /> Cancel Reservation
                      </button>
                    )}
                  </div>
                </div>
              )
            ) : (
              <div className="px-6 sm:px-8 py-5 text-center">
                <div className="pq-note pq-note-ok rounded-2xl p-6 text-center flex flex-col items-center justify-center my-1">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center mb-3" style={{ background: "color-mix(in srgb, var(--pq-live) 16%, white)", color: "var(--pq-live)" }}>
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <h3 className="text-base sm:text-lg font-extrabold mb-1">Arrival Confirmed</h3>
                  <p className="text-xs sm:text-sm font-semibold max-w-xs leading-relaxed">
                    Your arrival has been successfully verified. Please wait for your queue number to be called.
                  </p>
                </div>
              </div>
            )}

            {/* Section 4: Boarding Pass Cutout Divider */}
            <div className="relative flex items-center justify-between px-2 py-3">
              <div className="w-6 h-6 rounded-full -ml-5" style={{ background: "var(--pq-paper)" }}></div>
              <div className="flex-1 border-t border-dashed mx-2" style={{ borderColor: "var(--pq-glass-line)" }}></div>
              <div className="w-6 h-6 rounded-full -mr-5" style={{ background: "var(--pq-paper)" }}></div>
            </div>

            {/* Section 7: Patient Information */}
            <div className="px-6 sm:px-8 pb-7 pt-3 text-left">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-xs font-bold pq-muted flex items-center">
                  <User className="w-3.5 h-3.5 mr-1.5" style={{ color: "var(--pq-mark-blue)" }} /> Patient Information
                </h3>
                {isIncomplete && (
                  <button onClick={handleOpenPatientInfo} className="pq-link text-[11px]">
                    Edit Info
                  </button>
                )}
              </div>
              <div className="pq-row flex-col items-stretch p-4 space-y-3 text-xs sm:text-sm">
                {getReservationChildren(activeReservation).length > 0 ? (
                  getReservationChildren(activeReservation).map((child, index) => (
                    <div key={child.childId || index} className="grid grid-cols-2 gap-y-1 gap-x-4">
                      <div>
                        <span className="pq-muted font-semibold block text-[11px]">Child Name</span>
                        <span className="font-bold truncate block mt-0.5">{child.childName || "N/A"}</span>
                      </div>
                      <div>
                        <span className="pq-muted font-semibold block text-[11px]">Age & Sex</span>
                        <span className="font-bold block mt-0.5">
                          {child.age ? `${child.age} • ${child.sex || "N/A"}` : "N/A"}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="grid grid-cols-2 gap-y-1 gap-x-4">
                    <div>
                      <span className="pq-muted font-semibold block text-[11px]">Child Name</span>
                      <span className="font-bold truncate block mt-0.5">N/A</span>
                    </div>
                    <div>
                      <span className="pq-muted font-semibold block text-[11px]">Age & Sex</span>
                      <span className="font-bold block mt-0.5">N/A</span>
                    </div>
                  </div>
                )}
                <div className="pt-2" style={{ borderTop: "1px solid var(--pq-glass-line)" }}>
                  <span className="pq-muted font-semibold block text-[11px] mb-1">Reason for Visit</span>
                  <span className="font-semibold block p-2.5 rounded-xl text-xs" style={{ background: "color-mix(in srgb, #ffffff 55%, transparent)", border: "1px solid var(--pq-glass-line)" }}>
                    {activeReservation.concern || "Regular checkup / consultation"}
                  </span>
                </div>
              </div>
            </div>

          </div>

        </div>
      ) : (
        /* Empty State */
        <div className="flex flex-col items-center justify-center min-h-[60vh] w-full">
          <div className="pq-glass p-10 sm:p-14 text-center max-w-md mx-auto w-full">
            <div className="mx-auto w-20 h-20 rounded-full flex items-center justify-center mb-6" style={{ background: "color-mix(in srgb, var(--pq-mark-blue) 12%, white)", color: "var(--pq-mark-blue-deep)" }}>
              <TicketIcon className="w-10 h-10" />
            </div>
            <h2 className="text-xl sm:text-2xl font-extrabold mb-2">Reservation Not Found</h2>
            <p className="pq-muted text-sm max-w-xs mx-auto mb-8 leading-relaxed">
              This reservation was not found or has been removed.
            </p>
            <button
              onClick={() => navigate("/parent/reservations")}
              className="pq-btn-primary w-full"
            >
              Back to My Reservations
            </button>
          </div>
        </div>
      )}

      {/* FULLSCREEN QR MODAL (Only when NOT validated) */}
      {isQrModalOpen && activeReservation && !isValidated && (
        <div className="pq-modal-scrim flex-col">
          <button 
            onClick={() => setIsQrModalOpen(false)}
            className="pq-icon-btn absolute top-6 right-6 sm:top-8 sm:right-8 z-50"
            title="Close"
            aria-label="Close"
          >
            <X className="w-6 h-6" />
          </button>

          <div className="pq-glass-modal w-full max-w-sm p-6 sm:p-8 text-center flex flex-col items-center justify-center">
            <div className="w-full pb-4 mb-5" style={{ borderBottom: "1px solid var(--pq-glass-line)" }}>
              <h2 className="text-3xl font-extrabold" style={{ color: "var(--pq-mark-blue-deep)" }}>
                Queue #{permanentQueueNumber || "-"}
              </h2>
              <p className="text-[11px] font-bold pq-muted mt-1">Arrival Check-in Pass</p>
              <p className="text-sm font-bold mt-1 truncate">
                {getReservationChildDisplayName(activeReservation, "Patient")}
              </p>
            </div>

            {/* Large QR Code */}
            <div className="pq-row mb-6 w-64 h-64 sm:w-72 sm:h-72 flex items-center justify-center">
              {qrImageUrl ? (
                <img src={qrImageUrl} alt="Full Screen QR" className="w-full h-full object-contain" />
              ) : (
                <div className="pq-spinner" />
              )}
            </div>

            <span className="text-xs font-bold pq-muted block">Reservation Code</span>
            <div className="text-3xl font-extrabold tracking-wider mt-0.5 mb-6 font-mono">
              {activeReservation.reservationCode || "------"}
            </div>

            <a
              href={qrImageUrl}
              download={`reservation-${activeReservation.reservationCode || 'pass'}.png`}
              className="pq-btn-primary w-full"
            >
              <Download className="w-5 h-5" /> Download QR
            </a>
          </div>
        </div>
      )}

      {/* Cancel Confirmation Modal */}
      <ConfirmationModal
        isOpen={isCancelConfirmOpen}
        title="Cancel Reservation?"
        message={`Your reserved slot will be released and become available to other parents.\n\nDo you want to continue?`}
        confirmText="Cancel Reservation"
        cancelText="Keep Reservation"
        onConfirm={handleCancelReservation}
        onClose={() => setIsCancelConfirmOpen(false)}
        loading={isCancelling}
      />

      {/* Complete Patient Info Modal */}
      {isPatientInfoModalOpen && (
        <div className="pq-modal-scrim">
          <div className="pq-glass-modal w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center px-6 py-5" style={{ borderBottom: "1px solid var(--pq-glass-line)" }}>
              <div>
                <h2 className="text-lg font-bold">Complete Information</h2>
                <p className="text-xs pq-muted mt-0.5">Please provide patient details to proceed</p>
              </div>
              <button onClick={() => setIsPatientInfoModalOpen(false)} className="pq-icon-btn" aria-label="Close">
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto">
              <div className="space-y-4 text-left">
                <ChildProfileForm
                  value={formData}
                  onChange={(next) => setFormData((prev) => ({ ...prev, ...next }))}
                  idPrefix="ticket-child"
                />

                <div>
                  <label className="pq-label">Concern / Reason for Visit</label>
                  <textarea 
                    value={formData.concern}
                    onChange={e => setFormData(prev => ({ ...prev, concern: e.target.value }))}
                    placeholder="Optional: briefly describe the symptoms or reason for visit"
                    rows={3}
                    className="pq-input resize-none"
                  ></textarea>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 flex gap-3 justify-end" style={{ borderTop: "1px solid var(--pq-glass-line)" }}>
              <button 
                onClick={() => setIsPatientInfoModalOpen(false)}
                disabled={isSubmitting}
                className="pq-btn-secondary w-full sm:w-auto text-sm"
              >
                Cancel
              </button>
              <button 
                onClick={handleSubmitPatientInfo}
                disabled={isSubmitting || !isChildProfileValid(formData)}
                className="pq-btn-primary w-full sm:w-auto text-sm"
              >
                {isSubmitting ? (
                  <>
                    <span className="pq-spinner" />
                    Saving...
                  </>
                ) : "Save Information"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
