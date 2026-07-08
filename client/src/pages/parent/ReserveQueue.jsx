import { CalendarPlus, CalendarDays, Clock, MapPin, Users, CheckCircle2, AlertCircle, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { subscribeToPublishedSchedules } from "../../services/scheduleService";
import { 
  subscribeToAllReservations, 
  createReservation, 
  checkExistingReservationOnDate, 
  checkCompletedConsultationOnDate,
  getReservationsBySchedule,
  updatePatientInfo
} from "../../services/reservationService";
import { useAuth } from "../../hooks/useAuth";
import MessageModal from "../../components/common/MessageModal";

export default function ReserveQueue() {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [schedules, setSchedules] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [parentReservation, setParentReservation] = useState(null);

  // Modal States
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isPatientInfoModalOpen, setIsPatientInfoModalOpen] = useState(false);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [generatedQueuePosition, setGeneratedQueuePosition] = useState(null);
  const [activeReservationId, setActiveReservationId] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Patient Info Form State
  const [formData, setFormData] = useState({
    childName: "",
    age: "",
    sex: "",
    concern: ""
  });

  const [messageModalState, setMessageModalState] = useState({
    isOpen: false,
    type: 'info',
    title: '',
    message: ''
  });

  const formatTime = (time) => {
    if (!time) return '';
    const [hours, minutes] = time.split(':');
    const h = parseInt(hours, 10);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const formattedH = h % 12 || 12;
    return `${formattedH}:${minutes} ${ampm}`;
  };

  useEffect(() => {
    const unsubSchedules = subscribeToPublishedSchedules((data) => {
      const sorted = data.sort((a, b) => new Date(a.clinicDate) - new Date(b.clinicDate));
      setSchedules(sorted);
      setLoading(false);
    });

    const unsubReservations = subscribeToAllReservations((data) => {
      setReservations(data);
      // Status Detection
      if (user) {
        const activeRes = data.find(res => 
          res.parentId === user.uid && 
          res.status !== "cancelled" && 
          res.status !== "completed"
        );
        setParentReservation(activeRes || null);
      }
    });

    return () => {
      unsubSchedules();
      unsubReservations();
    };
  }, [user]);

  const getReservationCount = (scheduleId) => {
    return reservations.filter(r => r.scheduleId === scheduleId && ['reserved', 'waiting', 'validation_open', 'waiting_for_window', 'checked_in', 'in_consultation'].includes(r.status)).length;
  };

  const handleReserveClick = async (schedule) => {
    // Check Capacity
    const currentCount = getReservationCount(schedule.id);
    if (currentCount >= schedule.slotCapacity) {
      setMessageModalState({
        isOpen: true,
        type: 'error',
        title: 'Schedule Full',
        message: 'This schedule is already full.'
      });
      return;
    }

    // Check if Queue Ended
    if (schedule.queueStatus === 'closed' || schedule.queueStatus === 'ended' || schedule.queueStatus === 'completed') {
      setMessageModalState({
        isOpen: true,
        type: 'error',
        title: 'Queue Closed',
        message: 'This clinic queue has closed to new reservations. Reservations are no longer accepted.'
      });
      return;
    }

    // Check Duplicate on Clinic Date
    const hasExistingOnDate = await checkExistingReservationOnDate(user.uid, schedule.clinicDate);
    if (hasExistingOnDate) {
      setMessageModalState({
        isOpen: true,
        type: 'warning',
        title: 'Active Reservation Exists',
        message: 'You already have an active reservation for this date. You may only reserve one clinic schedule per day.'
      });
      return;
    }

    // Check if parent already completed a consultation with this doctor on this calendar day
    const hasCompletedToday = await checkCompletedConsultationOnDate(user.uid, schedule.clinicDate, schedule.doctorId);
    if (hasCompletedToday) {
      setMessageModalState({
        isOpen: true,
        type: 'warning',
        title: 'Consultation Completed Today',
        message: "You've already completed your consultation for today's clinic.\n\nYou can reserve another slot on the doctor's next available clinic schedule."
      });
      return;
    }

    setSelectedSchedule(schedule);
    setFormData({ childName: "", age: "", sex: "", concern: "" });
    setIsConfirmModalOpen(true);
  };

  const handleConfirmReservation = async () => {
    if (!selectedSchedule || !user) return;
    
    setIsSubmitting(true);
    try {
      // Double check duplicate just in case
      const hasExistingOnDate = await checkExistingReservationOnDate(user.uid, selectedSchedule.clinicDate);
      if (hasExistingOnDate) {
        setIsConfirmModalOpen(false);
        setMessageModalState({
          isOpen: true,
          type: 'warning',
          title: 'Active Reservation Exists',
          message: 'You already have an active reservation for this date. You may only reserve one clinic schedule per day.'
        });
        return;
      }

      const hasCompletedToday = await checkCompletedConsultationOnDate(user.uid, selectedSchedule.clinicDate, selectedSchedule.doctorId);
      if (hasCompletedToday) {
        setIsConfirmModalOpen(false);
        setMessageModalState({
          isOpen: true,
          type: 'warning',
          title: 'Consultation Completed Today',
          message: "You've already completed your consultation for today's clinic.\n\nYou can reserve another slot on the doctor's next available clinic schedule."
        });
        return;
      }

      // Create reservation without static queue position
      const reservationId = await createReservation({
        parentId: user.uid,
        parentEmail: user.email,
        scheduleId: selectedSchedule.id,
        status: "reserved",
      });

      // Fetch newly calculated dynamic position
      const updatedReservations = await getReservationsBySchedule(selectedSchedule.id);
      const newRes = updatedReservations.find(r => r.id === reservationId);

      setGeneratedQueuePosition(newRes?.queuePosition || "Assigned");
      setActiveReservationId(reservationId);
      setIsConfirmModalOpen(false);
      setIsPatientInfoModalOpen(true);
    } catch (error) {
      console.error("Failed to create reservation", error);
      setMessageModalState({
        isOpen: true,
        type: 'error',
        title: 'Reservation Failed',
        message: 'There was an error processing your reservation. Please try again.'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitPatientInfo = async () => {
    if (!activeReservationId) return;
    setIsSubmitting(true);
    try {
      await updatePatientInfo(activeReservationId, {
        childName: formData.childName.trim(),
        age: formData.age.trim(),
        sex: formData.sex,
        concern: formData.concern.trim(),
      });
      setIsPatientInfoModalOpen(false);
      setIsSuccessModalOpen(true);
    } catch (err) {
      console.error(err);
      setMessageModalState({
        isOpen: true,
        type: 'error',
        title: 'Update Failed',
        message: 'Could not save patient information. Please try again.'
      });
      // Do not close modal on error
    } finally {
      setIsSubmitting(false);
    }
  };

  const closeSuccessModal = () => {
    setIsSuccessModalOpen(false);
    setSelectedSchedule(null);
    setGeneratedQueuePosition(null);
    setActiveReservationId(null);
  };

  return (
    <div className="space-y-6 pb-6 relative">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Reserve Queue</h1>
        <p className="text-gray-500 mt-1">
          Select an available clinic schedule to reserve a slot.
        </p>
      </div>


      {loading ? (
        <div className="flex justify-center items-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : schedules.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {schedules.map((schedule) => {
            const currentReservations = getReservationCount(schedule.id);
            const availableSlots = schedule.slotCapacity - currentReservations;
            const isFull = availableSlots <= 0;
            const isEnded = schedule.queueStatus === 'closed' || schedule.queueStatus === 'ended' || schedule.queueStatus === 'completed';
            
            // Check if parent has an active reservation on this schedule's clinicDate
            const hasReservedOnDate = reservations.some(r => 
              r.parentId === user?.uid && 
              ["reserved", "waiting", "validation_open", "waiting_for_window", "checked_in", "in_consultation"].includes(r.status) && 
              schedules.find(s => s.id === r.scheduleId)?.clinicDate === schedule.clinicDate
            );

            // Check if parent already completed a consultation with this doctor on this calendar day
            const hasCompletedOnDate = reservations.some(r => {
              if (r.parentId !== user?.uid) return false;
              if (r.status !== "completed" && r.status !== "consultation_completed") return false;
              const resSchedule = schedules.find(s => s.id === r.scheduleId);
              if (!resSchedule) return false;
              if (resSchedule.clinicDate !== schedule.clinicDate) return false;
              if (schedule.doctorId && resSchedule.doctorId && resSchedule.doctorId !== schedule.doctorId) return false;
              return true;
            });

            const buttonDisabled = isFull || hasReservedOnDate || isEnded;

            return (
              <div key={schedule.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md hover:border-blue-100 transition-all p-5 flex flex-col">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-lg font-bold text-gray-800 flex items-center">
                    <MapPin className="w-5 h-5 mr-2 text-gray-400" />
                    {schedule.branch} Branch
                  </h3>
                  {schedule.queueStatus === 'not_started' ? (
                    <div className="px-3 py-1 bg-amber-50 text-amber-700 rounded-full text-xs font-bold flex items-center border border-amber-200">
                      <Clock className="w-3.5 h-3.5 mr-1.5" />
                      Reservations Open
                    </div>
                  ) : schedule.queueStatus === 'active' ? (
                    <div className="px-3 py-1 bg-green-50 text-green-700 rounded-full text-xs font-bold flex items-center border border-green-200">
                      <div className="w-2 h-2 rounded-full bg-green-500 mr-1.5 animate-pulse"></div>
                      Active Queue
                    </div>
                  ) : schedule.queueStatus === 'paused' ? (
                    <div className="px-3 py-1 bg-orange-50 text-orange-700 rounded-full text-xs font-bold flex items-center border border-orange-200">
                      <AlertCircle className="w-3.5 h-3.5 mr-1.5" />
                      Paused
                    </div>
                  ) : schedule.queueStatus === 'closed' ? (
                    <div className="px-3 py-1 bg-amber-50 text-amber-800 rounded-full text-xs font-bold flex items-center border border-amber-300">
                      <div className="w-2 h-2 rounded-full bg-amber-500 mr-1.5"></div>
                      Queue Closed
                    </div>
                  ) : (
                    <div className="px-3 py-1 bg-gray-50 text-gray-700 rounded-full text-xs font-bold flex items-center border border-gray-200">
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                      {schedule.queueStatus || 'Published'}
                    </div>
                  )}
                </div>

                <div className="space-y-3 mb-6 flex-1">
                  <div className="flex items-center text-sm">
                    <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center mr-3">
                      <CalendarDays className="w-4 h-4 text-gray-500" />
                    </div>
                    <span className="text-gray-600 font-medium">Date: <span className="text-gray-800">{new Date(schedule.clinicDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</span></span>
                  </div>
                  
                  <div className="flex items-center text-sm">
                    <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center mr-3">
                      <Clock className="w-4 h-4 text-gray-500" />
                    </div>
                    <span className="text-gray-600 font-medium">Clinic Hours: <span className="text-gray-800">{formatTime(schedule.openingTime)} - {formatTime(schedule.closingTime)}</span></span>
                  </div>

                  <div className="flex items-center text-sm">
                    <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center mr-3">
                      <Users className="w-4 h-4 text-gray-500" />
                    </div>
                    <span className="text-gray-600 font-medium">
                      Available Slots: <span className={`${isFull ? 'text-red-600' : 'text-gray-800'} font-bold`}>{availableSlots} / {schedule.slotCapacity}</span>
                    </span>
                  </div>
                </div>

                <button 
                  onClick={() => handleReserveClick(schedule)}
                  disabled={buttonDisabled}
                  className={`w-full py-2.5 font-bold rounded-xl shadow-sm transition-colors flex items-center justify-center ${
                    isEnded
                      ? 'bg-gray-100 text-gray-500 cursor-not-allowed text-sm'
                      : hasReservedOnDate 
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : hasCompletedOnDate
                          ? 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 text-sm'
                          : isFull 
                            ? 'bg-gray-100 text-gray-500 cursor-not-allowed text-xs px-3 leading-snug' 
                            : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {!hasReservedOnDate && !hasCompletedOnDate && !isEnded && <CalendarPlus className={`w-4 h-4 mr-2 flex-shrink-0 ${isFull ? 'hidden' : ''}`} />}
                  <span>
                    {isEnded
                      ? 'Queue Closed'
                      : hasReservedOnDate 
                        ? 'Already Reserved'
                        : hasCompletedOnDate
                          ? 'Consultation Completed Today'
                          : isFull 
                            ? 'Slots are currently full. Please wait until a slot becomes available.' 
                            : 'Reserve Slot'}
                  </span>
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-8 md:p-12 text-center">
            <div className="mx-auto w-16 h-16 bg-gray-50 text-gray-400 rounded-full flex items-center justify-center mb-6">
              <CalendarDays className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">No Available Schedules</h2>
            <p className="text-gray-500 max-w-md mx-auto text-sm">
              There are currently no published clinic schedules available for reservation. Please check back later.
            </p>
          </div>
        </div>
      )}

      {/* Confirm Reservation Modal */}
      {isConfirmModalOpen && selectedSchedule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-5 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-800">Confirm Reservation</h2>
              <button onClick={() => setIsConfirmModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-lg hover:bg-gray-50">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto">
              <div className="bg-blue-50/50 rounded-xl p-4 mb-6 border border-blue-100/50">
                <div className="flex items-center mb-2">
                  <MapPin className="w-4 h-4 text-blue-600 mr-2" />
                  <span className="font-semibold text-gray-800">Branch: {selectedSchedule.branch}</span>
                </div>
                <div className="flex items-center">
                  <CalendarDays className="w-4 h-4 text-blue-600 mr-2" />
                  <span className="font-semibold text-gray-800">Date: {new Date(selectedSchedule.clinicDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</span>
                </div>
              </div>
              
              <div className="flex items-start text-amber-700 bg-amber-50 p-4 rounded-xl border border-amber-100 mb-6">
                <AlertCircle className="w-5 h-5 mr-3 mt-0.5 flex-shrink-0" />
                <p className="text-sm font-medium">Queue reservations cannot be duplicated. Do you want to reserve this slot?</p>
              </div>
            </div>

            <div className="p-5 border-t border-gray-100 bg-gray-50 flex gap-3 justify-end">
              <button 
                onClick={() => setIsConfirmModalOpen(false)}
                disabled={isSubmitting}
                className="px-5 py-2.5 text-gray-600 font-semibold bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button 
                onClick={handleConfirmReservation}
                disabled={isSubmitting}
                className="px-5 py-2.5 text-white font-bold bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors flex items-center disabled:opacity-70"
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Processing...
                  </>
                ) : "Confirm Reservation"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Complete Patient Info Modal */}
      {isPatientInfoModalOpen && selectedSchedule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-5 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-800">Complete Patient Information</h2>
            </div>
            
            <div className="p-6 overflow-y-auto">
              <div className="flex items-start text-blue-700 bg-blue-50 p-4 rounded-xl border border-blue-100 mb-6">
                <CheckCircle2 className="w-5 h-5 mr-3 mt-0.5 flex-shrink-0" />
                <p className="text-sm font-medium">Your slot is reserved! Please provide the patient's information to finalize the check-in process.</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Child Full Name *</label>
                  <input 
                    type="text" 
                    value={formData.childName}
                    onChange={e => setFormData(prev => ({ ...prev, childName: e.target.value }))}
                    placeholder="Enter child's full name"
                    className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Age *</label>
                    <input 
                      type="text" 
                      value={formData.age}
                      onChange={e => setFormData(prev => ({ ...prev, age: e.target.value }))}
                      placeholder="e.g. 5 yrs"
                      className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Sex *</label>
                    <select
                      value={formData.sex}
                      onChange={e => setFormData(prev => ({ ...prev, sex: e.target.value }))}
                      className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all cursor-pointer"
                    >
                      <option value="">Select</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Concern / Reason for Visit</label>
                  <textarea 
                    value={formData.concern}
                    onChange={e => setFormData(prev => ({ ...prev, concern: e.target.value }))}
                    placeholder="Optional: briefly describe the symptoms or reason for visit"
                    rows={3}
                    className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all resize-none"
                  ></textarea>
                </div>
              </div>
            </div>

            <div className="p-5 border-t border-gray-100 bg-gray-50 flex gap-3 justify-end">
              <button 
                onClick={handleSubmitPatientInfo}
                disabled={isSubmitting || !formData.childName.trim() || !formData.age.trim() || !formData.sex}
                className="px-5 py-2.5 text-white font-bold bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors flex items-center disabled:opacity-70 disabled:cursor-not-allowed w-full justify-center"
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

      {/* Success Modal */}
      {isSuccessModalOpen && selectedSchedule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl overflow-hidden flex flex-col text-center animate-in zoom-in-95 duration-200">
            <div className="p-8">
              <div className="mx-auto w-16 h-16 bg-green-50 text-green-600 rounded-full flex items-center justify-center mb-5">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h2 className="text-xl font-bold text-gray-800 mb-2">Reservation Successful</h2>
              <p className="text-gray-500 text-sm mb-6">You have successfully reserved a slot.</p>
              
              <div className="bg-gray-50 rounded-xl p-5 border border-gray-100 mb-6">
                <div className="text-sm text-gray-500 mb-1">Queue Position</div>
                <div className="text-4xl font-black text-blue-600 mb-4">{generatedQueuePosition}</div>
                
                <div className="flex flex-col space-y-2 text-sm text-left">
                  <div className="flex justify-between border-t border-gray-200 pt-3">
                    <span className="text-gray-500">Branch:</span>
                    <span className="font-semibold text-gray-800">{selectedSchedule.branch}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Date:</span>
                    <span className="font-semibold text-gray-800">{new Date(selectedSchedule.clinicDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <button 
                  onClick={() => { closeSuccessModal(); navigate('/parent/reservations'); }}
                  className="w-full py-2.5 text-white font-bold bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors shadow-sm"
                >
                  View My Reservation
                </button>
                <button 
                  onClick={closeSuccessModal}
                  className="w-full py-2.5 text-gray-600 font-bold bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors shadow-sm"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}


      {/* Global Message Modal */}
      <MessageModal
        isOpen={messageModalState.isOpen}
        type={messageModalState.type}
        title={messageModalState.title}
        message={messageModalState.message}
        onClose={() => setMessageModalState(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}
