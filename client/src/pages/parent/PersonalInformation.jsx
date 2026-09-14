import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "../../hooks/useAuth";
import { formatName } from "../../utils/stringUtils";
import { updateUserProfile, deactivateOwnAccount, softDeleteOwnAccount } from "../../services/authService";
import { sendSmsOtp, verifySmsOtp, consumePhoneVerification } from "../../services/smsAuthService";
import { User, Mail, Phone, Save, Lock, Shield, Key, Eye, EyeOff, KeyRound, CheckCircle2 } from "lucide-react";
import { handlePasswordChangeRequest, usePasswordValidation } from "../../utils/passwordUtils";
import { formatToE164, parseToLocal } from "../../utils/phoneUtils";
import { formatOtpCountdown, startOtpAutofill } from "../../utils/loginIdentifier";
import { useNavigate } from "react-router-dom";
import InformationModal from "../../components/common/InformationModal";
import ConfirmationModal from "../../components/common/ConfirmationModal";
import DeleteAccountModal from "../../components/common/DeleteAccountModal";
import { mapAuthError } from "../../utils/authErrors";
import toast from "react-hot-toast";

const RESEND_COOLDOWN_SEC = 90;

export default function PersonalInformation() {
  const { user, updateContextUser } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [originalPhoneLocal, setOriginalPhoneLocal] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [verificationId, setVerificationId] = useState("");
  const [cooldownLeft, setCooldownLeft] = useState(0);
  const [otpBusy, setOtpBusy] = useState(false);
  const otpInputRef = useRef(null);

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [successModalOpen, setSuccessModalOpen] = useState(false);

  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccessModalOpen, setPasswordSuccessModalOpen] = useState(false);

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const { isValid: isPasswordValid, errors: passwordErrors, isChecking } = usePasswordValidation(newPassword);

  const passwordInvalid = newPassword.length > 0 && !isPasswordValid;
  const confirmInvalid = confirmPassword.length > 0 && newPassword !== confirmPassword;
  const isPasswordFormValid = currentPassword.length > 0 && isPasswordValid && newPassword === confirmPassword && !isChecking;

  const [deactivateOpen, setDeactivateOpen] = useState(false);
  const [isDeactivating, setIsDeactivating] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const phoneChanged = phone.length === 10 && phone !== originalPhoneLocal;
  const hydratedUidRef = useRef(null);

  useEffect(() => {
    if (!user?.uid) {
      hydratedUidRef.current = null;
      return;
    }
    // Only hydrate profile fields once per signed-in user — AuthContext
    // recreates `user` on every RTDB onValue and must not wipe OTP/cooldown.
    if (hydratedUidRef.current === user.uid) return;
    hydratedUidRef.current = user.uid;

    setName(user.fullName || user.displayName || user.name || "");
    const local = parseToLocal(user.phoneNumber || user.phone || "");
    setPhone(local);
    setOriginalPhoneLocal(local);
    setOtp("");
    setOtpSent(false);
    setPhoneVerified(false);
    setVerificationId("");
    setCooldownLeft(0);
  }, [user]);

  useEffect(() => {
    if (cooldownLeft <= 0) return undefined;
    const id = setInterval(() => {
      setCooldownLeft((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [cooldownLeft]);

  useEffect(() => {
    if (!otpSent || phoneVerified || !phoneChanged) return undefined;
    return startOtpAutofill((code) => setOtp(code));
  }, [otpSent, phoneVerified, phoneChanged]);

  const resetPhoneVerification = () => {
    setOtp("");
    setOtpSent(false);
    setPhoneVerified(false);
    setVerificationId("");
  };

  const validate = () => {
    if (!name.trim()) {
      setError("Full Name is required.");
      return false;
    }

    if (!phone.trim() || phone.length !== 10) {
      setError("Phone number must be exactly 10 digits.");
      return false;
    }

    if (phoneChanged && (!phoneVerified || !verificationId)) {
      setError("Please verify your new phone number before saving.");
      return false;
    }

    setError("");
    return true;
  };

  const handleSendCode = async () => {
    if (phone.length !== 10) {
      setError("Enter a valid 10-digit mobile number first.");
      return;
    }
    if (!phoneChanged) {
      setError("Enter a new phone number to verify.");
      return;
    }
    if (cooldownLeft > 0) return;

    setOtpBusy(true);
    setError("");
    try {
      await sendSmsOtp(phone, "update");
      setOtpSent(true);
      setPhoneVerified(false);
      setVerificationId("");
      setOtp("");
      setCooldownLeft(RESEND_COOLDOWN_SEC);
      toast.success("Verification code sent via SMS.");
      setTimeout(() => otpInputRef.current?.focus(), 50);
    } catch (err) {
      const message =
        err.code === "rate_limited" && err.message
          ? err.message
          : err.message || "Failed to send OTP, please try again.";
      setError(message);
      toast.error(message);
      if (err.retryAfterSeconds) setCooldownLeft(err.retryAfterSeconds);
    } finally {
      setOtpBusy(false);
    }
  };

  const handleVerifyCode = async () => {
    if (otp.length !== 6) {
      setError("Enter the 6-digit verification code.");
      return;
    }
    setOtpBusy(true);
    setError("");
    try {
      const result = await verifySmsOtp(phone, otp, "update");
      setPhoneVerified(true);
      setVerificationId(result.verificationId || "");
      toast.success("Phone number verified.");
    } catch (err) {
      setError(err.message || "Verification failed.");
    } finally {
      setOtpBusy(false);
    }
  };

  const handleOtpAction = async () => {
    if (!otpSent || phoneVerified) {
      await handleSendCode();
      return;
    }
    await handleVerifyCode();
  };

  const handleSave = async () => {
    if (!validate()) return;

    setIsSaving(true);
    try {
      const formattedPhone = formatToE164(phone.trim());
      const profileUpdates = { name: formatName(name) };

      if (phoneChanged) {
        await consumePhoneVerification(formattedPhone, verificationId, "update");
        profileUpdates.phone = formattedPhone;
        profileUpdates.isPhoneVerified = true;
      } else if (phone !== originalPhoneLocal) {
        // Should not happen due to gate, but keep phone unchanged if unverified
      }

      await updateUserProfile(user.uid, profileUpdates);
      updateContextUser({
        name: formatName(name),
        fullName: formatName(name),
        displayName: formatName(name),
        ...(phoneChanged
          ? {
              phone: formattedPhone,
              phoneNumber: formattedPhone,
              isPhoneVerified: true,
            }
          : {}),
      });
      if (phoneChanged) {
        setOriginalPhoneLocal(phone);
        resetPhoneVerification();
        setCooldownLeft(0);
      }
      setSuccessModalOpen(true);
    } catch (err) {
      console.error("Failed to update profile:", err);
      setError(err.message || "Failed to update profile. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handlePasswordSave = async () => {
    setIsChangingPassword(true);
    setPasswordError("");

    try {
      const result = await handlePasswordChangeRequest(currentPassword, newPassword, confirmPassword);

      if (result.success) {
        setPasswordModalOpen(false);
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setPasswordError("");
        setTimeout(() => setPasswordSuccessModalOpen(true), 150);
      } else {
        setPasswordError(result.error);
      }
    } catch (err) {
      console.error(err);
      setPasswordError("An unexpected error occurred. Please try again.");
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleDeactivate = async () => {
    setIsDeactivating(true);
    try {
      await deactivateOwnAccount(user);
      navigate("/", { replace: true });
    } catch (err) {
      console.error(err);
      toast.error("Failed to deactivate account. Please try again.");
      setIsDeactivating(false);
    }
  };

  const handleDelete = async (password) => {
    setIsDeleting(true);
    setDeleteError("");
    try {
      await softDeleteOwnAccount(password, user);
      navigate("/", { replace: true });
    } catch (err) {
      console.error(err);
      setDeleteError(err.code ? mapAuthError(err.code) : "Failed to delete account. Please try again.");
      setIsDeleting(false);
    }
  };

  const otpButtonLabel = () => {
    if (otpBusy) return "Please wait...";
    if (phoneVerified) return "Verified";
    if (!otpSent) return "Send Code";
    return "Verify";
  };

  return (
    <div className="space-y-6 pb-8 max-w-2xl mx-auto mt-2">
      <div className="pq-glass p-6 sm:p-8">

        {error && (
          <div className="pq-note pq-note-alert mb-6">
            {error}
          </div>
        )}

        <div className="space-y-6">
          <div>
            <label className="pq-label">Full Name</label>
            <div className="relative">
              <div className="pq-field-icon">
                <User className="h-5 w-5" />
              </div>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="pq-input pl-11"
                placeholder="Enter your full name"
              />
            </div>
          </div>

          <div>
            <label className="pq-label">Email Address</label>
            <div className="relative">
              <div className="pq-field-icon">
                <Mail className="h-5 w-5" />
              </div>
              <input
                type="email"
                value={user?.email || ""}
                disabled
                className="pq-input pl-11"
              />
            </div>
            <p className="text-xs pq-muted mt-1">Email address cannot be changed.</p>
          </div>

          <div>
            <label className="pq-label">Phone Number</label>
            <div className="relative">
              <div className="pq-field-icon">
                <Phone className="h-5 w-5" />
                <span className="ml-1 font-medium">+63</span>
              </div>
              <input
                type="tel"
                maxLength={10}
                value={phone}
                onChange={(e) => {
                  const sanitized = e.target.value.replace(/\D/g, "").slice(0, 10);
                  setPhone(sanitized);
                  // Reset verification for the new digits, but keep resend cooldown
                  // tied to time since last OTP send (not the phone field value).
                  if (sanitized !== phone) {
                    resetPhoneVerification();
                  }
                }}
                disabled={phoneVerified && phoneChanged}
                className="pq-input pl-20 pr-10"
                placeholder="9XXXXXXXXX"
              />
              {phoneVerified && phoneChanged && (
                <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5" style={{ color: "var(--pq-live)" }} />
              )}
            </div>
          </div>

          {(phoneChanged || cooldownLeft > 0) && (
            <div>
              <label className="pq-label">Verification Code</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <div className="pq-field-icon">
                    <KeyRound className="h-5 w-5" />
                  </div>
                  <input
                    ref={otpInputRef}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    disabled={phoneVerified || !otpSent || isSaving || !phoneChanged}
                    autoComplete="one-time-code"
                    className="pq-input pl-11 tracking-widest"
                    placeholder="6-digit code"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleOtpAction}
                  disabled={
                    otpBusy ||
                    isSaving ||
                    phoneVerified ||
                    !phoneChanged ||
                    phone.length !== 10 ||
                    (!otpSent && cooldownLeft > 0) ||
                    (otpSent && otp.length !== 6)
                  }
                  className={`shrink-0 ${
                    phoneVerified
                      ? "pq-chip pq-chip-live min-h-[44px] px-4 cursor-default"
                      : "pq-btn-primary"
                  }`}
                >
                  {otpButtonLabel()}
                </button>
              </div>
              <div className="min-h-[1.25rem] mt-1">
                {phoneVerified ? (
                  <p className="pq-ok-text">
                    New phone verified. You can save your changes.
                  </p>
                ) : cooldownLeft > 0 ? (
                  <p className="text-xs font-semibold pq-muted">
                    Resend code in {formatOtpCountdown(cooldownLeft)}
                  </p>
                ) : otpSent ? (
                  <button
                    type="button"
                    onClick={handleSendCode}
                    disabled={otpBusy || isSaving || !phoneChanged}
                    className="pq-link text-xs"
                  >
                    Resend code
                  </button>
                ) : (
                  <p className="text-xs pq-muted">
                    Verify the new number before saving.
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="pt-6 flex flex-col items-center gap-3 mt-6" style={{ borderTop: "1px solid var(--pq-glass-line)" }}>
            <button
              onClick={handleSave}
              disabled={isSaving || (phoneChanged && !phoneVerified)}
              className="pq-btn-primary w-full sm:w-auto min-w-[200px]"
            >
              {isSaving ? (
                <span className="pq-spinner" />
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  Save Changes
                </>
              )}
            </button>
            <button
              onClick={() => {
                setPasswordError("");
                setCurrentPassword("");
                setNewPassword("");
                setConfirmPassword("");
                setPasswordModalOpen(true);
              }}
              className="pq-link text-sm mt-2"
            >
              Change Password
            </button>
          </div>
        </div>
      </div>

      <div className="pq-glass p-6 sm:p-8" style={{ borderColor: "color-mix(in srgb, var(--pq-alert) 28%, white)" }}>
        <h3 className="text-lg font-extrabold">Account actions</h3>
        <p className="text-sm pq-muted mt-1 mb-5">
          Pause your account or permanently delete your login. Clinic history is kept for analytics.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={() => setDeactivateOpen(true)}
            className="pq-btn-secondary flex-1"
          >
            Deactivate Account
          </button>
          <button
            type="button"
            onClick={() => {
              setDeleteError("");
              setDeleteOpen(true);
            }}
            className="pq-btn-danger flex-1"
          >
            Delete Account
          </button>
        </div>
      </div>

      <InformationModal
        isOpen={successModalOpen}
        onClose={() => setSuccessModalOpen(false)}
        title="Profile Updated"
        message="Your personal information has been successfully updated."
        buttonText="Okay"
      />

      <InformationModal
        isOpen={passwordSuccessModalOpen}
        onClose={() => setPasswordSuccessModalOpen(false)}
        title="Password Updated"
        message="Your password has been successfully changed."
        buttonText="Okay"
      />

      {passwordModalOpen && (
        <div
          className="pq-modal-scrim"
          style={{ zIndex: 60 }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !isChangingPassword) {
              setPasswordModalOpen(false);
            }
          }}
        >
          <div
            className="pq-modal w-full max-w-md overflow-hidden flex flex-col"
            role="dialog"
            aria-modal="true"
          >
            <div className="p-6">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-full shrink-0" style={{ background: "color-mix(in srgb, var(--pq-mark-blue) 12%, white)", color: "var(--pq-mark-blue-deep)" }}>
                  <Shield className="w-6 h-6" />
                </div>

                <div className="flex-1 mt-1">
                  <h2 className="text-xl font-bold">Change Password</h2>
                  <p className="mt-1 pq-muted text-sm">Update your account security.</p>
                </div>
              </div>

              <div className="mt-6 space-y-4">
                {passwordError && (
                  <div className="pq-note pq-note-alert">
                    {passwordError}
                  </div>
                )}

                <div className="relative">
                  <div className="pq-field-icon">
                    <Key className="h-4 w-4" />
                  </div>
                  <input
                    type={showCurrentPassword ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="pq-input pl-10 pr-11 text-sm"
                    placeholder="Current Password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center pq-faint min-w-[44px] justify-end"
                    aria-label={showCurrentPassword ? "Hide current password" : "Show current password"}
                  >
                    {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>

                <div>
                  <div className="relative">
                    <div className="pq-field-icon">
                      <Lock className="h-4 w-4" />
                    </div>
                    <input
                      type={showNewPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className={`pq-input pl-10 pr-11 text-sm ${passwordInvalid ? "pq-input-error" : ""}`}
                      placeholder="New Password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center pq-faint min-w-[44px] justify-end"
                      aria-label={showNewPassword ? "Hide new password" : "Show new password"}
                    >
                      {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {passwordInvalid && passwordErrors.length > 0 && (
                    <p className="pq-error-text px-1 pt-1.5">
                      {passwordErrors[0]}
                    </p>
                  )}
                </div>

                <div>
                  <div className="relative">
                    <div className="pq-field-icon">
                      <Lock className="h-4 w-4" />
                    </div>
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className={`pq-input pl-10 pr-11 text-sm ${confirmInvalid ? "pq-input-error" : ""}`}
                      placeholder="Confirm New Password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center pq-faint min-w-[44px] justify-end"
                      aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {confirmInvalid && (
                    <p className="pq-error-text px-1 pt-1.5">
                      Passwords do not match.
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="p-5 flex justify-end gap-3" style={{ borderTop: "1px solid var(--pq-glass-line)" }}>
              <button
                onClick={() => setPasswordModalOpen(false)}
                disabled={isChangingPassword}
                className="pq-btn-secondary text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handlePasswordSave}
                disabled={isChangingPassword || !isPasswordFormValid || isChecking}
                className="pq-btn-primary text-sm min-w-[120px]"
              >
                {isChangingPassword ? (
                  <span className="pq-spinner" />
                ) : (
                  "Update"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmationModal
        isOpen={deactivateOpen}
        onClose={() => !isDeactivating && setDeactivateOpen(false)}
        onConfirm={handleDeactivate}
        title="Deactivate Account"
        message="Your account will be paused. You will not receive notifications, but your data is saved. You can reactivate by logging in or contacting an Admin."
        confirmText="Deactivate"
        isLoading={isDeactivating}
      />

      <DeleteAccountModal
        isOpen={deleteOpen}
        onClose={() => !isDeleting && setDeleteOpen(false)}
        onConfirm={handleDelete}
        isLoading={isDeleting}
        error={deleteError}
      />
    </div>
  );
}
