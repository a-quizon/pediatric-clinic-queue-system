import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from "../../hooks/useAuth";
import { Mail, RefreshCw, LogOut, CheckCircle } from "lucide-react";
import { PqAuthShell, PqSpinner } from "../../components/parent/pqUi";
import toast from "react-hot-toast";
import { sendEmailVerification } from "firebase/auth";
import { auth } from "../../firebase/auth";
import { logoutUser, completeParentRegistration } from "../../services/authService";
import OnboardingStepper from "../../components/auth/OnboardingStepper";

export default function VerifyEmail() {
  const navigate = useNavigate();
  const { user, role, loading } = useAuth();
  const [isChecking, setIsChecking] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    let timer;
    if (cooldown > 0) {
      timer = setInterval(() => {
        setCooldown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [cooldown]);

  useEffect(() => {
    if (!loading && user) {
      if (role === 'doctor') {
        navigate('/doctor', { replace: true });
      } else if (role === 'secretary') {
        navigate('/secretary', { replace: true });
      } else if (role === 'admin') {
        navigate('/admin', { replace: true });
      } else if (user.emailVerified) {
        const firebaseUser = auth.currentUser;
        if (firebaseUser) {
          completeParentRegistration(firebaseUser)
            .catch(console.error)
            .finally(() => {
              navigate("/onboarding/child", { replace: true });
            });
        }
      }
    }
  }, [user, role, loading, navigate]);

  const handleCheckVerification = async () => {
    const firebaseUser = auth.currentUser;
    if (!firebaseUser) {
      toast.error("Authentication session expired.");
      navigate('/');
      return;
    }
    setIsChecking(true);
    try {
      await firebaseUser.reload();
      if (firebaseUser.emailVerified) {
        toast.success("Email verified successfully!");
        await completeParentRegistration(firebaseUser);
        await new Promise(r => setTimeout(r, 1000));
        navigate("/onboarding/child");
      } else {
        toast.error("Email is not verified yet. Please check your inbox.");
      }
    } catch (error) {
      console.error("Error checking verification:", error);
      toast.error("Failed to check verification status.");
    } finally {
      setIsChecking(false);
    }
  };

  const handleResendEmail = async () => {
    const firebaseUser = auth.currentUser;
    if (!firebaseUser) {
      toast.error("Authentication session expired.");
      navigate('/');
      return;
    }
    setIsResending(true);
    try {
      if (firebaseUser.emailVerified) {
          toast.success("Email is already verified!");
          await completeParentRegistration(firebaseUser);
          await new Promise(r => setTimeout(r, 1000));
          navigate("/onboarding/child");
          return;
      }
      await sendEmailVerification(firebaseUser);
      toast.success("Verification email sent!");
      setCooldown(60);
    } catch (error) {
      console.error("Error resending email:", error);
      if (error.code === 'auth/too-many-requests') {
        toast.error("Too many requests. Please wait a moment before trying again.");
      } else {
        toast.error("Failed to resend verification email.");
      }
    } finally {
      setIsResending(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logoutUser(user);
      navigate('/');
    } catch (error) {
      console.error("Logout error:", error);
      toast.error("Failed to log out");
    }
  };

  if (loading) {
    return (
      <PqAuthShell>
        <PqSpinner />
      </PqAuthShell>
    );
  }

  return (
    <PqAuthShell>
      <div className="pq-glass-window overflow-hidden text-center p-8">
        <OnboardingStepper currentStep={1} />
        <div className="mx-auto w-16 h-16 rounded-2xl flex items-center justify-center mb-6" style={{ background: "color-mix(in srgb, var(--pq-mark-blue) 12%, white)", color: "var(--pq-mark-blue-deep)" }}>
          <Mail className="w-8 h-8" />
        </div>
        
        <h1 className="text-2xl font-extrabold tracking-tight mb-2">Check Your Email</h1>
        
        <p className="pq-muted text-sm mb-6">
          We've sent a verification link to:<br />
          <span className="font-semibold inline-block mt-2 mb-3 px-3 py-1 rounded-lg" style={{ background: "color-mix(in srgb, var(--pq-mark-blue) 10%, white)", color: "var(--pq-ink)" }}>{user?.email || auth.currentUser?.email}</span><br />
          You'll need to verify your email before you can access your account.<br /><br />
          <span className="font-medium">Can't find the verification email?</span><br />
          Please check your <span className="font-bold px-2 py-0.5 rounded" style={{ color: "var(--pq-alert)", background: "var(--pq-alert-wash)" }}>Spam or Junk folder</span>. If it's still not there, you can resend the verification email below.
        </p>
        
        <div className="space-y-3">
          <button
            onClick={handleCheckVerification}
            disabled={isChecking}
            className="pq-btn-primary w-full"
          >
            {isChecking ? (
              <span className="pq-spinner" style={{ width: 20, height: 20, borderWidth: 2, borderTopColor: "#fff", borderColor: "rgba(255,255,255,0.3)" }} />
            ) : (
              <>
                <CheckCircle className="w-5 h-5" />
                I've Verified My Email
              </>
            )}
          </button>
          
          <button
            onClick={handleResendEmail}
            disabled={isResending || cooldown > 0}
            className="pq-btn-secondary w-full"
          >
            {isResending ? (
              "Sending..."
            ) : cooldown > 0 ? (
              `Resend available in ${cooldown}s`
            ) : (
              <>
                <RefreshCw className="w-5 h-5" />
                Resend Verification Email
              </>
            )}
          </button>
          
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center py-3 px-4 font-semibold rounded-[0.95rem] min-h-[44px]"
            style={{ color: "var(--pq-alert)" }}
          >
            <LogOut className="w-5 h-5 mr-2" />
            Back to Login
          </button>
        </div>
      </div>
    </PqAuthShell>
  );
}
