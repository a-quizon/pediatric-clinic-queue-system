import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Lock, Eye, EyeOff } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "../../hooks/useAuth";
import { handlePasswordChangeRequest, usePasswordValidation } from "../../utils/passwordUtils";
import { PqAuthShell, PqBrand } from "../../components/parent/pqUi";
import LogoutButton from "../../components/common/LogoutButton";

/**
 * Forced password change after a doctor-issued temporary secretary password.
 */
export default function ForcedPasswordChange() {
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);

  const { isValid, errors, isChecking } = usePasswordValidation(newPassword);
  const passwordInvalid = newPassword.length > 0 && !isChecking && !isValid;
  const formValid =
    currentPassword.length > 0 &&
    isValid &&
    newPassword === confirmPassword &&
    !isChecking;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formValid || saving) return;
    setSaving(true);
    try {
      const result = await handlePasswordChangeRequest(
        currentPassword,
        newPassword,
        confirmPassword
      );
      if (!result.success) {
        toast.error(result.error || "Failed to update password.");
        return;
      }
      toast.success("Password updated. You can continue.");
      if (role === "secretary") {
        navigate("/secretary", { replace: true });
      } else {
        navigate("/", { replace: true });
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to update password. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;

  return (
    <PqAuthShell>
      <div className="w-full max-w-md mx-auto space-y-6">
        <PqBrand />
        <div className="pq-glass p-6 sm:p-8 space-y-5">
          <div className="flex items-start gap-3">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
              style={{ background: "color-mix(in srgb, var(--pq-mark-blue) 14%, white)", color: "var(--pq-mark-blue-deep)" }}
            >
              <Lock className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold tracking-tight">Change your password</h1>
              <p className="text-sm pq-muted mt-1">
                Your temporary password must be changed before you can use the secretary dashboard.
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="pq-label" htmlFor="forced-current-password">Current (temporary) password</label>
              <div className="relative">
                <input
                  id="forced-current-password"
                  type={showCurrent ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="pq-input pr-11"
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent((v) => !v)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center pq-faint min-w-[44px] justify-center"
                  aria-label={showCurrent ? "Hide password" : "Show password"}
                >
                  {showCurrent ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <div>
              <label className="pq-label" htmlFor="forced-new-password">New password</label>
              <div className="relative">
                <input
                  id="forced-new-password"
                  type={showNew ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className={`pq-input pr-11 ${passwordInvalid ? "pq-input-error" : ""}`}
                  autoComplete="new-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowNew((v) => !v)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center pq-faint min-w-[44px] justify-center"
                  aria-label={showNew ? "Hide password" : "Show password"}
                >
                  {showNew ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              {passwordInvalid && errors[0] && (
                <p className="pq-error-text px-1 pt-1.5">{errors[0]}</p>
              )}
            </div>

            <div>
              <label className="pq-label" htmlFor="forced-confirm-password">Confirm new password</label>
              <div className="relative">
                <input
                  id="forced-confirm-password"
                  type={showConfirm ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="pq-input pr-11"
                  autoComplete="new-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((v) => !v)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center pq-faint min-w-[44px] justify-center"
                  aria-label={showConfirm ? "Hide password" : "Show password"}
                >
                  {showConfirm ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              {confirmPassword && confirmPassword !== newPassword && (
                <p className="pq-error-text px-1 pt-1.5">Passwords do not match.</p>
              )}
            </div>

            <button type="submit" className="pq-btn-primary w-full" disabled={!formValid || saving}>
              {saving ? "Updating..." : "Update password"}
            </button>
          </form>

          <div className="pt-2">
            <LogoutButton className="pq-btn-secondary w-full" />
          </div>
        </div>
      </div>
    </PqAuthShell>
  );
}
