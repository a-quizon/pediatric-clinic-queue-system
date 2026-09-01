import { CalendarPlus, CalendarDays, Clock, MapPin, Users, CheckCircle2, AlertCircle, Baby, Plus } from "lucide-react";
import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { subscribeToPublishedSchedules } from "../../services/scheduleService";
import { 
  subscribeToParentReservations,
  subscribeToScheduleReservations, 
  createReservation, 
  checkExistingReservationOnDate, 
  checkCompletedConsultationOnDate,
  getReservationsBySchedule,
  updatePatientInfo,
  cancelReservation,
  ACTIVE_RESERVATION_STATUSES
} from "../../services/reservationService";
import { addChild, subscribeToChildren } from "../../services/childProfileService";
import { buildPatientInfoPayload } from "../../utils/reservationPatients";
import { getBranchConfigurations } from "../../services/branchConfigurationService";
import { useAuth } from "../../hooks/useAuth";
import MessageModal from "../../components/common/MessageModal";
import ChildProfileForm, {
  emptyChildProfile,
  isChildProfileValid
} from "../../components/parent/ChildProfileForm";

export default function ReserveQueue() {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [schedules, setSchedules] = useState([]);
  const [parentReservationsList, setParentReservationsList] = useState([]);
  const [scheduleCapacities, setScheduleCapacities] = useState({});
  const activeScheduleListenersRef = useRef({});
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal States
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  const [isPatientInfoModalOpen, setIsPatientInfoModalOpen] = useState(false);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [generatedQueuePosition, setGeneratedQueuePosition] = useState(null);
  const [activeReservationId, setActiveReservationId] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [savedChildren, setSavedChildren] = useState([]);
  const [selectedChildIds, setSelectedChildIds] = useState([]);
  const [concern, setConcern] = useState("");
  const [isAddChildOpen, setIsAddChildOpen] = useState(false);
  const [newChildForm, setNewChildForm] = useState(emptyChildProfile());
  const [isSavingChild, setIsSavingChild] = useState(false);

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
    let unsubParent = () => {};
    let unsubChildren = () => {};
    if (user) {
      unsubParent = subscribeToParentReservations(user.uid, (data) => {
        setParentReservationsList(data);
      });
      unsubChildren = subscribeToChildren(user.uid, setSavedChildren);
    }

    const unsubSchedules = subscribeToPublishedSchedules((data) => {
      const sorted = data.sort((a, b) => {
        const dateDiff = new Date(a.clinicDate) - new Date(b.clinicDate);
        if (dateDiff !== 0) return dateDiff;
        const timeA = a.openingTime || "";
        const timeB = b.openingTime || "";
        return timeA.localeCompare(timeB);
      });
      setSchedules(sorted);
      setLoading(false);
    });

    getBranchConfigurations().then(setBranches);

    return () => {
      unsubSchedules();
      unsubParent();
      unsubChildren();
    };
  }, [user]);

  // Dynamic schedule listener lifecycle
  useEffect(() => {
    const currentScheduleIds = schedules.map(s => s.id);
    const existingIds = Object.keys(activeScheduleListenersRef.current);

    // 1. Add new listeners
    currentScheduleIds.forEach(scheduleId => {
      if (!activeScheduleListenersRef.current[scheduleId]) {
        activeScheduleListenersRef.current[scheduleId] = subscribeToScheduleReservations(scheduleId, (data) => {
          const count = data.filter(r => ACTIVE_RESERVATION_STATUSES.includes(r.status)).length;
          setScheduleCapacities(prev => ({
            ...prev,
            [scheduleId]: count
          }));
        });
      }
    });

    // 2. Remove obsolete listeners
    existingIds.forEach(id => {
      if (!currentScheduleIds.includes(id)) {
        activeScheduleListenersRef.current[id]();
        delete activeScheduleListenersRef.current[id];
        setScheduleCapacities(prev => {
          const newState = { ...prev };
          delete newState[id];
          return newState;
        });
      }
    });
  }, [schedules]);

  // Cleanup all schedule listeners on unmount
  useEffect(() => {
    return () => {
      Object.values(activeScheduleListenersRef.current).forEach(unsub => unsub());
      activeScheduleListenersRef.current = {};
    };
  }, []);

  const getReservationCount = (scheduleId) => {
    return scheduleCapacities[scheduleId];
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
    setSelectedChildIds([]);
    setConcern("");
    setIsAddChildOpen(false);
    setNewChildForm(emptyChildProfile());
    
    setIsSubmitting(true);
    try {
      // Create reservation without static queue position
      const reservationId = await createReservation({
        parentId: user.uid,
        parentEmail: user.email,
        scheduleId: schedule.id,
        status: "reserved",
      });

      // Fetch newly calculated dynamic position
      const updatedReservations = await getReservationsBySchedule(schedule.id);
      const newRes = updatedReservations.find(r => r.id === reservationId);

      setGeneratedQueuePosition(newRes?.queuePosition || "Assigned");
      setActiveReservationId(reservationId);
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

  const handleCancelReservation = async () => {
    if (!activeReservationId) return;
    setIsSubmitting(true);
    try {
      await cancelReservation(activeReservationId);
      setActiveReservationId(null);
      setGeneratedQueuePosition(null);
      setSelectedSchedule(null);
      setSelectedChildIds([]);
      setConcern("");
      setIsAddChildOpen(false);
      setIsPatientInfoModalOpen(false);
    } catch (error) {
      console.error("Failed to cancel reservation", error);
      setMessageModalState({
        isOpen: true,
        type: 'error',
        title: 'Cancellation Failed',
        message: 'There was an error cancelling your reservation. Please try again.'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleChildSelection = (childId) => {
    setSelectedChildIds((prev) =>
      prev.includes(childId) ? prev.filter((id) => id !== childId) : [...prev, childId]
    );
  };

  const handleAddChildFromReserve = async () => {
    if (!user?.uid || !isChildProfileValid(newChildForm)) return;
    setIsSavingChild(true);
    try {
      const childId = await addChild(user.uid, newChildForm);
      if (childId) {
        setSelectedChildIds((prev) => prev.includes(childId) ? prev : [...prev, childId]);
      }
      setNewChildForm(emptyChildProfile());
      setIsAddChildOpen(false);
    } catch (err) {
      console.error(err);
      setMessageModalState({
        isOpen: true,
        type: "error",
        title: "Could Not Add Child",
        message: "There was an error saving this child profile. Please try again."
      });
    } finally {
      setIsSavingChild(false);
    }
  };

  const handleSubmitPatientInfo = async () => {
    if (!activeReservationId) return;
    const selected = savedChildren.filter((child) => selectedChildIds.includes(child.id));
    if (selected.length === 0) return;
    setIsSubmitting(true);
    try {
      await updatePatientInfo(activeReservationId, buildPatientInfoPayload(selected, concern));
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

      {loading ? (
        <div className="flex justify-center items-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : schedules.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {schedules.map((schedule) => {
            const currentReservations = getReservationCount(schedule.id);
            
            if (currentReservations === undefined) {
              return (
                <div key={schedule.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 flex flex-col min-h-[250px] animate-pulse">
                  <div className="w-1/2 h-6 bg-gray-200 rounded mb-4"></div>
                  <div className="space-y-3 mb-6 flex-1">
                    <div className="w-3/4 h-4 bg-gray-200 rounded"></div>
                    <div className="w-2/3 h-4 bg-gray-200 rounded"></div>
                    <div className="w-1/2 h-4 bg-gray-200 rounded"></div>
                  </div>
                  <div className="w-full h-10 bg-gray-200 rounded-xl"></div>
                </div>
              );
            }

            const availableSlots = schedule.slotCapacity - currentReservations;
            const isFull = availableSlots <= 0;
            const isEnded = schedule.queueStatus === 'closed' || schedule.queueStatus === 'ended' || schedule.queueStatus === 'completed';
            
            // Check if parent has an active reservation on this schedule's clinicDate
            const hasReservedOnDate = parentReservationsList.some(r => 
              ACTIVE_RESERVATION_STATUSES.includes(r.status) && 
              schedules.find(s => s.id === r.scheduleId)?.clinicDate === schedule.clinicDate
            );

            // Check if parent already completed a consultation with this doctor on this calendar day
            const hasCompletedOnDate = parentReservationsList.some(r => {
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
                  <div className="flex flex-col">
                    <h3 className="text-lg font-bold text-gray-800 flex items-center">
                      <MapPin className="w-5 h-5 mr-2 text-gray-400 shrink-0" />
                      {schedule.branch} Branch
                    </h3>
                    <p className="text-xs text-gray-500 whitespace-pre-line ml-7 mt-0.5 line-clamp-2">
                      {branches.find(b => b.name === schedule.branch)?.clinicAddress || "No clinic address provided."}
                    </p>
                  </div>
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



      {/* Complete Patient Info Modal */}
      {isPatientInfoModalOpen && selectedSchedule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-5 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-800">Select Patients</h2>
            </div>
            
            <div className="p-6 overflow-y-auto">
              <div className="flex items-start text-blue-700 bg-blue-50 p-4 rounded-xl border border-blue-100 mb-6">
                <CheckCircle2 className="w-5 h-5 mr-3 mt-0.5 flex-shrink-0" />
                <p className="text-sm font-medium">Your slot is reserved. Choose one or more children this visit is for, then add the reason for the visit.</p>
              </div>

              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">Who is this reservation for? *</label>
                    <button
                      type="button"
                      onClick={() => {
                        setNewChildForm(emptyChildProfile());
                        setIsAddChildOpen(true);
                      }}
                      className="text-xs font-bold text-blue-600 hover:text-blue-700 inline-flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add a Child
                    </button>
                  </div>

                  {savedChildren.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-5 text-center">
                      <Baby className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                      <p className="text-sm text-gray-600 font-medium mb-3">No child profiles yet. Add a child to continue.</p>
                      <button
                        type="button"
                        onClick={() => {
                          setNewChildForm(emptyChildProfile());
                          setIsAddChildOpen(true);
                        }}
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700"
                      >
                        <Plus className="w-4 h-4" />
                        Add a Child
                      </button>
                    </div>
                  ) : (
                    <ul className="space-y-2">
                      {savedChildren.map((child) => {
                        const checked = selectedChildIds.includes(child.id);
                        return (
                          <li key={child.id}>
                            <label className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                              checked ? "border-blue-300 bg-blue-50" : "border-gray-200 bg-white hover:border-blue-200"
                            }`}>
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleChildSelection(child.id)}
                                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              />
                              <span className="min-w-0">
                                <span className="block text-sm font-bold text-gray-800 truncate">{child.childName}</span>
                                <span className="block text-xs text-gray-500">{child.age} • {child.sex}</span>
                              </span>
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Concern / Reason for Visit</label>
                  <textarea 
                    value={concern}
                    onChange={e => setConcern(e.target.value)}
                    placeholder="Optional: briefly describe the symptoms or reason for visit"
                    rows={3}
                    className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all resize-none"
                  ></textarea>
                </div>
              </div>
            </div>

            <div className="p-5 border-t border-gray-100 bg-gray-50 flex gap-3 justify-end">
              <button 
                onClick={handleCancelReservation}
                disabled={isSubmitting}
                className="w-full sm:w-auto px-5 py-2.5 text-gray-600 font-bold bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50 text-sm focus:outline-none"
              >
                Cancel Reservation
              </button>
              <button 
                onClick={handleSubmitPatientInfo}
                disabled={isSubmitting || selectedChildIds.length === 0}
                className="w-full px-5 py-2.5 text-white font-bold bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors flex items-center justify-center disabled:opacity-70 disabled:cursor-not-allowed shadow-sm focus:outline-none"
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

      {isAddChildOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-5 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-800">Add a Child</h2>
            </div>
            <div className="p-6 overflow-y-auto">
              <ChildProfileForm value={newChildForm} onChange={setNewChildForm} idPrefix="reserve-child" />
            </div>
            <div className="p-5 border-t border-gray-100 bg-gray-50 flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => !isSavingChild && setIsAddChildOpen(false)}
                disabled={isSavingChild}
                className="px-5 py-2.5 text-gray-600 font-bold bg-white border border-gray-200 rounded-xl hover:bg-gray-50 disabled:opacity-50 text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddChildFromReserve}
                disabled={isSavingChild || !isChildProfileValid(newChildForm)}
                className="px-5 py-2.5 text-white font-bold bg-blue-600 rounded-xl hover:bg-blue-700 disabled:opacity-70 disabled:cursor-not-allowed text-sm"
              >
                {isSavingChild ? "Saving..." : "Save Child"}
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
                  <div className="flex justify-between items-start border-t border-gray-200 pt-3">
                    <span className="text-gray-500 shrink-0 mr-4">Branch:</span>
                    <div className="flex flex-col text-right">
                      <span className="font-semibold text-gray-800">{selectedSchedule.branch}</span>
                      <span className="text-xs text-gray-500 whitespace-pre-line mt-0.5">
                        {branches.find(b => b.name === selectedSchedule.branch)?.clinicAddress || "No clinic address provided."}
                      </span>
                    </div>
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
