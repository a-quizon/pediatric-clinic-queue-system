import { useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { updateUserProfile } from "../../services/authService";
import { handlePasswordChangeRequest, usePasswordValidation } from "../../utils/passwordUtils";
import { formatName } from "../../utils/stringUtils";
import { formatToE164, parseToLocal } from "../../utils/phoneUtils";
import { User as UserIcon, Save, Lock, Eye, EyeOff } from "lucide-react";
import toast from "react-hot-toast";

const getInitials = (name) => {
  if (!name) return "A";
  const parts = name.trim().split(" ");
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
};

function PasswordField({ id, label, value, onChange, shown, onToggle, invalid, placeholder }) {
  return (
    <div>
      <label className="pq-label" htmlFor={id}>
        {label} <span style={{ color: "var(--pq-alert)" }}>*</span>
      </label>
      <div className="relative">
        <input
          id={id}
          type={shown ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`pq-input pr-11 ${invalid ? "pq-input-error" : ""}`}
          placeholder={placeholder}
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute inset-y-0 right-0 pr-3 flex items-center pq-faint hover:text-[var(--pq-ink)] min-w-[44px] justify-center"
          aria-label={shown ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
        >
          {shown ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
        </button>
      </div>
    </div>
  );
}

export default function Profile() {
  const { user } = useAuth();

  const initialName = user?.displayName || user?.name || "";
  const initialContact = parseToLocal(user?.contactNumber || user?.phone || "");

  const [isSaving, setIsSaving] = useState(false);
  const [fullName, setFullName] = useState(initialName);
  const [contactNumber, setContactNumber] = useState(initialContact);

  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const { isValid: isPasswordValid, errors: passwordErrors, isChecking } = usePasswordValidation(newPassword);

  const passwordInvalid = newPassword.length > 0 && !isPasswordValid;
  const confirmInvalid = confirmPassword.length > 0 && newPassword !== confirmPassword;
  const isPasswordFormValid = currentPassword.length > 0 && isPasswordValid && newPassword === confirmPassword && !isChecking;

  const hasChanges = fullName.trim() !== initialName || contactNumber.trim() !== initialContact;

  const handleSave = async () => {
    if (!fullName.trim()) {
      toast.error("Full Name is required.");
      return;
    }
    if (contactNumber.trim() && contactNumber.trim().length !== 10) {
      toast.error("Contact Number must be exactly 10 digits.");
      return;
    }

    setIsSaving(true);
    try {
      await updateUserProfile(user.uid, {
        name: formatName(fullName.trim()),
        contactNumber: contactNumber.trim() ? formatToE164(contactNumber.trim()) : "",
      });
      toast.success("Profile updated successfully!");
    } catch (err) {
      console.error(err);
      toast.error("Failed to update profile.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdatePassword = async () => {
    setIsUpdatingPassword(true);
    try {
      const result = await handlePasswordChangeRequest(currentPassword, newPassword, confirmPassword);
      if (result.success) {
        toast.success("Password updated successfully!");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        toast.error(result.error);
      }
    } catch (err) {
      console.error(err);
      toast.error("An unexpected error occurred. Please try again.");
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const displayName = initialName || "Administrator";

  return (
    <div className="space-y-6 pb-8 max-w-4xl mx-auto">
      <section className="pq-glass p-6 sm:p-8 flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-extrabold shrink-0"
          style={{ background: "color-mix(in srgb, var(--pq-mark-blue) 14%, white)", color: "var(--pq-mark-blue-deep)" }}
        >
          {getInitials(displayName)}
        </div>
        <div className="min-w-0">
          <h2 className="text-xl font-extrabold tracking-tight truncate">{displayName}</h2>
          <p className="text-sm pq-muted mt-1 truncate">{user?.email}</p>
          <span className="pq-chip pq-chip-info mt-2 inline-flex">System Administrator</span>
        </div>
      </section>

      <div className="pq-glass overflow-hidden">
        <div className="p-6 md:p-8" style={{ borderBottom: "1px solid var(--pq-glass-line)" }}>
          <h2 className="text-lg font-extrabold tracking-tight flex items-center">
            <UserIcon className="w-5 h-5 mr-2" style={{ color: "var(--pq-mark-blue)" }} aria-hidden="true" />
            Profile Information
          </h2>
        </div>

        <div className="p-6 md:p-8 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
            <div>
              <label className="pq-label" htmlFor="admin-full-name">
                Full Name <span style={{ color: "var(--pq-alert)" }}>*</span>
              </label>
              <input
                id="admin-full-name"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="pq-input"
                placeholder="e.g. Juan Dela Cruz"
              />
            </div>

            <div>
              <label className="pq-label">Email Address</label>
              <div className="pq-input opacity-65 cursor-not-allowed" title="Email address cannot be changed here">
                {user?.email || "Not provided"}
              </div>
            </div>

            <div>
              <label className="pq-label" htmlFor="admin-contact">
                Contact Number
              </label>
              <div className="relative">
                <div className="pq-field-icon font-medium" style={{ color: "var(--pq-ink-soft)" }}>
                  +63
                </div>
                <input
                  id="admin-contact"
                  type="tel"
                  maxLength={10}
                  value={contactNumber}
                  onChange={(e) => setContactNumber(e.target.value.replace(/\D/g, ""))}
                  className="pq-input pl-14"
                  placeholder="912 345 6789"
                />
              </div>
            </div>
          </div>

          <div className="pt-6 flex justify-end" style={{ borderTop: "1px solid var(--pq-glass-line)" }}>
            <button
              type="button"
              onClick={handleSave}
              disabled={!hasChanges || isSaving}
              className="pq-btn-primary w-full sm:w-auto"
            >
              {isSaving ? (
                <span className="pq-spinner" style={{ width: 16, height: 16, borderWidth: 2 }} aria-hidden="true" />
              ) : (
                <Save className="w-4 h-4" aria-hidden="true" />
              )}
              Save Information
            </button>
          </div>
        </div>
      </div>

      <div className="pq-glass overflow-hidden">
        <div className="p-6 md:p-8" style={{ borderBottom: "1px solid var(--pq-glass-line)" }}>
          <h2 className="text-lg font-extrabold tracking-tight flex items-center">
            <Lock className="w-5 h-5 mr-2" style={{ color: "var(--pq-mark-blue)" }} aria-hidden="true" />
            Security
          </h2>
        </div>
        <div className="p-6 md:p-8">
          <div className="max-w-md space-y-5">
            <PasswordField
              id="admin-current-password"
              label="Current Password"
              value={currentPassword}
              onChange={setCurrentPassword}
              shown={showCurrentPassword}
              onToggle={() => setShowCurrentPassword((v) => !v)}
              placeholder="Enter current password"
            />

            <div>
              <PasswordField
                id="admin-new-password"
                label="New Password"
                value={newPassword}
                onChange={setNewPassword}
                shown={showNewPassword}
                onToggle={() => setShowNewPassword((v) => !v)}
                invalid={passwordInvalid}
                placeholder="Enter new password"
              />
              {passwordInvalid && passwordErrors.length > 0 && (
                <p className="pq-error-text px-1 pt-1.5">{passwordErrors[0]}</p>
              )}
            </div>

            <div>
              <PasswordField
                id="admin-confirm-password"
                label="Confirm New Password"
                value={confirmPassword}
                onChange={setConfirmPassword}
                shown={showConfirmPassword}
                onToggle={() => setShowConfirmPassword((v) => !v)}
                invalid={confirmInvalid}
                placeholder="Confirm new password"
              />
              {confirmInvalid && (
                <p className="pq-error-text px-1 pt-1">Passwords do not match.</p>
              )}
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={handleUpdatePassword}
                disabled={isUpdatingPassword || !isPasswordFormValid || isChecking}
                className="pq-btn-primary w-full sm:w-auto"
              >
                {isUpdatingPassword ? (
                  <span className="pq-spinner" style={{ width: 16, height: 16, borderWidth: 2 }} aria-hidden="true" />
                ) : (
                  <Save className="w-4 h-4" aria-hidden="true" />
                )}
                Update Password
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
