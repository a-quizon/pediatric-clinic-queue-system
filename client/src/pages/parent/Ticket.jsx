import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Ticket as TicketIcon, Clock, MapPin, CheckCircle2, XCircle, User, Maximize2, Download, Activity, AlertCircle, X, QrCode } from "lucide-react";
import QRCode from "qrcode";
import { subscribeToAllSchedules } from "../../services/scheduleService";
import { subscribeToAllReservations, cancelReservation, updatePatientInfo } from "../../services/reservationService";
import { useAuth } from "../../hooks/useAuth";
import ConfirmationModal from "../../components/common/ConfirmationModal";
import toast from "react-hot-toast";

export default function Ticket() {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [schedules, setSchedules] = useState({});
  const [allReservations, setAllReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [qrImageUrl, setQrImageUrl] = useState("");

  // Modals
  const [isCancelConfirmOpen, setIsCancelConfirmOpen] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [reservationToCancel, setReservationToCancel] = useState(null);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);

  // Patient Info Modal
  const [isPatientInfoModalOpen, setIsPatientInfoModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({ childName: "", age: "", sex: "", concern: "" });

  useEffect(() => {
    const unsubSchedules = subscribeToAllSchedules((data) => {
      setSchedules(data || {});
    });

    const unsubReservations = subscribeToAllReservations((data) => {
      setAllReservations(data || []);
      setLoading(false);
    });

    return () => {
      unsubSchedules();
      unsubReservations();
    };
  }, []);

  const activeReservation = useMemo(() => {
    if (!user) return null;
    return allReservations.find(r => r.parentId === user.uid && ["reserved", "waiting", "checked_in", "in_consultation", "consultation_completed"].includes(r.status));
  }, [allReservations, user]);

  const schedule = activeReservation ? schedules[activeReservation.scheduleId] : null;

  const permanentQueueNumber = useMemo(() => {
    if (!activeReservation || !allReservations) return null;
    const scheduleRes = allReservations
      .filter(r => r.scheduleId === activeReservation.scheduleId)
      .sort((a, b) => a.createdAt - b.createdAt);
    const index = scheduleRes.findIndex(r => r.id === activeReservation.id);
    return index >= 0 ? index + 1 : null;
  }, [allReservations, activeReservation]);

  const { nowServingText, patientsAhead } = useMemo(() => {
    if (!activeReservation || !schedule) return { nowServingText: "—", patientsAhead: 0 };
    
    const scheduleRes = allReservations
      .filter(r => r.scheduleId === activeReservation.scheduleId)
      .sort((a, b) => a.createdAt - b.createdAt);
    
    // Assign permanent queue numbers
    const resWithPNum = scheduleRes.map((r, idx) => ({ ...r, pNum: idx + 1 }));
    
    const inConsultation = resWithPNum.find(r => r.status === "in_consultation");
    const completedList = resWithPNum.filter(r => r.status === "consultation_completed");
    const compCount = completedList.length;
    
    const activeLine = resWithPNum
      .filter(r => ["reserved", "waiting", "checked_in", "in_consultation"].includes(r.status))
      .sort((a, b) => (a.queuePosition || 999) - (b.queuePosition || 999));
    
    let servingText = "—";
    if (schedule.queueStatus === 'not_started') {
      servingText = "—";
    } else if (schedule.status === 'completed' || schedule.queueStatus === 'completed' || schedule.queueStatus === 'ended') {
      servingText = "Completed";
    } else if (inConsultation) {
      servingText = `Queue #${inConsultation.pNum}`;
    } else if (compCount > 0) {
      servingText = `Queue #${compCount}`;
    } else {
      servingText = "Starting soon";
    }

    let ahead = 0;
    if (activeReservation.status === "in_consultation" || activeReservation.status === "consultation_completed") {
      ahead = 0;
    } else {
      const myIndex = activeLine.findIndex(r => r.id === activeReservation.id);
      ahead = myIndex >= 0 ? myIndex : 0;
    }

    return { 
      nowServingText: servingText,
      patientsAhead: ahead
    };
  }, [allReservations, activeReservation, schedule]);

  useEffect(() => {
    if (activeReservation && activeReservation.reservationCode) {
      const payload = {
        reservationId: activeReservation.id,
        reservationCode: activeReservation.reservationCode,
      };

      QRCode.toDataURL(JSON.stringify(payload), {
        width: 340,
        margin: 2,
        color: {
          dark: '#1e3a8a', // blue-900
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
    }
  }, [activeReservation]);

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
    if (!activeReservation) return;
    setFormData({
      childName: activeReservation.childName || "",
      age: activeReservation.age || "",
      sex: activeReservation.sex || "",
      concern: activeReservation.concern || ""
    });
    setIsPatientInfoModalOpen(true);
  };

  const handleSubmitPatientInfo = async () => {
    if (!activeReservation) return;
    setIsSubmitting(true);
    try {
      await updatePatientInfo(activeReservation.id, {
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


  const getStatusBadge = (status) => {
    switch (status) {
      case 'reserved': 
      case 'waiting': 
        return { text: 'Awaiting Arrival', color: 'bg-blue-50 text-blue-700 border-blue-200' };
      case 'checked_in': 
        return { text: 'Checked In', color: 'bg-indigo-100 text-indigo-800 border-indigo-200' };
      case 'in_consultation': 
        return { text: 'In Consultation', color: 'bg-purple-100 text-purple-800 border-purple-200' };
      case 'consultation_completed': 
      case 'completed':
        return { text: 'Completed', color: 'bg-green-100 text-green-800 border-green-200' };
      case 'cancelled': 
        return { text: 'Cancelled', color: 'bg-red-100 text-red-800 border-red-200' };
      case 'expired': 
        return { text: 'Expired', color: 'bg-slate-100 text-slate-800 border-slate-200' };
      case 'penalized': 
        return { text: 'Penalized', color: 'bg-amber-100 text-amber-800 border-amber-200' };
      default: 
        return { text: status ? status.replace('_', ' ') : 'Unknown', color: 'bg-gray-100 text-gray-800 border-gray-200' };
    }
  };

  const isIncomplete = activeReservation && (!activeReservation.childName || !activeReservation.age || !activeReservation.sex);
  const statusDisplay = activeReservation ? getStatusBadge(activeReservation.status) : null;

  return (
    <div className="space-y-6 pb-8 relative">
      <div>
        <p className="text-gray-500 mt-1 text-sm">
          Your digital clinic ticket and real-time queue status. Present this QR code at the reception upon arrival.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : activeReservation && schedule ? (
        <div className="max-w-md mx-auto animate-in fade-in slide-in-from-bottom-4">
          
          {/* THE DIGITAL TICKET CARD / BOARDING PASS */}
          <div className="bg-white rounded-3xl border border-gray-200/80 shadow-xl overflow-hidden relative">
            
            {/* Warning Strip if Patient Info Required */}
            {isIncomplete && (
              <div className="bg-amber-50 border-b border-amber-200 px-5 py-3 flex items-center justify-between">
                <div className="flex items-center text-amber-800 text-xs font-bold">
                  <AlertCircle className="w-4 h-4 mr-2 text-amber-600 shrink-0" /> Patient Information Required
                </div>
                <button 
                  onClick={handleOpenPatientInfo}
                  className="text-xs font-extrabold text-amber-900 bg-amber-200/70 hover:bg-amber-200 px-3 py-1 rounded-lg transition-colors focus:outline-none"
                >
                  Complete Now
                </button>
              </div>
            )}

            {/* Section 1: Ticket Header Banner */}
            <div className="p-6 sm:p-7 bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 text-white relative">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-[11px] font-black uppercase tracking-widest text-blue-200 block mb-0.5">Your Queue</span>
                  <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-white">
                    Queue #{permanentQueueNumber || "-"}
                  </h2>
                </div>
                {statusDisplay && (
                  <span className={`px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-extrabold uppercase tracking-wide border shadow-2xs bg-white text-blue-950 border-white/20`}>
                    {statusDisplay.text}
                  </span>
                )}
              </div>

              <div className="mt-5 pt-5 border-t border-white/15 grid grid-cols-2 gap-3 text-xs">
                <div>
                  <div className="text-blue-200 font-semibold mb-0.5">Clinic Branch</div>
                  <div className="font-bold text-white text-sm flex items-center truncate">
                    <MapPin className="w-3.5 h-3.5 mr-1.5 text-blue-300 shrink-0" /> {schedule.branch}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-blue-200 font-semibold mb-0.5">Date & Time</div>
                  <div className="font-bold text-white text-sm">
                    {new Date(schedule.clinicDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} • {formatTime(schedule.openingTime)}
                  </div>
                </div>
              </div>
            </div>

            {/* Section 2: Boarding Pass Cutout Divider */}
            <div className="relative bg-white flex items-center justify-between px-2 py-3">
              <div className="w-6 h-6 bg-gray-50 rounded-full -ml-5 border-r border-gray-200/80 shadow-inner"></div>
              <div className="flex-1 border-t-2 border-dashed border-gray-200 mx-2"></div>
              <div className="w-6 h-6 bg-gray-50 rounded-full -mr-5 border-l border-gray-200/80 shadow-inner"></div>
            </div>

            {/* Section 3: Immediate QR Code & Reservation Code */}
            <div className="px-6 sm:px-8 py-4 text-center flex flex-col items-center bg-white">
              <div className="bg-white p-3 rounded-3xl border border-gray-100 shadow-sm mb-4 w-52 h-52 sm:w-56 sm:h-56 flex items-center justify-center relative group">
                {qrImageUrl ? (
                  <img src={qrImageUrl} alt="QR Ticket" className="w-full h-full object-contain" />
                ) : (
                  <div className="flex flex-col items-center justify-center text-gray-400 text-xs">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mb-2"></div>
                    Generating QR...
                  </div>
                )}
                {activeReservation.status === "checked_in" && (
                  <div className="absolute inset-0 bg-white/80 backdrop-blur-[2px] rounded-3xl flex items-center justify-center p-4">
                    <div className="bg-green-100 text-green-800 px-3.5 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider border border-green-300 shadow-2xs">
                      Validated
                    </div>
                  </div>
                )}
              </div>

              <span className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Reservation Code</span>
              <div className="text-3xl font-black text-gray-800 tracking-wider mt-0.5 font-mono">
                {activeReservation.reservationCode || "------"}
              </div>

              <div className="flex flex-col items-center justify-center gap-2.5 mt-4 w-full">
                <button 
                  onClick={() => setIsQrModalOpen(true)}
                  className="w-full py-2.5 px-4 bg-blue-50 hover:bg-blue-100 text-blue-600 font-bold rounded-xl text-xs sm:text-sm transition-all shadow-2xs flex items-center justify-center focus:outline-none"
                >
                  <Maximize2 className="w-4 h-4 mr-2" /> Expand QR Code
                </button>
                {activeReservation.status !== "checked_in" && activeReservation.status !== "in_consultation" && activeReservation.status !== "consultation_completed" && (
                  <button
                    onClick={() => handleCancelClick(activeReservation)}
                    className="w-full py-2.5 px-4 bg-red-50 hover:bg-red-100 text-red-600 font-bold rounded-xl text-xs sm:text-sm transition-all flex items-center justify-center focus:outline-none"
                  >
                    <XCircle className="w-4 h-4 mr-1.5" /> Cancel Reservation
                  </button>
                )}
              </div>
            </div>

            {/* Section 4: Boarding Pass Cutout Divider */}
            <div className="relative bg-white flex items-center justify-between px-2 py-3">
              <div className="w-6 h-6 bg-gray-50 rounded-full -ml-5 border-r border-gray-200/80 shadow-inner"></div>
              <div className="flex-1 border-t-2 border-dashed border-gray-200 mx-2"></div>
              <div className="w-6 h-6 bg-gray-50 rounded-full -mr-5 border-l border-gray-200/80 shadow-inner"></div>
            </div>

            {/* Section 5: Real-Time Queue Information */}
            <div className="px-6 sm:px-8 py-3 bg-white">
              <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3 flex items-center text-left">
                <Activity className="w-3.5 h-3.5 mr-1.5 text-green-500" /> Queue Information
              </h3>
              <div className="bg-gradient-to-r from-blue-50/70 to-indigo-50/70 rounded-2xl p-4 border border-blue-100/80 grid grid-cols-2 gap-4 text-center">
                <div className="border-r border-blue-200/60 pr-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600 block mb-0.5">
                    {activeReservation.status === 'consultation_completed' ? 'Your Queue' : 'Now Serving'}
                  </span>
                  <div className="text-lg sm:text-xl font-black text-gray-800">
                    {activeReservation.status === 'consultation_completed' ? '—' : nowServingText}
                  </div>
                </div>
                <div className="pl-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600 block mb-0.5">Ahead of You</span>
                  <div className="text-lg sm:text-xl font-black text-gray-800">
                    {activeReservation.status === 'consultation_completed' || schedule?.queueStatus === 'not_started' ? '—' : 
                     activeReservation.status === 'in_consultation' ? '0 Remaining' :
                     patientsAhead > 0 ? `${patientsAhead} Remaining` : '0 Remaining'}
                  </div>
                </div>
              </div>
            </div>

            {/* Section 6: Boarding Pass Cutout Divider */}
            <div className="relative bg-white flex items-center justify-between px-2 py-3">
              <div className="w-6 h-6 bg-gray-50 rounded-full -ml-5 border-r border-gray-200/80 shadow-inner"></div>
              <div className="flex-1 border-t-2 border-dashed border-gray-200 mx-2"></div>
              <div className="w-6 h-6 bg-gray-50 rounded-full -mr-5 border-l border-gray-200/80 shadow-inner"></div>
            </div>

            {/* Section 7: Patient Information */}
            <div className="px-6 sm:px-8 pb-7 pt-3 bg-white text-left">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center">
                  <User className="w-3.5 h-3.5 mr-1.5 text-blue-500" /> Patient Information
                </h3>
                {isIncomplete && (
                  <button onClick={handleOpenPatientInfo} className="text-[11px] font-bold text-blue-600 hover:underline">
                    Edit Info
                  </button>
                )}
              </div>
              <div className="bg-gray-50/80 rounded-2xl p-4 border border-gray-100 grid grid-cols-2 gap-y-3 gap-x-4 text-xs sm:text-sm">
                <div>
                  <span className="text-gray-400 font-semibold block text-[11px]">Child Name</span>
                  <span className="font-bold text-gray-800 truncate block mt-0.5">{activeReservation.childName || "N/A"}</span>
                </div>
                <div>
                  <span className="text-gray-400 font-semibold block text-[11px]">Age & Sex</span>
                  <span className="font-bold text-gray-800 block mt-0.5">
                    {activeReservation.age ? `${activeReservation.age} • ${activeReservation.sex || "N/A"}` : "N/A"}
                  </span>
                </div>
                <div className="col-span-2 pt-2 border-t border-gray-200/60">
                  <span className="text-gray-400 font-semibold block text-[11px] mb-1">Reason for Visit</span>
                  <span className="font-semibold text-gray-700 block bg-white p-2.5 rounded-xl border border-gray-100 text-xs">
                    {activeReservation.concern || "Regular checkup / consultation"}
                  </span>
                </div>
              </div>
            </div>

          </div>

        </div>
      ) : (
        /* Empty State */
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-10 sm:p-14 text-center max-w-md mx-auto animate-in fade-in">
          <div className="mx-auto w-20 h-20 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-6 shadow-2xs">
            <TicketIcon className="w-10 h-10" />
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-gray-800 mb-2">No Active Reservation</h2>
          <p className="text-gray-500 text-sm max-w-xs mx-auto mb-8 leading-relaxed">
            You don&apos;t have an active queue reservation. Reserve a slot to generate your digital ticket.
          </p>
          <button
            onClick={() => navigate("/parent/reserve")}
            className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-extrabold rounded-2xl transition-all shadow-md hover:shadow-lg flex items-center justify-center text-sm sm:text-base focus:outline-none"
          >
            Reserve Queue
          </button>
        </div>
      )}

      {/* FULLSCREEN QR MODAL */}
      {isQrModalOpen && activeReservation && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex flex-col items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
          <button 
            onClick={() => setIsQrModalOpen(false)}
            className="absolute top-6 right-6 sm:top-8 sm:right-8 w-12 h-12 bg-white/10 hover:bg-white/20 text-white rounded-full flex items-center justify-center transition-colors focus:outline-none z-50"
            title="Close"
          >
            <X className="w-6 h-6" />
          </button>

          <div className="w-full max-w-sm bg-white rounded-3xl p-6 sm:p-8 text-center shadow-2xl flex flex-col items-center justify-center animate-in zoom-in-95 duration-200">
            <div className="w-full border-b border-gray-100 pb-4 mb-5">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-widest block mb-0.5">Digital Queue Ticket</span>
              <h2 className="text-3xl font-black text-blue-600">
                Queue #{permanentQueueNumber || "-"}
              </h2>
              <p className="text-sm font-bold text-gray-700 mt-1 truncate">
                {activeReservation.childName || "Patient"}
              </p>
            </div>

            {/* Large QR Code */}
            <div className="bg-white p-4 rounded-3xl border border-gray-100 shadow-inner mb-6 w-64 h-64 sm:w-72 sm:h-72 flex items-center justify-center">
              {qrImageUrl ? (
                <img src={qrImageUrl} alt="Full Screen QR" className="w-full h-full object-contain" />
              ) : (
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              )}
            </div>

            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest block">Reservation Code</span>
            <div className="text-3xl font-black text-gray-800 tracking-wider mt-0.5 mb-6 font-mono">
              {activeReservation.reservationCode || "------"}
            </div>

            <a
              href={qrImageUrl}
              download={`reservation-${activeReservation.reservationCode || 'ticket'}.png`}
              className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-extrabold rounded-2xl transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2.5 text-base focus:outline-none"
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
                className="w-full sm:w-auto px-6 py-2.5 text-white font-bold bg-blue-600 hover:bg-blue-700 transition-colors flex items-center justify-center disabled:opacity-70 disabled:cursor-not-allowed text-sm shadow-2xs focus:outline-none"
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
