import React, { useState, useEffect, useRef } from "react";
import { QrCode, Type, Search, CheckCircle, User, MapPin, Calendar, Clock, Hash, Activity, X, Camera, CameraOff, AlertCircle, AlertTriangle, PlayCircle, StopCircle } from "lucide-react";
import toast from "react-hot-toast";
import { Html5Qrcode } from "html5-qrcode";
import { useAuth } from "../../hooks/useAuth";
import { validateReservationByCode, checkInReservation } from "../../services/reservationService";
import { getScheduleById } from "../../services/scheduleService";

export default function ValidateReservation() {
  const { user } = useAuth();
  const [reservationCode, setReservationCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  
  // Modal states
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showFoundModal, setShowFoundModal] = useState(false);
  const [showInvalidModal, setShowInvalidModal] = useState(false);
  const [showExpiredModal, setShowExpiredModal] = useState(false);
  const [showCheckedInModal, setShowCheckedInModal] = useState(false);
  const [showInConsultationModal, setShowInConsultationModal] = useState(false);
  const [showNotStartedModal, setShowNotStartedModal] = useState(false);
  const [showPausedModal, setShowPausedModal] = useState(false);
  const [showEndedModal, setShowEndedModal] = useState(false);

  const [validatedDetails, setValidatedDetails] = useState(null);

  // Scanner states
  const [isScanning, setIsScanning] = useState(false);
  const [cameras, setCameras] = useState([]);
  const [selectedCameraId, setSelectedCameraId] = useState("");
  const html5QrCodeRef = useRef(null);

  useEffect(() => {
    Html5Qrcode.getCameras().then(devices => {
      if (devices && devices.length) {
        setCameras(devices);
        const backCamera = devices.find(d => d.label.toLowerCase().includes('back') || d.label.toLowerCase().includes('environment'));
        setSelectedCameraId(backCamera ? backCamera.id : devices[0].id);
      }
    }).catch(err => {
      console.warn("Error getting cameras", err);
    });

    return () => {
      stopScanner();
    };
  }, []);

  const startScanner = async () => {
    if (!selectedCameraId) {
      toast.error("No camera found or camera permission denied.");
      return;
    }

    try {
      if (!html5QrCodeRef.current) {
        html5QrCodeRef.current = new Html5Qrcode("reader");
      }

      setIsScanning(true);
      await html5QrCodeRef.current.start(
        selectedCameraId,
        {
          fps: 10,
          qrbox: { width: 250, height: 250 }
        },
        (decodedText) => {
          handleQrScanSuccess(decodedText);
        },
        (errorMessage) => {
          // Ignore scanning parse errors
        }
      );
    } catch (err) {
      setIsScanning(false);
      console.error("Scanner error:", err);
      toast.error("Failed to start camera. Please check permissions.");
    }
  };

  const stopScanner = () => {
    if (html5QrCodeRef.current && isScanning) {
      html5QrCodeRef.current.stop().then(() => {
        setIsScanning(false);
      }).catch(err => {
        console.error("Failed to stop scanner", err);
        setIsScanning(false);
      });
    }
  };

  const processReservation = async (reservation) => {
    if (!reservation) {
      setShowInvalidModal(true);
      return;
    }

    const schedule = await getScheduleById(reservation.scheduleId);
    setValidatedDetails({ reservation, schedule });

    if (schedule && schedule.queueStatus === 'not_started') {
      setShowNotStartedModal(true);
      return;
    }
    
    if (schedule && schedule.queueStatus === 'paused') {
      setShowPausedModal(true);
      return;
    }

    if (schedule && (schedule.queueStatus === 'ended' || schedule.queueStatus === 'completed')) {
      setShowEndedModal(true);
      return;
    }

    if (["completed", "cancelled", "expired", "forfeited", "consultation_completed"].includes(reservation.status)) {
      setShowExpiredModal(true);
    } else if (reservation.status === "in_consultation") {
      setShowInConsultationModal(true);
    } else if (reservation.checkedIn || reservation.status === "checked_in") {
      setShowCheckedInModal(true);
    } else if (!reservation.childName || !reservation.age || !reservation.sex) {
      toast.error("Patient information is incomplete. Parent must complete it first.");
      setShowInvalidModal(true);
    } else {
      // Auto check in directly
      try {
        await checkInReservation(reservation.id, user.uid);
        setValidatedDetails({
          reservation: { ...reservation, status: "checked_in", checkedIn: true },
          schedule
        });
        setShowSuccessModal(true);
        setReservationCode("");
      } catch (error) {
        console.error(error);
        toast.error("Failed to check in reservation.");
      }
    }
  };

  const handleQrScanSuccess = async (decodedText) => {
    stopScanner();
    setIsLoading(true);

    try {
      let payload;
      try {
        payload = JSON.parse(decodedText);
      } catch (e) {
        setIsLoading(false);
        setShowInvalidModal(true);
        return;
      }

      if (!payload.reservationCode) {
        setIsLoading(false);
        setShowInvalidModal(true);
        return;
      }

      const reservation = await validateReservationByCode(payload.reservationCode);
      await processReservation(reservation);

    } catch (error) {
      console.error(error);
      setShowInvalidModal(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleManualValidate = async () => {
    if (!reservationCode || reservationCode.trim().length !== 6) {
      toast.error("Please enter a valid 6-digit reservation code.");
      return;
    }

    setIsLoading(true);

    try {
      const reservation = await validateReservationByCode(reservationCode.toUpperCase().trim());
      await processReservation(reservation);
    } catch (error) {
      console.error("Validation error:", error);
      toast.error("An error occurred during validation.");
    } finally {
      setIsLoading(false);
    }
  };

  // Remove proceedToCheckIn entirely since we auto-check-in now

  const closeAllModals = () => {
    setShowSuccessModal(false);
    setShowFoundModal(false);
    setShowInvalidModal(false);
    setShowExpiredModal(false);
    setShowCheckedInModal(false);
    setShowInConsultationModal(false);
    setShowNotStartedModal(false);
    setShowPausedModal(false);
    setShowEndedModal(false);
    setValidatedDetails(null);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-8 relative">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Validate Reservation</h1>
        <p className="text-gray-500 text-sm mt-1">Scan a patient's QR code or enter their reservation code manually.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* QR Scanner Section */}
        <div className="bg-white rounded-2xl p-6 md:p-8 border border-gray-100 shadow-sm flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mb-4 text-blue-600">
            <QrCode className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Scan QR Code</h2>
          <p className="text-gray-500 text-sm mb-6">Use the device camera to scan the patient's reservation QR code.</p>
          
          {cameras.length > 1 && !isScanning && (
            <div className="w-full mb-4">
              <select 
                value={selectedCameraId}
                onChange={(e) => setSelectedCameraId(e.target.value)}
                className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 text-sm text-gray-700"
              >
                {cameras.map(camera => (
                  <option key={camera.id} value={camera.id}>{camera.label || `Camera ${camera.id.substring(0, 5)}`}</option>
                ))}
              </select>
            </div>
          )}

          <div className="w-full flex-1 relative min-h-[300px] bg-black rounded-xl border-2 border-gray-200 overflow-hidden flex flex-col items-center justify-center mb-6">
            <div id="reader" className="w-full h-full object-cover"></div>
            {!isScanning && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50 text-gray-400">
                <CameraOff className="w-12 h-12 mb-3 opacity-50" />
                <p className="font-medium text-sm">Camera Offline</p>
              </div>
            )}
          </div>

          {!isScanning ? (
            <button 
              onClick={startScanner}
              disabled={isLoading || cameras.length === 0}
              className="w-full py-3 px-4 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
            >
              <PlayCircle className="w-5 h-5" />
              <span>Start Camera</span>
            </button>
          ) : (
            <button 
              onClick={stopScanner}
              className="w-full py-3 px-4 bg-red-50 text-red-600 border border-red-100 rounded-xl font-medium hover:bg-red-100 transition-colors flex items-center justify-center gap-2"
            >
              <StopCircle className="w-5 h-5" />
              <span>Stop Camera</span>
            </button>
          )}
        </div>

        {/* Manual Entry Section */}
        <div className="bg-white rounded-2xl p-6 md:p-8 border border-gray-100 shadow-sm flex flex-col items-center text-center h-fit">
          <div className="w-16 h-16 bg-purple-50 rounded-2xl flex items-center justify-center mb-4 text-purple-600">
            <Type className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Manual Entry</h2>
          <p className="text-gray-500 text-sm mb-6">Enter the reservation code manually if the QR code is unavailable.</p>
          
          <div className="w-full space-y-4">
            <div>
              <input
                type="text"
                placeholder="Enter 6-digit code"
                value={reservationCode}
                onChange={(e) => setReservationCode(e.target.value.toUpperCase())}
                maxLength={6}
                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 text-center font-mono text-lg tracking-widest uppercase"
              />
            </div>
            <button 
              onClick={handleManualValidate}
              disabled={isLoading || reservationCode.trim().length !== 6} 
              className="w-full py-3 px-4 bg-purple-600 text-white rounded-xl font-medium hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm"
            >
              {isLoading && !isScanning ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Search className="w-5 h-5" />
              )}
              <span>Find Reservation</span>
            </button>
          </div>
        </div>
      </div>

      {/* Paused Queue Modal */}
      {showPausedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-200 text-center p-8">
            <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">Queue Paused</h2>
            <p className="text-gray-500 mb-6">The clinic queue is currently paused. Please wait for the doctor to resume the session before validating reservations.</p>
            <button
              onClick={closeAllModals}
              className="w-full py-3 font-bold rounded-xl text-amber-700 bg-amber-50 hover:bg-amber-100 transition-all"
            >
              Acknowledge
            </button>
          </div>
        </div>
      )}

      {/* Ended Queue Modal */}
      {showEndedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-200 text-center p-8">
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <X className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">Queue Closed</h2>
            <p className="text-gray-500 mb-6">Today's clinic session has already ended. Reservations can no longer be validated.</p>
            <button
              onClick={closeAllModals}
              className="w-full py-3 font-bold rounded-xl text-gray-700 bg-gray-100 hover:bg-gray-200 transition-all"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Removed Reservation Found Modal as per auto check-in requirement */}

      {/* Success Modal */}
      {showSuccessModal && validatedDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-200 text-center p-8">
            <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-gray-800 mb-6">Patient Checked In Successfully</h2>
            <div className="text-left space-y-3 mb-6 bg-gray-50 p-4 rounded-xl">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">Child Name</span>
                <span className="font-bold text-gray-800">{validatedDetails.reservation.childName}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">Queue Position</span>
                <span className="font-bold text-gray-800">#{validatedDetails.reservation.queuePosition}</span>
              </div>
            </div>
            <button
              onClick={closeAllModals}
              className="w-full py-3 font-bold rounded-xl text-white bg-blue-600 hover:bg-blue-700 shadow-sm transition-all"
            >
              OK
            </button>
          </div>
        </div>
      )}

      {/* Invalid QR Modal */}
      {showInvalidModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-200 text-center p-8">
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">Invalid QR Code</h2>
            <p className="text-gray-500 mb-6">Unable to find a valid reservation.</p>
            <button
              onClick={closeAllModals}
              className="w-full py-3 font-bold rounded-xl text-gray-700 bg-gray-100 hover:bg-gray-200 transition-all"
            >
              OK
            </button>
          </div>
        </div>
      )}

      {/* Expired QR Modal */}
      {showExpiredModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-200 text-center p-8">
            <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">QR Code No Longer Valid</h2>
            <p className="text-gray-500 mb-6">This reservation can no longer be checked in.</p>
            <button
              onClick={closeAllModals}
              className="w-full py-3 font-bold rounded-xl text-gray-700 bg-gray-100 hover:bg-gray-200 transition-all"
            >
              OK
            </button>
          </div>
        </div>
      )}

      {/* Already Checked In Modal */}
      {showCheckedInModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-200 text-center p-8">
            <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Activity className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">This QR Code has already been used</h2>
            <p className="text-gray-500 mb-6">This reservation has already been checked in.</p>
            <button
              onClick={closeAllModals}
              className="w-full py-3 font-bold rounded-xl text-gray-700 bg-gray-100 hover:bg-gray-200 transition-all"
            >
              OK
            </button>
          </div>
        </div>
      )}

      {/* In Consultation Modal */}
      {showInConsultationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-200 text-center p-8">
            <div className="w-16 h-16 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Activity className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">Patient Currently In Consultation</h2>
            <p className="text-gray-500 mb-6">This patient is already with the doctor.</p>
            <button
              onClick={closeAllModals}
              className="w-full py-3 font-bold rounded-xl text-gray-700 bg-gray-100 hover:bg-gray-200 transition-all"
            >
              OK
            </button>
          </div>
        </div>
      )}

      {/* Queue Not Started Modal */}
      {showNotStartedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-200 text-center p-8">
            <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Clock className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">Clinic Queue Not Started</h2>
            <p className="text-gray-500 mb-6">This clinic queue has not started yet. Please wait until the doctor starts today's clinic queue.</p>
            <button
              onClick={closeAllModals}
              className="w-full py-3 font-bold rounded-xl text-white bg-blue-600 hover:bg-blue-700 shadow-sm transition-all"
            >
              Close
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
