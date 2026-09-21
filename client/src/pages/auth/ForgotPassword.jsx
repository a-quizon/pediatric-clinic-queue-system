import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowRight } from "lucide-react";
import toast from "react-hot-toast";
import { PqAuthShell, PqBrand } from "../../components/parent/pqUi";
import { sendPasswordResetLink } from "../../services/passwordResetService";

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const actionCodeSettings = {
        url: `${window.location.origin}/reset-password`,
        handleCodeInApp: true
      };
      await sendPasswordResetLink(email, actionCodeSettings);
      setIsSuccess(true);
      toast.success("Password reset email sent.");
    } catch (err) {
      console.error('Password reset failed:', err);
      if (err.code === 'rate_limited') {
        toast.error(err.message || "You've reached today's password reset limit. Please try again tomorrow.");
      } else if (err.code === 'auth/too-many-requests') {
        toast.error("Too many requests. Please wait a moment before trying again.");
      } else if (err.code === 'auth/user-not-found') {
        toast.error("No user found with this email address.");
      } else if (err.code === 'auth/invalid-email' || err.code === 'invalid_email') {
        toast.error("Please enter a valid email address.");
      } else {
        toast.error(err.message || "Unable to send reset email. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <PqAuthShell>
      <div className="pq-glass-window overflow-hidden">
        <div className="pt-10 pb-6 px-8 text-center" style={{ borderBottom: "1px solid var(--pq-glass-line)" }}>
          <div className="flex justify-center mb-5">
            <PqBrand size={72} stacked />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight">Reset Password</h1>
          <p className="pq-muted mt-2 text-sm">Enter your email to receive a reset link</p>
        </div>

        <div className="p-8">
          {isSuccess ? (
            <div className="text-center">
              <div className="pq-note pq-note-ok mb-6">
                A password reset link has been sent to {email}. Please check your inbox.
              </div>
              <Link to="/" className="pq-btn-primary w-full">
                Return to Login
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="email" className="pq-label">Email Address</label>
                <div className="relative">
                  <div className="pq-field-icon">
                    <Mail className="h-5 w-5" />
                  </div>
                  <input
                    type="email"
                    id="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={loading}
                    className="pq-input pl-11"
                    placeholder="Enter your email"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="pq-btn-primary w-full mt-2"
              >
                {loading ? 'Sending...' : 'Send Reset Link'}
                {!loading && <ArrowRight className="w-5 h-5" />}
              </button>
            </form>
          )}

          {!isSuccess && (
            <div className="mt-8 text-center">
              <Link to="/" className="pq-link text-sm">
                Back to Login
              </Link>
            </div>
          )}
        </div>
      </div>
    </PqAuthShell>
  );
}
