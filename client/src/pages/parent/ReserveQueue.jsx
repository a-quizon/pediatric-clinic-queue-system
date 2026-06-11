import { CalendarPlus, CalendarDays, Clock, MapPin, Users, CheckCircle2, AlertCircle, X } from "lucide-react";
import { useEffect, useState } from "react";
import { subscribeToPublishedSchedules } from "../../services/scheduleService";
import { 
  subscribeToAllReservations, 
  createReservation, 
  checkExistingGlobalReservation, 
  generateQueueNumber 
} from "../../services/reservationService";
import { useAuth } from "../../hooks/useAuth";

export default function ReserveQueue() {
  const { user } = useAuth();
  
  const [schedules, setSchedules] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal States
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [generatedQueueNumber, setGeneratedQueueNumber] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

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
    });

    return () => {
      unsubSchedules();
      unsubReservations();
    };
  }, []);

  const getReservationCount = (scheduleId) => {
    return reservations.filter(r => r.scheduleId === scheduleId && r.status !== "cancelled").length;
  };

  const handleReserveClick = async (schedule) => {
    setErrorMsg("");
    
    // Check Capacity
    const currentCount = getReservationCount(schedule.id);
    if (currentCount >= schedule.slotCapacity) {
      setErrorMsg("Schedule is already full.");
      setTimeout(() => setErrorMsg(""), 3000);
      return;
    }

    // Check Duplicate
    const hasExisting = await checkExistingGlobalReservation(user.uid);
    if (hasExisting) {
      setErrorMsg("You already have an active reservation. Please cancel your current reservation before reserving another slot.");
      setTimeout(() => setErrorMsg(""), 5000);
      return;
    }

    setSelectedSchedule(schedule);
    setIsConfirmModalOpen(true);
  };

  const handleConfirmReservation = async () => {
    if (!selectedSchedule || !user) return;
    
    setIsSubmitting(true);
    try {
      // Double check duplicate just in case
      const hasExisting = await checkExistingGlobalReservation(user.uid);
      if (hasExisting) {
        setIsConfirmModalOpen(false);
        setErrorMsg("You already have an active reservation. Please cancel your current reservation before reserving another slot.");
        setTimeout(() => setErrorMsg(""), 5000);
        return;
      }

      // Generate Queue Number and create reservation
      const queueNumber = await generateQueueNumber(selectedSchedule.id);
      await createReservation({
        parentId: user.uid,
        parentEmail: user.email,
        scheduleId: selectedSchedule.id,
        queueNumber,
        status: "reserved",
      });

      setGeneratedQueueNumber(queueNumber);
      setIsConfirmModalOpen(false);
      setIsSuccessModalOpen(true);
    } catch (error) {
      console.error("Failed to create reservation", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const closeSuccessModal = () => {
    setIsSuccessModalOpen(false);
    setSelectedSchedule(null);
    setGeneratedQueueNumber(null);
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

      {errorMsg && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center shadow-sm">
          <AlertCircle className="w-5 h-5 mr-3 text-red-600" />
          <span className="font-medium text-sm">{errorMsg}</span>
        </div>
      )}

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

            return (
              <div key={schedule.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md hover:border-blue-100 transition-all p-5 flex flex-col">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-lg font-bold text-gray-800 flex items-center">
                    <MapPin className="w-5 h-5 mr-2 text-gray-400" />
                    {schedule.branch} Branch
                  </h3>
                  <div className="px-3 py-1 bg-green-50 text-green-700 rounded-full text-xs font-bold flex items-center">
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                    Published
                  </div>
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
                  disabled={isFull}
                  className={`w-full py-2.5 font-bold rounded-xl shadow-sm transition-colors flex items-center justify-center ${
                    isFull 
                      ? 'bg-gray-100 text-gray-500 cursor-not-allowed text-xs px-3 leading-snug' 
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  <CalendarPlus className={`w-4 h-4 mr-2 flex-shrink-0 ${isFull ? 'hidden' : ''}`} />
                  <span>
                    {isFull ? 'Slots are currently full. Please wait until additional slots become available or a new clinic schedule is opened.' : 'Reserve Slot'}
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

      {/* Success Modal */}
      {isSuccessModalOpen && selectedSchedule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl overflow-hidden flex flex-col text-center">
            <div className="p-8">
              <div className="mx-auto w-16 h-16 bg-green-50 text-green-600 rounded-full flex items-center justify-center mb-5">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h2 className="text-xl font-bold text-gray-800 mb-2">Reservation Successful</h2>
              <p className="text-gray-500 text-sm mb-6">Your reservation has been created.</p>
              
              <div className="bg-gray-50 rounded-xl p-5 border border-gray-100 mb-6">
                <div className="text-sm text-gray-500 mb-1">Queue Number</div>
                <div className="text-4xl font-black text-blue-600 mb-4">{generatedQueueNumber}</div>
                
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

              <button 
                onClick={closeSuccessModal}
                className="w-full py-2.5 text-white font-bold bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
