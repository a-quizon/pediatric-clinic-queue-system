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

  useEffect(() => {
    if (user) {
      setName(user.fullName || user.displayName || user.name || "");
      const local = parseToLocal(user.phoneNumber || user.phone || "");
      setPhone(local);
      setOriginalPhoneLocal(local);
      setOtp("");
      setOtpSent(false);
      setPhoneVerified(false);
      setVerificationId("");
      setCooldownLeft(0);
    }
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
      setError(err.message || "Failed to send verification code.");
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
      <div className="bg-white rounded-3xl border border-gray-100 shadow-xs p-6 sm:p-8 animate-in fade-in slide-in-from-bottom-4">

        {error && (
          <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-xl text-sm font-medium">
            {error}
          </div>
        )}

        <div className="space-y-6">
          <div className="space-y-2">
            <label className="block text-sm font-bold text-gray-700 ml-1">Full Name</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <User className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none text-gray-800 font-medium"
                placeholder="Enter your full name"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-bold text-gray-700 ml-1">Email Address</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Mail className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="email"
                value={user?.email || ""}
                disabled
                className="w-full pl-11 pr-4 py-3 bg-gray-100 border border-gray-200 rounded-2xl text-gray-500 font-medium cursor-not-allowed outline-none"
              />
            </div>
            <p className="text-xs text-gray-400 ml-1 mt-1">Email address cannot be changed.</p>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-bold text-gray-700 ml-1">Phone Number</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Phone className="h-5 w-5 text-gray-400" />
                <span className="ml-2 text-gray-500 font-medium">+63</span>
              </div>
              <input
                type="tel"
                maxLength={10}
                value={phone}
                onChange={(e) => {
                  const sanitized = e.target.value.replace(/\D/g, "").slice(0, 10);
                  setPhone(sanitized);
                  if (sanitized !== originalPhoneLocal) {
                    resetPhoneVerification();
                    setCooldownLeft(0);
                  } else {
                    resetPhoneVerification();
                    setCooldownLeft(0);
                  }
                }}
                disabled={phoneVerified && phoneChanged}
                className="w-full pl-20 pr-10 py-3 bg-gray-50 border border-gray-200 rounded-2xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none text-gray-800 font-medium"
                placeholder="9XXXXXXXXX"
              />
              {phoneVerified && phoneChanged && (
                <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-emerald-500" />
              )}
            </div>
          </div>

          {phoneChanged && (
            <div className="space-y-2">
              <label className="block text-sm font-bold text-gray-700 ml-1">Verification Code</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <KeyRound className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    ref={otpInputRef}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    disabled={phoneVerified || !otpSent || isSaving}
                    autoComplete="one-time-code"
                    className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none text-gray-800 font-medium tracking-widest"
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
                    phone.length !== 10 ||
                    (!otpSent && cooldownLeft > 0) ||
                    (otpSent && otp.length !== 6)
                  }
                  className={`shrink-0 px-4 py-3 rounded-xl text-sm font-bold transition-all ${
                    phoneVerified
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200 cursor-default"
                      : otpBusy || phone.length !== 10 || (!otpSent && cooldownLeft > 0) || (otpSent && otp.length !== 6)
                        ? "bg-blue-300 text-white cursor-not-allowed"
                        : "bg-blue-600 text-white hover:bg-blue-700"
                  }`}
                >
                  {otpButtonLabel()}
                </button>
              </div>
              <div className="min-h-[1.25rem]">
                {phoneVerified ? (
                  <p className="text-xs font-semibold text-emerald-600 ml-1">
                    New phone verified. You can save your changes.
                  </p>
                ) : cooldownLeft > 0 ? (
                  <p className="text-xs font-semibold text-gray-500 ml-1">
                    Resend code in {formatOtpCountdown(cooldownLeft)}
                  </p>
                ) : otpSent ? (
                  <button
                    type="button"
                    onClick={handleSendCode}
                    disabled={otpBusy || isSaving}
                    className="text-xs font-semibold text-blue-600 hover:underline ml-1"
                  >
                    Resend code
                  </button>
                ) : (
                  <p className="text-xs text-gray-400 ml-1">
                    Verify the new number before saving.
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="pt-6 flex flex-col items-center gap-3 border-t border-gray-50 mt-6">
            <button
              onClick={handleSave}
              disabled={isSaving || (phoneChanged && !phoneVerified)}
              className="px-6 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 w-full sm:w-auto shadow-sm focus:outline-none min-w-[200px]"
            >
              {isSaving ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
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
              className="text-sm font-bold text-blue-600 hover:text-blue-800 transition-colors mt-2"
            >
              Change Password
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-red-100 shadow-xs p-6 sm:p-8">
        <h3 className="text-lg font-extrabold text-gray-800">Account actions</h3>
        <p className="text-sm text-gray-500 mt-1 mb-5">
          Pause your account or permanently delete your login. Clinic history is kept for analytics.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={() => setDeactivateOpen(true)}
            className="flex-1 px-6 py-3 bg-white border border-gray-200 text-gray-700 font-bold rounded-xl hover:bg-gray-50 transition-colors"
          >
            Deactivate Account
          </button>
          <button
            type="button"
            onClick={() => {
              setDeleteError("");
              setDeleteOpen(true);
            }}
            className="flex-1 px-6 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-colors shadow-sm"
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
          className="fixed inset-0 z-[60] flex items-center justify-center bg-gray-900/40 backdrop-blur-sm p-4 sm:p-6"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isChangingPassword) {
              setPasswordModalOpen(false);
            }
          }}
        >
          <div
            className="bg-white rounded-3xl shadow-xl w-full max-w-md overflow-hidden flex flex-col transform transition-all animate-in fade-in zoom-in-95 duration-200"
            role="dialog"
            aria-modal="true"
          >
            <div className="p-6">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-full shrink-0 bg-purple-50">
                  <Shield className="w-6 h-6 text-purple-600" />
                </div>

                <div className="flex-1 mt-1">
                  <h2 className="text-xl font-bold text-gray-800">Change Password</h2>
                  <p className="mt-1 text-gray-600 text-sm">Update your account security.</p>
                </div>
              </div>

              <div className="mt-6 space-y-4">
                {passwordError && (
                  <div className="p-3 bg-red-50 text-red-600 rounded-xl text-sm font-medium">
                    {passwordError}
                  </div>
                )}

                <div className="space-y-1">
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Key className="h-4 w-4 text-gray-400" />
                    </div>
                    <input
                      type={showCurrentPassword ? "text" : "password"}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="w-full pl-9 pr-10 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all outline-none text-gray-800 text-sm"
                      placeholder="Current Password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 focus:outline-none"
                    >
                      {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Lock className="h-4 w-4 text-gray-400" />
                    </div>
                    <input
                      type={showNewPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className={`w-full pl-9 pr-10 py-2.5 bg-gray-50 border rounded-xl focus:outline-none transition-all text-gray-800 text-sm ${
                        passwordInvalid
                          ? 'border-red-300 focus:bg-white focus:border-red-500 focus:ring-2 focus:ring-red-500/20'
                          : 'border-gray-200 focus:bg-white focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20'
                      }`}
                      placeholder="New Password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 focus:outline-none"
                    >
                      {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {passwordInvalid && passwordErrors.length > 0 && (
                    <p className="text-xs text-red-500 font-semibold px-1 pt-1.5">
                      {passwordErrors[0]}
                    </p>
                  )}
                </div>

                <div className="space-y-1">
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Lock className="h-4 w-4 text-gray-400" />
                    </div>
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className={`w-full pl-9 pr-10 py-2.5 bg-gray-50 border rounded-xl focus:outline-none transition-all text-gray-800 text-sm ${
                        confirmInvalid
                          ? 'border-red-300 focus:bg-white focus:border-red-500 focus:ring-2 focus:ring-red-500/20'
                          : 'border-gray-200 focus:bg-white focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20'
                      }`}
                      placeholder="Confirm New Password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 focus:outline-none"
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {confirmInvalid && (
                    <p className="text-xs text-red-500 font-semibold px-1 pt-1.5">
                      Passwords do not match.
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="p-5 border-t border-gray-100 bg-gray-50/50 flex justify-end gap-3 rounded-b-3xl">
              <button
                onClick={() => setPasswordModalOpen(false)}
                disabled={isChangingPassword}
                className="px-5 py-2 text-gray-600 font-bold hover:bg-gray-200 rounded-xl transition-colors disabled:opacity-50 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handlePasswordSave}
                disabled={isChangingPassword || !isPasswordFormValid || isChecking}
                className={`px-5 py-2 font-bold rounded-xl shadow-sm transition-colors flex justify-center items-center text-white text-sm min-w-[120px] ${
                  isChangingPassword || !isPasswordFormValid || isChecking ? 'bg-purple-400 cursor-not-allowed' : 'bg-purple-600 hover:bg-purple-700'
                }`}
              >
                {isChangingPassword ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
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
