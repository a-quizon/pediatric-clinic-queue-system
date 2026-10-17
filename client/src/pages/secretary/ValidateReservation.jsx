import React, { useState, useEffect, useRef, useCallback } from "react";
import { QrCode, CheckCircle, X, CameraOff, AlertCircle, AlertTriangle, StopCircle, PlayCircle } from "lucide-react";
import toast from "react-hot-toast";
import { Html5Qrcode } from "html5-qrcode";
import { useAuth } from "../../hooks/useAuth";
import { validateReservationByCodeOnServer, checkInReservation } from "../../services/reservationService";
import { getScheduleById } from "../../services/scheduleService";
import { getReservationChildDisplayName, getReservationChildren } from "../../utils/reservationPatients";
import { scheduleMatchesAssignedBranch } from "../../utils/stringUtils";
import {
  MANUAL_CODE_LOCKOUT_TOAST_ID,
  MANUAL_CODE_LOCKOUT_TOAST_MS,
  saveManualCodeLockout,
  loadManualCodeLockout,
  clearManualCodeLockout,
  formatLockCountdown,
} from "../../utils/manualCodeLockoutUi";
import { useHistoryOverlay } from "../../hooks/useHistoryOverlay";
import { useTourSample } from "../../hooks/useTourPreview";
import { TourSampleValidate } from "../../components/onboarding/SecretaryTourSampleViews";
import ModalScrim from "../../components/common/ModalScrim";

const CODE_LENGTH = 6;

function ValidateResultModal({
  open,
  icon: Icon,
  title,
  children,
  actionLabel,
  onClose,
  actionClass = "pq-btn-primary",
  iconTone = "info",
}) {
  useHistoryOverlay(open, onClose);
  if (!open) return null;

  const iconStyle =
    iconTone === "alert"
      ? { background: "var(--pq-alert-wash)", color: "var(--pq-alert)" }
      : iconTone === "wait"
        ? { background: "var(--pq-wait-wash)", color: "var(--pq-wait)" }
        : iconTone === "live"
          ? { background: "var(--pq-live-wash)", color: "var(--pq-live)" }
          : { background: "color-mix(in srgb, var(--pq-mark-blue) 12%, white)", color: "var(--pq-mark-blue)" };

  return (
    <ModalScrim className="z-50" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="pq-modal pq-modal--sm text-center" role="dialog" aria-modal="true" aria-labelledby="validate-result-title">
        <div className="pq-modal-body pq-scroll-y p-8 pb-4">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={iconStyle}>
            <Icon className="w-8 h-8" aria-hidden="true" />
          </div>
          <h2 id="validate-result-title" className="text-xl font-extrabold tracking-tight mb-2">{title}</h2>
          <div className="pq-muted">{children}</div>
        </div>
        <div className="pq-modal-footer px-8 pb-8">
          <button type="button" onClick={onClose} className={`${actionClass} w-full`}>
            {actionLabel}
          </button>
        </div>
      </div>
    </ModalScrim>
  );
}

export default function ValidateReservation() {
  const { user } = useAuth();
  const showSampleValidate = useTourSample("validate-qr");
  const [reservationCode, setReservationCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [lockedUntil, setLockedUntil] = useState(null);
  const [lockCountdown, setLockCountdown] = useState("");

  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showInvalidModal, setShowInvalidModal] = useState(false);
  const [showExpiredModal, setShowExpiredModal] = useState(false);
  const [showCheckedInModal, setShowCheckedInModal] = useState(false);
  const [showInConsultationModal, setShowInConsultationModal] = useState(false);
  const [showNotStartedModal, setShowNotStartedModal] = useState(false);
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
  const isManualLocked = lockedUntil != null && lockedUntil > Date.now();

  const anyModalOpen =
    showSuccessModal ||
    showInvalidModal ||
    showExpiredModal ||
    showCheckedInModal ||
    showInConsultationModal ||
    showNotStartedModal ||
    showEndedModal ||
    showWaitingForWindowModal;

  useEffect(() => {
    isLoadingRef.current = isLoading;
  }, [isLoading]);

  useEffect(() => {
    isScanningRef.current = isScanning;
  }, [isScanning]);

  // Restore lock UI from sessionStorage after refresh (server still enforces).
  useEffect(() => {
    if (!user?.uid) return;
    const saved = loadManualCodeLockout(user.uid);
    if (saved?.lockedUntil) {
      setLockedUntil(saved.lockedUntil);
    }
  }, [user?.uid]);

  useEffect(() => {
    if (!lockedUntil) {
      setLockCountdown("");
      return undefined;
    }
    const tick = () => {
      const now = Date.now();
      if (lockedUntil <= now) {
        setLockedUntil(null);
        setLockCountdown("");
        if (user?.uid) clearManualCodeLockout(user.uid);
        return;
      }
      setLockCountdown(formatLockCountdown(lockedUntil, now));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [lockedUntil, user?.uid]);

  const applyManualCodeLockout = useCallback(
    (error) => {
      const until = Number(error?.lockedUntil) || 0;
      const message =
        error?.message ||
        "Manual reservation-code entry locked after repeated failures.";
      if (until > Date.now()) {
        setLockedUntil(until);
        if (user?.uid) {
          saveManualCodeLockout(user.uid, { lockedUntil: until, message });
        }
      }
      toast.error(message, {
        id: MANUAL_CODE_LOCKOUT_TOAST_ID,
        duration: MANUAL_CODE_LOCKOUT_TOAST_MS,
      });
    },
    [user?.uid]
  );

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

    if (schedule && (schedule.queueStatus === "ended" || schedule.queueStatus === "completed")) {
      setShowEndedModal(true);
      return;
    }

    if (["completed", "consultation_completed", "cancelled", "cancelled_by_clinic", "forfeited", "expired", "validation_expired", "penalized", "late_limit_reached"].includes(reservation.status)) {
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

      const reservation = await validateReservationByCodeOnServer(payload.reservationCode, {
        source: "qr",
      });
      await processRef.current?.(reservation);
    } catch (error) {
      console.error(error);
      if (error?.code === "resource-exhausted") {
        applyManualCodeLockout(error);
      }
      setShowInvalidModal(true);
    } finally {
      setIsLoading(false);
    }
  }, [stopScanner, applyManualCodeLockout]);

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
    if (showSampleValidate) return undefined;

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
  }, [showSampleValidate]);

  // Auto-start once camera id is ready
  useEffect(() => {
    if (showSampleValidate) return;
    if (!selectedCameraId || autoStartedRef.current || anyModalOpen) return;
    autoStartedRef.current = true;
    startScanner(selectedCameraId);
  }, [selectedCameraId, startScanner, anyModalOpen, showSampleValidate]);

  const handleManualValidate = useCallback(async (code) => {
    const trimmed = (code || "").toUpperCase().trim();
    if (trimmed.length !== CODE_LENGTH || isLoadingRef.current) return;

    if (lockedUntil && lockedUntil > Date.now()) {
      applyManualCodeLockout({
        lockedUntil,
        message:
          loadManualCodeLockout(user?.uid)?.message ||
          "Manual reservation-code entry locked after repeated failures.",
      });
      setReservationCode("");
      return;
    }

    setIsLoading(true);
    try {
      const reservation = await validateReservationByCodeOnServer(trimmed, { source: "manual" });
      await processRef.current?.(reservation);
    } catch (error) {
      console.error("Validation error:", error);
      if (error?.code === "resource-exhausted") {
        applyManualCodeLockout(error);
      } else {
        toast.error(error?.message || "An error occurred during validation.");
      }
    } finally {
      setIsLoading(false);
      setReservationCode("");
    }
  }, [lockedUntil, applyManualCodeLockout, user?.uid]);

  // Auto-submit when code reaches expected length
  useEffect(() => {
    if (
      reservationCode.trim().length === CODE_LENGTH &&
      !isLoading &&
      !anyModalOpen &&
      !isManualLocked
    ) {
      handleManualValidate(reservationCode);
    }
  }, [reservationCode, isLoading, anyModalOpen, isManualLocked, handleManualValidate]);

  const closeAllModals = async () => {
    setShowSuccessModal(false);
    setShowInvalidModal(false);
    setShowExpiredModal(false);
    setShowCheckedInModal(false);
    setShowInConsultationModal(false);
    setShowNotStartedModal(false);
    setShowEndedModal(false);
    setShowWaitingForWindowModal(false);
    setValidatedDetails(null);
    setReservationCode("");

    // Resume continuous scanning after modal dismiss
    if (selectedCameraId && !isScanningRef.current) {
      await startScanner(selectedCameraId);
    }
  };
  useHistoryOverlay(showSuccessModal, closeAllModals);

  if (showSampleValidate) {
    return <TourSampleValidate />;
  }

  return (
    <div className="space-y-6 max-w-lg mx-auto pb-8 relative">
      <section className="pq-glass p-5 md:p-6 flex flex-col items-center text-center">
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3"
          style={{ background: "color-mix(in srgb, var(--pq-mark-blue) 12%, white)", color: "var(--pq-mark-blue)" }}
        >
          <QrCode className="w-7 h-7" aria-hidden="true" />
        </div>
        <h2 className="text-xl font-extrabold tracking-tight mb-1">Scan to Check In</h2>
        <p className="pq-muted text-sm mb-4">
          Point the camera at the patient&apos;s QR code, or type the code below.
        </p>

        {cameras.length > 1 && (
          <div className="w-full mb-3">
            <label htmlFor="camera-select" className="sr-only">Camera</label>
            <select
              id="camera-select"
              value={selectedCameraId}
              onChange={async (e) => {
                const nextId = e.target.value;
                await stopScanner();
                setSelectedCameraId(nextId);
                await startScanner(nextId);
              }}
              className="pq-input"
            >
              {cameras.map((camera) => (
                <option key={camera.id} value={camera.id}>
                  {camera.label || `Camera ${camera.id.substring(0, 5)}`}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="w-full relative min-h-[280px] overflow-hidden flex flex-col items-center justify-center mb-4" style={{ background: "var(--pq-ink)", borderRadius: "var(--pq-radius-sm)", border: "1px solid var(--pq-glass-line)" }}>
          <div id="reader" className="w-full h-full object-cover" />
          {!isScanning && (
            <div className="absolute inset-0 flex flex-col items-center justify-center px-4" style={{ background: "color-mix(in srgb, #ffffff 88%, var(--pq-paper))", color: "var(--pq-ink-faint)" }}>
              <CameraOff className="w-12 h-12 mb-3 opacity-50" aria-hidden="true" />
              <p className="font-medium text-sm text-center">
                {cameraError || (isLoading ? "Processingâ€¦" : "Starting cameraâ€¦")}
              </p>
            </div>
          )}
          {isLoading && isScanning && (
            <div className="absolute inset-0 flex items-center justify-center" style={{ background: "color-mix(in srgb, var(--pq-ink) 40%, transparent)" }}>
              <span className="pq-spinner" style={{ borderColor: "rgba(255,255,255,0.35)", borderTopColor: "#fff" }} aria-hidden="true" />
            </div>
          )}
        </div>

        {isScanning ? (
          <button type="button" onClick={stopScanner} className="pq-btn-danger w-full">
            <StopCircle className="w-5 h-5" aria-hidden="true" />
            <span>Stop Camera</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => startScanner(selectedCameraId)}
            disabled={isLoading || !selectedCameraId}
            className="pq-btn-primary w-full"
          >
            <PlayCircle className="w-5 h-5" aria-hidden="true" />
            <span>Start Camera</span>
          </button>
        )}

        <div className="w-full mt-6 pt-5 text-left" style={{ borderTop: "1px solid var(--pq-glass-line)" }}>
          <label htmlFor="reservationCode" className="pq-label">
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
              disabled={isLoading || isManualLocked}
              aria-disabled={isManualLocked}
              className="pq-input text-center font-mono text-xl tracking-[0.35em] uppercase"
            />
            {isLoading && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <span className="pq-spinner" style={{ width: 20, height: 20, borderWidth: 2 }} aria-hidden="true" />
              </div>
            )}
          </div>
          {isManualLocked && lockCountdown ? (
            <p className="mt-2 text-xs text-center font-medium" style={{ color: "var(--pq-alert)" }} role="status">
              Try again in {lockCountdown}
            </p>
          ) : (
            <p className="mt-2 text-xs pq-faint text-center">
              Validates automatically when all {CODE_LENGTH} characters are entered
            </p>
          )}
        </div>
      </section>

      <ValidateResultModal
        open={showEndedModal}
        icon={X}
        iconTone="alert"
        title="Queue Closed"
        actionLabel="Close"
        actionClass="pq-btn-secondary"
        onClose={closeAllModals}
      >
        Today&apos;s clinic session has already ended. Reservations can no longer be validated.
      </ValidateResultModal>

      {showSuccessModal && validatedDetails && (
        <ModalScrim className="z-50" onClick={(e) => e.target === e.currentTarget && closeAllModals()}>
          <div className="pq-modal pq-modal--sm text-center" role="dialog" aria-modal="true" aria-labelledby="checkin-success-title">
            <div className="pq-modal-body pq-scroll-y p-8 pb-4">
              <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: "var(--pq-live-wash)", color: "var(--pq-live)" }}>
                <CheckCircle className="w-8 h-8" aria-hidden="true" />
              </div>
              <h2 id="checkin-success-title" className="text-xl font-extrabold tracking-tight mb-6">Patient Checked In Successfully</h2>
              <div className="text-left space-y-3 pq-row block min-h-0">
                <div className="flex justify-between items-center">
                  <span className="text-sm pq-muted">Child Name</span>
                  <span className="font-extrabold">
                    {getReservationChildDisplayName(validatedDetails.reservation)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm pq-muted">Queue Number</span>
                  <span className="font-extrabold pq-num">
                    #{validatedDetails.reservation.queuePosition ?? validatedDetails.reservation.queueNumber}
                  </span>
                </div>
              </div>
            </div>
            <div className="pq-modal-footer px-8 pb-8">
              <button type="button" onClick={closeAllModals} className="pq-btn-primary w-full">
                OK
              </button>
            </div>
          </div>
        </ModalScrim>
      )}

      <ValidateResultModal
        open={showInvalidModal}
        icon={AlertTriangle}
        iconTone="alert"
        title="Invalid Code"
        actionLabel="OK"
        actionClass="pq-btn-secondary"
        onClose={closeAllModals}
      >
        Unable to find a valid reservation.
      </ValidateResultModal>

      <ValidateResultModal
        open={showExpiredModal}
        icon={AlertCircle}
        iconTone="alert"
        title="Validation Window Expired"
        actionLabel="OK"
        actionClass="pq-btn-danger"
        onClose={closeAllModals}
      >
        This reservation expired because check-in did not occur within the allowed validation window.
      </ValidateResultModal>

      <ValidateResultModal
        open={showCheckedInModal}
        icon={CheckCircle}
        iconTone="info"
        title="Already Checked In"
        actionLabel="OK"
        actionClass="pq-btn-secondary"
        onClose={closeAllModals}
      >
        This reservation has already been checked in.
      </ValidateResultModal>

      <ValidateResultModal
        open={showInConsultationModal}
        icon={AlertCircle}
        iconTone="info"
        title="Patient Currently In Consultation"
        actionLabel="OK"
        actionClass="pq-btn-secondary"
        onClose={closeAllModals}
      >
        This patient is already with the doctor.
      </ValidateResultModal>

      <ValidateResultModal
        open={showNotStartedModal}
        icon={AlertCircle}
        iconTone="wait"
        title="Clinic Queue Not Started"
        actionLabel="Close"
        onClose={closeAllModals}
      >
        This clinic queue has not started yet. Start today&apos;s queue from Schedules before validating reservations.
      </ValidateResultModal>

      <ValidateResultModal
        open={showWaitingForWindowModal}
        icon={AlertCircle}
        iconTone="wait"
        title="Validation Window Not Open Yet"
        actionLabel="Close"
        actionClass="pq-btn-warn"
        onClose={closeAllModals}
      >
        This patient is still waiting for their validation window to open. They should wait until their turn approaches before checking in.
      </ValidateResultModal>
    </div>
  );
}
