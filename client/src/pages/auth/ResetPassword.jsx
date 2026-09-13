import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { auth } from "../../firebase/auth";
import { verifyPasswordResetCode, confirmPasswordReset } from "firebase/auth";
import { Lock, ArrowRight, Eye, EyeOff } from "lucide-react";
import { PqAuthShell, PqBrand, PqSpinner } from "../../components/parent/pqUi";
import toast from "react-hot-toast";
import { mapAuthError } from "../../utils/authErrors";
import { usePasswordValidation } from "../../utils/passwordUtils";

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const oobCode = searchParams.get('oobCode');

  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(true);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState('');
  
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const { isValid: isPasswordValid, errors: passwordErrors, isChecking } = usePasswordValidation(newPassword);

  const passwordInvalid = newPassword.length > 0 && !isPasswordValid;
  const isConfirmValid = newPassword && newPassword === confirmPassword;
  const confirmInvalid = confirmPassword.length > 0 && !isConfirmValid;
  const isFormValid = isPasswordValid && isConfirmValid && !isChecking;

  useEffect(() => {
    if (!oobCode) {
      setError("This password reset link is invalid or has expired. Please request a new password reset email.");
      setValidating(false);
      return;
    }

    verifyPasswordResetCode(auth, oobCode)
      .then((userEmail) => {
        setEmail(userEmail);
        setValidating(false);
      })
      .catch((err) => {
        console.error("Code verification failed:", err);
        setError("This password reset link is invalid or has expired. Please request a new password reset email.");
        setValidating(false);
      });
  }, [oobCode]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (isChecking) return;

    if (!isPasswordValid) {
      toast.error('Password does not meet requirements.');
      return;
    }
    
    if (!isConfirmValid) {
      toast.error("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      await confirmPasswordReset(auth, oobCode, newPassword);
      setIsSuccess(true);
      toast.success("Password reset successfully.");
    } catch (err) {
      console.error('Password reset failed:', err);
      toast.error(mapAuthError(err.code));
    } finally {
      setLoading(false);
    }
  };

  if (validating) {
    return (
      <PqAuthShell>
        <PqSpinner />
      </PqAuthShell>
    );
  }

  return (
    <PqAuthShell>
      <div className="pq-glass-window overflow-hidden">
        <div className="pt-10 pb-6 px-8 text-center" style={{ borderBottom: "1px solid var(--pq-glass-line)" }}>
          <div className="flex justify-center mb-5">
            <PqBrand size={72} stacked />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight">Reset Password</h1>
          {!error && !isSuccess && (
            <p className="pq-muted mt-2 text-sm">Create a new password for {email}</p>
          )}
        </div>

        <div className="p-8">
          {error ? (
            <div className="text-center">
              <div className="pq-note pq-note-alert mb-6">{error}</div>
              <Link to="/forgot-password" className="pq-btn-primary w-full">
                Request New Link
              </Link>
            </div>
          ) : isSuccess ? (
            <div className="text-center">
              <div className="pq-note pq-note-ok mb-6">
                Password successfully reset. You can now sign in with your new password.
              </div>
              <Link to="/" className="pq-btn-primary w-full">
                Return to Login
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-3">
                <div className="space-y-1">
                  <label htmlFor="newPassword" className="pq-label">New Password</label>
                  <div className="relative">
                    <div className="pq-field-icon">
                      <Lock className="h-5 w-5" />
                    </div>
                    <input
                      type={showPassword ? "text" : "password"}
                      id="newPassword"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      className={`pq-input pl-11 pr-11 ${passwordInvalid ? "pq-input-error" : ""}`}
                      placeholder="Enter new password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center pq-faint min-w-[44px] justify-end"
                      tabIndex="-1"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>

                {passwordInvalid && passwordErrors.length > 0 && (
                  <p className="pq-error-text px-1 pt-1.5">
                    {passwordErrors[0]}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="confirmPassword" className="pq-label">Confirm Password</label>
                <div className="relative">
                  <div className="pq-field-icon">
                    <Lock className="h-5 w-5" />
                  </div>
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    id="confirmPassword"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className={`pq-input pl-11 pr-11 ${confirmInvalid ? "pq-input-error" : ""}`}
                    placeholder="Confirm new password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center pq-faint min-w-[44px] justify-end"
                    tabIndex="-1"
                    aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                  >
                    {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
                {confirmInvalid && (
                  <p className="pq-error-text px-1 pt-1.5">
                    Passwords do not match.
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={loading || !isFormValid || isChecking}
                className="pq-btn-primary w-full mt-4"
              >
                {loading ? 'Resetting...' : 'Reset Password'}
                {!loading && <ArrowRight className="w-5 h-5" />}
              </button>
            </form>
          )}
        </div>
      </div>
    </PqAuthShell>
  );
}
