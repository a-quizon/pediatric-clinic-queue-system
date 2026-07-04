import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Ticket, Clock, MapPin, CheckCircle2, XCircle, User } from "lucide-react";
import { subscribeToAllSchedules } from "../../services/scheduleService";
import { subscribeToAllReservations, cancelReservation, updatePatientInfo } from "../../services/reservationService";
import { useAuth } from "../../hooks/useAuth";
import ConfirmationModal from "../../components/common/ConfirmationModal";
import toast from "react-hot-toast";

export default function MyReservations() {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [schedules, setSchedules] = useState({});
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [isCancelConfirmOpen, setIsCancelConfirmOpen] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [reservationToCancel, setReservationToCancel] = useState(null);

  // Patient Info Modal
  const [isPatientInfoModalOpen, setIsPatientInfoModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({ childName: "", age: "", sex: "", concern: "" });

  useEffect(() => {
    const unsubSchedules = subscribeToAllSchedules((data) => {
      setSchedules(data || {});
    });

    const unsubReservations = subscribeToAllReservations((data) => {
      if (user) {
        const parentRes = data.filter(r => r.parentId === user.uid);
        setReservations(parentRes);
      }
      setLoading(false);
    });

    return () => {
      unsubSchedules();
      unsubReservations();
    };
  }, [user]);

  const formatTime = (time) => {
    if (!time) return '';
    const [hours, minutes] = time.split(':');
    const h = parseInt(hours, 10);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const formattedH = h % 12 || 12;
    return `${formattedH}:${minutes} ${ampm}`;
  };

  const handleCancelClick = (res) => {
    setReservationToCancel(res);
    setIsCancelConfirmOpen(true);
  };

  const handleCancelReservation = async () => {
    if (!reservationToCancel) return;
    setIsCancelling(true);
    try {
      await cancelReservation(reservationToCancel.id);
      setIsCancelConfirmOpen(false);
      toast.success('Your reservation has been cancelled successfully.');
      setReservationToCancel(null);
    } catch (error) {
      console.error(error);
      setIsCancelConfirmOpen(false);
      toast.error('There was an error cancelling your reservation.');
    } finally {
      setIsCancelling(false);
    }
  };

  const handleOpenPatientInfo = () => {
    const res = reservations.find(r => r.status !== "cancelled" && r.status !== "completed" && r.status !== "consultation_completed");
    if (!res) return;
    setFormData({
      childName: res.childName || "",
      age: res.age || "",
      sex: res.sex || "",
      concern: res.concern || ""
    });
    setIsPatientInfoModalOpen(true);
  };

  const handleSubmitPatientInfo = async () => {
    const currentRes = reservations.find(r => r.status !== "cancelled" && r.status !== "completed" && r.status !== "consultation_completed");
    if (!currentRes) return;
    setIsSubmitting(true);
    try {
      await updatePatientInfo(currentRes.id, {
        childName: formData.childName.trim(),
        age: formData.age.trim(),
        sex: formData.sex,
        concern: formData.concern.trim()
      });
      setIsPatientInfoModalOpen(false);
      toast.success("Patient information updated successfully.");
    } catch (err) {
      toast.error("Failed to update patient information.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentReservation = reservations.find(r => r.status !== "cancelled" && r.status !== "completed" && r.status !== "consultation_completed" && r.status !== "expired" && r.status !== "penalized");

  return (
    <div className="space-y-6 pb-8 relative">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">My Ticket</h1>
        <p className="text-gray-500 mt-1 text-sm">
          View and manage your active clinic reservation and QR Ticket. For past visits and doctor&apos;s notes, check your Profile &rarr; Reservation History.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        currentReservation ? (() => {
          const schedule = schedules[currentReservation.scheduleId];
          if (!schedule) return <div className="p-8 text-center text-gray-500">Loading schedule details...</div>;

          const isIncomplete = !currentReservation.childName || !currentReservation.age || !currentReservation.sex;

          return (
            <div className="bg-white rounded-3xl border border-blue-100 shadow-md p-6 max-w-lg mx-auto animate-in fade-in slide-in-from-bottom-4 relative">
              {isIncomplete && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-amber-100 text-amber-800 text-xs font-bold px-4 py-1.5 rounded-full border border-amber-200/80 shadow-xs whitespace-nowrap z-10 flex items-center">
                  <XCircle className="w-3.5 h-3.5 mr-1.5 text-amber-600" /> Patient Information Required
                </div>
              )}

              <h2 className="text-xs font-black text-blue-600 uppercase tracking-wider mb-5 flex items-center mt-2">
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Active Reservation
              </h2>
              
              <div className="bg-gray-50 rounded-2xl p-5 mb-6 border border-gray-100/80">
                <div className="grid grid-cols-2 gap-y-3.5 text-sm">
                  <div className="text-gray-500 flex items-center text-xs font-semibold"><User className="w-3.5 h-3.5 mr-2 text-blue-500 flex-shrink-0" />Patient</div>
                  <div className="font-bold text-gray-800 text-right">{currentReservation.childName || "N/A"}</div>
                  
                  <div className="text-gray-500 flex items-center text-xs font-semibold"><MapPin className="w-3.5 h-3.5 mr-2 text-red-500 flex-shrink-0" />Branch</div>
                  <div className="font-bold text-gray-800 text-right">{schedule.branch}</div>
                  
                  <div className="text-gray-500 flex items-center text-xs font-semibold"><Clock className="w-3.5 h-3.5 mr-2 text-blue-500 flex-shrink-0" />Date</div>
                  <div className="font-bold text-gray-800 text-right">{new Date(schedule.clinicDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</div>
                  
                  <div className="text-gray-500 pl-5 text-xs font-semibold">Opening Time</div>
                  <div className="font-bold text-gray-800 text-right">{formatTime(schedule.openingTime)}</div>
                  
                  {currentReservation.status === "in_consultation" ? (
                    <>
                      <div className="text-gray-500 pt-3.5 border-t border-gray-200/80 pl-5 text-xs font-semibold">Status</div>
                      <div className="font-extrabold text-blue-600 text-right text-base pt-3.5 border-t border-gray-200/80 uppercase">In Consultation</div>
                    </>
                  ) : schedule.status === 'completed' || schedule.queueStatus === 'completed' ? (
                    <div className="col-span-2 pt-3.5 border-t border-gray-200/80 text-center">
                      <h3 className="font-bold text-gray-800 mb-0.5 text-sm">Clinic Session Completed</h3>
                      <p className="text-xs text-gray-500">
                        Today&apos;s clinic session has ended.
                      </p>
                    </div>
                  ) : schedule.queueStatus === 'not_started' ? (
                    <div className="col-span-2 pt-3.5 border-t border-gray-200/80 text-center">
                      <h3 className="font-bold text-amber-700 mb-0.5 text-sm">Queue Not Started</h3>
                      <p className="text-xs text-amber-600">
                        Please wait for the doctor to start today&apos;s clinic queue.
                      </p>
                    </div>
                  ) : schedule.queueStatus === 'paused' ? (
                    <div className="col-span-2 pt-3.5 border-t border-gray-200/80 text-center">
                      <h3 className="font-bold text-amber-700 mb-0.5 text-sm">Queue Paused</h3>
                      <p className="text-xs text-amber-600">
                        The doctor temporarily paused the queue.
                      </p>
                    </div>
                  ) : schedule.queueStatus === 'closed' ? (
                    <div className="col-span-2 pt-3.5 border-t border-gray-200/80 text-center">
                      <h3 className="font-bold text-red-700 mb-0.5 text-sm">Queue Closed</h3>
                      <p className="text-xs text-red-600">
                        The clinic queue is closed to new reservations.
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="text-gray-500 pt-3.5 border-t border-gray-200/80 pl-5 text-xs font-semibold">Queue Status</div>
                      <div className="font-extrabold text-green-600 text-right pt-3.5 border-t border-gray-200/80 uppercase text-xs">Queue Open</div>
                    </>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                {isIncomplete ? (
                  <button
                    onClick={handleOpenPatientInfo}
                    className="w-full py-3.5 font-bold text-white bg-amber-500 hover:bg-amber-600 rounded-2xl transition-colors flex items-center justify-center shadow-xs text-sm focus:outline-none"
                  >
                    Complete Information
                  </button>
                ) : (
                  <button
                    onClick={() => navigate(`/parent/reservations/${currentReservation.id}/qr`)}
                    className="w-full py-3.5 font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-2xl transition-colors flex items-center justify-center text-sm focus:outline-none"
                  >
                    <Ticket className="w-4 h-4 mr-2" />
                    View QR Code
                  </button>
                )}
                {currentReservation.status !== "checked_in" && currentReservation.status !== "in_consultation" && (
                  <button
                    onClick={() => handleCancelClick(currentReservation)}
                    className="w-full py-3.5 font-bold rounded-2xl transition-colors flex items-center justify-center text-red-600 bg-red-50 hover:bg-red-100 text-sm focus:outline-none"
                  >
                    Cancel Reservation
                  </button>
                )}
              </div>
            </div>
          );
        })() : (
          <div className="bg-white rounded-3xl border border-gray-100 shadow-xs p-12 text-center max-w-lg mx-auto animate-in fade-in">
            <div className="mx-auto w-16 h-16 bg-gray-50 text-gray-400 rounded-full flex items-center justify-center mb-5">
              <Ticket className="w-8 h-8" />
            </div>
            <h2 className="text-lg font-bold text-gray-800 mb-1">No Active Reservation</h2>
            <p className="text-gray-500 text-sm max-w-xs mx-auto">You do not have a current slot reserved. Head over to the Reserve Queue tab to book an appointment.</p>
          </div>
        )
      )}

      {/* Cancel Confirmation Modal */}
      <ConfirmationModal
        isOpen={isCancelConfirmOpen}
        title="Cancel Reservation?"
        message={`Your reserved slot will be released and become available to other parents.\n\nDo you want to continue?`}
        confirmText="Cancel Reservation"
        cancelText="Keep Reservation"
        onConfirm={handleCancelReservation}
        onCancel={() => setIsCancelConfirmOpen(false)}
        loading={isCancelling}
      />

      {/* Complete Patient Info Modal */}
      {isPatientInfoModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-xl overflow-hidden flex flex-col max-h-[90vh] border border-gray-100 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center px-6 py-5 border-b border-gray-100 bg-gray-50/50">
              <div>
                <h2 className="text-lg font-bold text-gray-800">Complete Information</h2>
                <p className="text-xs text-gray-400 mt-0.5">Please provide patient details to proceed</p>
              </div>
              <button onClick={() => setIsPatientInfoModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors p-1.5 rounded-full hover:bg-gray-100 focus:outline-none">
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto">
              <div className="space-y-4 text-left">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">Child Full Name *</label>
                  <input 
                    type="text" 
                    value={formData.childName}
                    onChange={e => setFormData(prev => ({ ...prev, childName: e.target.value }))}
                    placeholder="Enter child's full name"
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200/80 rounded-2xl text-sm font-semibold text-gray-800 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">Age *</label>
                    <input 
                      type="text" 
                      value={formData.age}
                      onChange={e => setFormData(prev => ({ ...prev, age: e.target.value }))}
                      placeholder="e.g. 5 yrs"
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200/80 rounded-2xl text-sm font-semibold text-gray-800 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">Sex *</label>
                    <select
                      value={formData.sex}
                      onChange={e => setFormData(prev => ({ ...prev, sex: e.target.value }))}
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200/80 rounded-2xl text-sm font-semibold text-gray-800 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all cursor-pointer"
                    >
                      <option value="">Select</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">Concern / Reason for Visit</label>
                  <textarea 
                    value={formData.concern}
                    onChange={e => setFormData(prev => ({ ...prev, concern: e.target.value }))}
                    placeholder="Optional: briefly describe the symptoms or reason for visit"
                    rows={3}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200/80 rounded-2xl text-sm font-semibold text-gray-800 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all resize-none"
                  ></textarea>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/80 flex gap-3 justify-end">
              <button 
                onClick={() => setIsPatientInfoModalOpen(false)}
                disabled={isSubmitting}
                className="w-full sm:w-auto px-5 py-2.5 text-gray-600 font-bold bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50 text-sm focus:outline-none"
              >
                Cancel
              </button>
              <button 
                onClick={handleSubmitPatientInfo}
                disabled={isSubmitting || !formData.childName.trim() || !formData.age.trim() || !formData.sex}
                className="w-full sm:w-auto px-6 py-2.5 text-white font-bold bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors flex items-center justify-center disabled:opacity-70 disabled:cursor-not-allowed text-sm shadow-2xs focus:outline-none"
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
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
