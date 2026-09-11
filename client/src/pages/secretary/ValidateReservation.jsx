import React, { useState, useEffect, useRef, useCallback } from "react";
import { QrCode, CheckCircle, X, CameraOff, AlertCircle, AlertTriangle, StopCircle, PlayCircle } from "lucide-react";
import toast from "react-hot-toast";
import { Html5Qrcode } from "html5-qrcode";
import { useAuth } from "../../hooks/useAuth";
import { validateReservationByCode, checkInReservation } from "../../services/reservationService";
import { getScheduleById } from "../../services/scheduleService";
import { getReservationChildDisplayName, getReservationChildren } from "../../utils/reservationPatients";
import { scheduleMatchesAssignedBranch } from "../../utils/stringUtils";

const CODE_LENGTH = 6;

export default function ValidateReservation() {
  const { user } = useAuth();
  const [reservationCode, setReservationCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showInvalidModal, setShowInvalidModal] = useState(false);
  const [showExpiredModal, setShowExpiredModal] = useState(false);
  const [showCheckedInModal, setShowCheckedInModal] = useState(false);
  const [showInConsultationModal, setShowInConsultationModal] = useState(false);
  const [showNotStartedModal, setShowNotStartedModal] = useState(false);
  const [showPausedModal, setShowPausedModal] = useState(false);
  const [showEndedModal, setShowEndedModal] = useState(false);
  const [showWaitingForWindowModal, setShowWaitingForWindowModal] = useState(false);

  const [validatedDetails, setValidatedDetails] = useState(null);

  const [isScanning, setIsScanning] = useState(false);
  const [cameras, setCameras] = useState([]);
  const [selectedCameraId, setSelectedCameraId] = useState("");
  const [cameraError, setCameraError] = useState(null);
  const html5QrCodeRef = useRef(null);
  const isScanningRef = useRef(false);
  const isLoadingRef = useRef(false);
  const processRef = useRef(null);
  const autoStartedRef = useRef(false);

  const anyModalOpen =
    showSuccessModal ||
    showInvalidModal ||
    showExpiredModal ||
    showCheckedInModal ||
    showInConsultationModal ||
    showNotStartedModal ||
    showPausedModal ||
    showEndedModal ||
    showWaitingForWindowModal;

  useEffect(() => {
    isLoadingRef.current = isLoading;
  }, [isLoading]);

  useEffect(() => {
    isScanningRef.current = isScanning;
  }, [isScanning]);

  const stopScanner = useCallback(async () => {
    if (html5QrCodeRef.current && isScanningRef.current) {
      try {
        await html5QrCodeRef.current.stop();
      } catch (err) {
        console.error("Failed to stop scanner", err);
      }
      setIsScanning(false);
      isScanningRef.current = false;
    }
  }, []);

  const processReservation = useCallback(async (reservation) => {
    if (!reservation) {
      setShowInvalidModal(true);
      return;
    }

    const schedule = await getScheduleById(reservation.scheduleId);

    if (schedule && user.assignedBranch && !scheduleMatchesAssignedBranch(schedule, user)) {
      toast.error(`This reservation belongs to a different branch (${schedule.branch}).`);
      setShowInvalidModal(true);
      return;
    }

    setValidatedDetails({ reservation, schedule });

    if (schedule && schedule.queueStatus === "not_started") {
      setShowNotStartedModal(true);
      return;
    }

    if (schedule && schedule.queueStatus === "paused") {
      setShowPausedModal(true);
      return;
    }

    if (schedule && (schedule.queueStatus === "ended" || schedule.queueStatus === "completed")) {
      setShowEndedModal(true);
      return;
    }

    if (["completed", "consultation_completed", "cancelled", "penalized", "late_limit_reached"].includes(reservation.status)) {
      setShowExpiredModal(true);
    } else if (reservation.status === "in_consultation" || reservation.status === "with_doctor") {
      setShowInConsultationModal(true);
    } else if (reservation.checkedIn || reservation.status === "checked_in") {
      setShowCheckedInModal(true);
    } else if (getReservationChildren(reservation).length === 0) {
      toast.error("Patient information is incomplete. Parent must complete it first.");
      setShowInvalidModal(true);
    } else {
      try {
        await checkInReservation(reservation.id, user.uid);
        setValidatedDetails({
          reservation: { ...reservation, status: "checked_in", checkedIn: true },
          schedule,
        });
        setShowSuccessModal(true);
        setReservationCode("");
      } catch (error) {
        console.error(error);
        toast.error("Failed to check in reservation.");
      }
    }
  }, [user]);

  processRef.current = processReservation;

  const handleQrScanSuccess = useCallback(async (decodedText) => {
    if (isLoadingRef.current) return;
    await stopScanner();
    setIsLoading(true);

    try {
      let payload;
      try {
        payload = JSON.parse(decodedText);
      } catch (e) {
        setShowInvalidModal(true);
        return;
      }

      if (!payload.reservationCode) {
        setShowInvalidModal(true);
        return;
      }

      const reservation = await validateReservationByCode(payload.reservationCode);
      await processRef.current?.(reservation);
    } catch (error) {
      console.error(error);
      setShowInvalidModal(true);
    } finally {
      setIsLoading(false);
    }
  }, [stopScanner]);

  const startScanner = useCallback(async (cameraId = selectedCameraId) => {
    if (!cameraId) {
      setCameraError("No camera found or camera permission denied.");
      return;
    }
    if (isScanningRef.current) return;

    try {
      setCameraError(null);
      if (!html5QrCodeRef.current) {
        html5QrCodeRef.current = new Html5Qrcode("reader");
      }

      await html5QrCodeRef.current.start(
        cameraId,
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        (decodedText) => {
          handleQrScanSuccess(decodedText);
        },
        () => {}
      );
      setIsScanning(true);
      isScanningRef.current = true;
    } catch (err) {
      setIsScanning(false);
      isScanningRef.current = false;
      console.error("Scanner error:", err);
      setCameraError("Failed to start camera. Please check permissions.");
      toast.error("Failed to start camera. Please check permissions.");
    }
  }, [selectedCameraId, handleQrScanSuccess]);

  // Request cameras and auto-start on open
  useEffect(() => {
    let cancelled = false;
    Html5Qrcode.getCameras()
      .then((devices) => {
        if (cancelled) return;
        if (devices && devices.length) {
          setCameras(devices);
          const backCamera = devices.find(
            (d) =>
              d.label.toLowerCase().includes("back") ||
              d.label.toLowerCase().includes("environment")
          );
          setSelectedCameraId(backCamera ? backCamera.id : devices[0].id);
        } else {
          setCameraError("No camera found on this device.");
        }
      })
      .catch((err) => {
        console.warn("Error getting cameras", err);
        if (!cancelled) {
          setCameraError("Camera permission denied or unavailable.");
          toast.error("Unable to access camera. You can still enter a code manually.");
        }
      });

    return () => {
      cancelled = true;
      if (html5QrCodeRef.current && isScanningRef.current) {
        html5QrCodeRef.current.stop().catch(() => {});
      }
    };
  }, []);

  // Auto-start once camera id is ready
  useEffect(() => {
    if (!selectedCameraId || autoStartedRef.current || anyModalOpen) return;
    autoStartedRef.current = true;
    startScanner(selectedCameraId);
  }, [selectedCameraId, startScanner, anyModalOpen]);

  const handleManualValidate = useCallback(async (code) => {
    const trimmed = (code || "").toUpperCase().trim();
    if (trimmed.length !== CODE_LENGTH || isLoadingRef.current) return;

    setIsLoading(true);
    try {
      const reservation = await validateReservationByCode(trimmed);
      await processRef.current?.(reservation);
    } catch (error) {
      console.error("Validation error:", error);
      toast.error("An error occurred during validation.");
    } finally {
      setIsLoading(false);
      setReservationCode("");
    }
  }, []);

  // Auto-submit when code reaches expected length
  useEffect(() => {
    if (reservationCode.trim().length === CODE_LENGTH && !isLoading && !anyModalOpen) {
      handleManualValidate(reservationCode);
    }
  }, [reservationCode, isLoading, anyModalOpen, handleManualValidate]);

  const closeAllModals = async () => {
    setShowSuccessModal(false);
    setShowInvalidModal(false);
    setShowExpiredModal(false);
    setShowCheckedInModal(false);
    setShowInConsultationModal(false);
    setShowNotStartedModal(false);
    setShowPausedModal(false);
    setShowEndedModal(false);
    setShowWaitingForWindowModal(false);
    setValidatedDetails(null);
    setReservationCode("");

    // Resume continuous scanning after modal dismiss
    if (selectedCameraId && !isScanningRef.current) {
      await startScanner(selectedCameraId);
    }
  };

  return (
    <div className="space-y-6 max-w-lg mx-auto pb-8 relative">
      <div className="bg-white rounded-2xl p-5 md:p-6 border border-gray-100 shadow-sm flex flex-col items-center text-center">
        <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center mb-3 text-blue-600">
          <QrCode className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-bold text-gray-800 mb-1">Scan to Check In</h2>
        <p className="text-gray-500 text-sm mb-4">
          Point the camera at the patient&apos;s QR code, or type the code below.
        </p>

        {cameras.length > 1 && (
          <div className="w-full mb-3">
            <select
              value={selectedCameraId}
              onChange={async (e) => {
                const nextId = e.target.value;
                await stopScanner();
                setSelectedCameraId(nextId);
                await startScanner(nextId);
              }}
              className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 text-sm text-gray-700"
            >
              {cameras.map((camera) => (
                <option key={camera.id} value={camera.id}>
                  {camera.label || `Camera ${camera.id.substring(0, 5)}`}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="w-full relative min-h-[280px] bg-black rounded-xl border-2 border-gray-200 overflow-hidden flex flex-col items-center justify-center mb-4">
          <div id="reader" className="w-full h-full object-cover" />
          {!isScanning && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50 text-gray-400 px-4">
              <CameraOff className="w-12 h-12 mb-3 opacity-50" />
              <p className="font-medium text-sm text-center">
                {cameraError || (isLoading ? "Processing…" : "Starting camera…")}
              </p>
            </div>
          )}
          {isLoading && isScanning && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
              <div className="w-10 h-10 border-3 border-white border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>

        {isScanning ? (
          <button
            onClick={stopScanner}
            className="w-full py-3 px-4 bg-red-50 text-red-600 border border-red-100 rounded-xl font-medium hover:bg-red-100 transition-colors flex items-center justify-center gap-2"
          >
            <StopCircle className="w-5 h-5" />
            <span>Stop Camera</span>
          </button>
        ) : (
          <button
            onClick={() => startScanner(selectedCameraId)}
            disabled={isLoading || !selectedCameraId}
            className="w-full py-3 px-4 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
          >
            <PlayCircle className="w-5 h-5" />
            <span>Start Camera</span>
          </button>
        )}

        {/* Manual entry — auto-submits at CODE_LENGTH */}
        <div className="w-full mt-6 pt-5 border-t border-gray-100 text-left">
          <label htmlFor="reservationCode" className="block text-sm font-semibold text-gray-700 mb-2">
            Or enter code manually
          </label>
          <div className="relative">
            <input
              id="reservationCode"
              type="text"
              inputMode="text"
              autoComplete="off"
              placeholder={`${CODE_LENGTH}-character code`}
              value={reservationCode}
              onChange={(e) =>
                setReservationCode(
                  e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, CODE_LENGTH)
                )
              }
              maxLength={CODE_LENGTH}
              disabled={isLoading}
              className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-center font-mono text-xl tracking-[0.35em] uppercase disabled:opacity-60"
            />
            {isLoading && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>
          <p className="mt-2 text-xs text-gray-400 text-center">
            Validates automatically when all {CODE_LENGTH} characters are entered
          </p>
        </div>
      </div>

      {showPausedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-200 text-center p-8">
            <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">Queue Paused</h2>
            <p className="text-gray-500 mb-6">
              The clinic queue is currently paused. Please wait for the doctor to resume the session before validating reservations.
            </p>
            <button
              onClick={closeAllModals}
              className="w-full py-3 font-bold rounded-xl text-amber-700 bg-amber-50 hover:bg-amber-100 transition-all"
            >
              Acknowledge
            </button>
          </div>
        </div>
      )}

      {showEndedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-200 text-center p-8">
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <X className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">Queue Closed</h2>
            <p className="text-gray-500 mb-6">Today&apos;s clinic session has already ended. Reservations can no longer be validated.</p>
            <button
              onClick={closeAllModals}
              className="w-full py-3 font-bold rounded-xl text-gray-700 bg-gray-100 hover:bg-gray-200 transition-all"
            >
              Close
            </button>
          </div>
        </div>
      )}

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
                <span className="font-bold text-gray-800">
                  {getReservationChildDisplayName(validatedDetails.reservation)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">Queue Number</span>
                <span className="font-bold text-gray-800">
                  #{validatedDetails.reservation.queuePosition ?? validatedDetails.reservation.queueNumber}
                </span>
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

      {showInvalidModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-200 text-center p-8">
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">Invalid Code</h2>
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

      {showExpiredModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-200 text-center p-8">
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-200">
              <AlertCircle className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-black text-gray-800 mb-2">Validation Window Expired</h2>
            <p className="text-sm text-gray-500 mb-6 font-medium">
              This reservation expired because check-in did not occur within the allowed validation window.
            </p>
            <button
              onClick={closeAllModals}
              className="w-full py-3 font-bold rounded-xl text-white bg-red-600 hover:bg-red-700 transition-all shadow-sm"
            >
              OK
            </button>
          </div>
        </div>
      )}

      {showCheckedInModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-200 text-center p-8">
            <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">Already Checked In</h2>
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

      {showInConsultationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-200 text-center p-8">
            <div className="w-16 h-16 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8" />
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

      {showNotStartedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-200 text-center p-8">
            <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">Clinic Queue Not Started</h2>
            <p className="text-gray-500 mb-6">
              This clinic queue has not started yet. Start today&apos;s queue from Schedules before validating reservations.
            </p>
            <button
              onClick={closeAllModals}
              className="w-full py-3 font-bold rounded-xl text-white bg-blue-600 hover:bg-blue-700 shadow-sm transition-all"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {showWaitingForWindowModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-200 text-center p-8">
            <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">Validation Window Not Open Yet</h2>
            <p className="text-gray-500 mb-6">
              This patient is still waiting for their validation window to open. They should wait until their turn approaches before checking in.
            </p>
            <button
              onClick={closeAllModals}
              className="w-full py-3 font-bold rounded-xl text-white bg-amber-600 hover:bg-amber-700 shadow-sm transition-all"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
