import { useState } from "react";
import { QrCode, Type, Search, CheckCircle, User, MapPin, Calendar, Clock, Hash, Activity, X } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "../../hooks/useAuth";
import { validateReservationByCode, checkInReservation } from "../../services/reservationService";
import { getScheduleById } from "../../services/scheduleService";

export default function ValidateReservation() {
  const { user } = useAuth();
  const [reservationCode, setReservationCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [validatedDetails, setValidatedDetails] = useState(null);

  const handleValidate = async () => {
    if (!reservationCode || reservationCode.trim().length !== 6) {
      toast.error("Please enter a valid 6-digit reservation code.");
      return;
    }

    setIsLoading(true);

    try {
      const reservation = await validateReservationByCode(reservationCode.toUpperCase().trim());

      if (!reservation) {
        toast.error("Reservation not found.");
        setIsLoading(false);
        return;
      }

      if (reservation.status === "cancelled") {
        toast.error("This reservation was cancelled.");
        setIsLoading(false);
        return;
      }

      if (reservation.status === "completed") {
        toast.error("This reservation has already been completed.");
        setIsLoading(false);
        return;
      }

      if (!reservation.childName || !reservation.age || !reservation.sex) {
        toast.error("Patient information is incomplete. Parent must complete it first.");
        setIsLoading(false);
        return;
      }
      
      if (reservation.checkedIn || reservation.status === "checked_in") {
        toast.error("This reservation has already been checked in.");
        setIsLoading(false);
        return;
      }

      const schedule = await getScheduleById(reservation.scheduleId);
      if (!schedule) {
        toast.error("Associated schedule not found.");
        setIsLoading(false);
        return;
      }

      // Automatically check in the patient upon successful validation
      await checkInReservation(reservation.id, user.uid);
      
      setValidatedDetails({
        reservation: { ...reservation, status: "checked_in", checkedIn: true },
        schedule
      });
      setShowSuccessModal(true);
      
      // Clear input
      setReservationCode("");

    } catch (error) {
      console.error("Validation error:", error);
      toast.error("An error occurred during validation.");
    } finally {
      setIsLoading(false);
    }
  };

  const closeModal = () => {
    setShowSuccessModal(false);
    setValidatedDetails(null);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-8 relative">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Validate Reservation</h1>
        <p className="text-gray-500 text-sm mt-1">Scan a patient's QR code or enter their reservation code manually.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* QR Scanner Section */}
        <div className="bg-white rounded-2xl p-8 border border-gray-100 shadow-sm flex flex-col items-center text-center hover:shadow-md transition-shadow">
          <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mb-6 text-blue-600">
            <QrCode className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">QR Scanner</h2>
          <p className="text-gray-500 text-sm mb-6">Use the device camera to scan the patient's reservation QR code.</p>
          
          <div className="w-full flex-1 min-h-[250px] bg-gray-50 rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center">
            <QrCode className="w-12 h-12 text-gray-300 mb-3" />
            <p className="text-gray-400 font-medium">Scanner Coming Soon</p>
          </div>
        </div>

        {/* Manual Entry Section */}
        <div className="bg-white rounded-2xl p-8 border border-gray-100 shadow-sm flex flex-col items-center text-center hover:shadow-md transition-shadow">
          <div className="w-16 h-16 bg-purple-50 rounded-2xl flex items-center justify-center mb-6 text-purple-600">
            <Type className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Manual Entry</h2>
          <p className="text-gray-500 text-sm mb-6">Enter the reservation code manually if the QR code is unavailable.</p>
          
          <div className="w-full space-y-4 mt-auto">
            <div>
              <input
                type="text"
                placeholder="Enter 6-digit code"
                value={reservationCode}
                onChange={(e) => setReservationCode(e.target.value.toUpperCase())}
                maxLength={6}
                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-center font-mono text-lg tracking-widest uppercase"
              />
            </div>
            <button 
              onClick={handleValidate}
              disabled={isLoading || reservationCode.trim().length !== 6} 
              className="w-full py-3 px-4 bg-purple-600 text-white rounded-xl font-medium hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Search className="w-5 h-5" />
              )}
              <span>Validate & Check In</span>
            </button>
          </div>
        </div>
      </div>

      {/* Success Modal */}
      {showSuccessModal && validatedDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6">
              <div className="flex justify-between items-start mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-green-50 text-green-600 rounded-xl flex items-center justify-center">
                    <CheckCircle className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-800">Reservation Validated</h2>
                    <p className="text-green-600 font-semibold text-sm">Patient Checked In</p>
                  </div>
                </div>
                <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 transition-colors p-1">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-4 bg-gray-50 p-5 rounded-xl border border-gray-100">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500 flex items-center gap-2"><User className="w-4 h-4"/> Parent Name</span>
                  <span className="font-semibold text-gray-800">{validatedDetails.reservation.parentEmail || "N/A"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500 flex items-center gap-2"><Hash className="w-4 h-4"/> Code</span>
                  <span className="font-mono font-bold text-purple-600">{validatedDetails.reservation.reservationCode}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500 flex items-center gap-2"><MapPin className="w-4 h-4"/> Branch</span>
                  <span className="font-semibold text-gray-800">{validatedDetails.schedule.branch}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500 flex items-center gap-2"><Calendar className="w-4 h-4"/> Date</span>
                  <span className="font-semibold text-gray-800">{validatedDetails.schedule.clinicDate}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500 flex items-center gap-2"><Activity className="w-4 h-4"/> Queue Position</span>
                  <span className="font-bold text-gray-800 text-lg">#{validatedDetails.reservation.queuePosition}</span>
                </div>
              </div>

              <button
                onClick={closeModal}
                className="w-full mt-6 py-3 font-bold rounded-xl text-white bg-green-600 hover:bg-green-700 shadow-sm transition-all"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
