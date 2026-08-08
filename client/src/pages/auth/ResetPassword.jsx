import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { auth } from "../../firebase/auth";
import { verifyPasswordResetCode, confirmPasswordReset } from "firebase/auth";
import { Activity, Lock, ArrowRight } from "lucide-react";
import toast from "react-hot-toast";
import { validatePasswordRequirements } from "../../utils/passwordUtils";

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
    
    if (!validatePasswordRequirements(newPassword)) {
      toast.error("New password does not meet requirements.");
      return;
    }
    
    if (newPassword !== confirmPassword) {
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
      toast.error("Failed to reset password. The link might have expired.");
    } finally {
      setLoading(false);
    }
  };

  if (validating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4 font-sans">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4 font-sans">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Header Section */}
        <div className="pt-10 pb-6 px-8 text-center border-b border-gray-50">
          <div className="mx-auto w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-6 shadow-sm border border-blue-100">
            <Activity className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800 tracking-tight">Reset Password</h1>
          {!error && !isSuccess && (
            <p className="text-gray-500 font-medium mt-2 text-sm">Create a new password for {email}</p>
          )}
        </div>

        {/* Form Section */}
        <div className="p-8">
          {error ? (
            <div className="text-center">
              <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-xl text-sm font-medium border border-red-100">
                {error}
              </div>
              <Link
                to="/forgot-password"
                className="w-full flex items-center justify-center py-3.5 px-4 bg-blue-600 text-white font-bold rounded-xl shadow-sm transition-all hover:bg-blue-700 hover:shadow mt-4"
              >
                Request New Link
              </Link>
            </div>
          ) : isSuccess ? (
            <div className="text-center">
              <div className="mb-6 p-4 bg-green-50 text-green-700 rounded-xl text-sm font-medium border border-green-100">
                Password successfully reset. You can now sign in with your new password.
              </div>
              <Link
                to="/"
                className="w-full flex items-center justify-center py-3.5 px-4 bg-blue-600 text-white font-bold rounded-xl shadow-sm transition-all hover:bg-blue-700 hover:shadow mt-4"
              >
                Return to Login
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-1">
                <label htmlFor="newPassword" className="block text-sm font-semibold text-gray-700 mb-1.5">New Password</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="password"
                    id="newPassword"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    disabled={loading}
                    className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 text-gray-800 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-colors outline-none"
                    placeholder="Enter new password"
                  />
                </div>
                <p className="text-xs text-gray-500 px-1 pt-1">
                  Password must contain: 8+ characters • Uppercase • Lowercase • Number • Special character
                </p>
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-semibold text-gray-700 mb-1.5">Confirm Password</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="password"
                    id="confirmPassword"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    disabled={loading}
                    className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 text-gray-800 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-colors outline-none"
                    placeholder="Confirm new password"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !newPassword || newPassword !== confirmPassword}
                className={`w-full flex items-center justify-center py-3.5 px-4 bg-blue-600 text-white font-bold rounded-xl shadow-sm transition-all mt-4 ${
                  loading || !newPassword || newPassword !== confirmPassword ? "opacity-70 cursor-not-allowed" : "hover:bg-blue-700 hover:shadow"
                }`}
              >
                {loading ? 'Resetting...' : 'Reset Password'}
                {!loading && <ArrowRight className="w-5 h-5 ml-2" />}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
