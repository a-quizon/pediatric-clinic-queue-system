import React, { useState, useEffect } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { Baby, ArrowRight, LogOut } from "lucide-react";
import { PqAuthShell, PqSpinner } from "../../components/parent/pqUi";
import toast from "react-hot-toast";
import { useAuth } from "../../hooks/useAuth";
import { auth } from "../../firebase/auth";
import { completeParentOnboarding, completeParentRegistration, logoutUser } from "../../services/authService";
import { addChild } from "../../services/childProfileService";
import ChildProfileForm, {
  emptyChildProfile,
  isChildProfileValid
} from "../../components/parent/ChildProfileForm";
import OnboardingStepper from "../../components/auth/OnboardingStepper";

export default function OnboardingChildProfile() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [formValue, setFormValue] = useState(emptyChildProfile());
  const [isSaving, setIsSaving] = useState(false);
  const firebaseUser = auth.currentUser;

  useEffect(() => {
    if (firebaseUser?.emailVerified) {
      completeParentRegistration(firebaseUser).catch(console.error);
    }
  }, [firebaseUser]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user?.uid || !isChildProfileValid(formValue)) return;
    setIsSaving(true);
    try {
      await addChild(user.uid, formValue);
      await completeParentOnboarding(user.uid);
      toast.success("Child profile saved. Welcome!");
      navigate("/parent", { replace: true });
    } catch (err) {
      console.error(err);
      toast.error("Failed to save child profile. Please try again.");
      setIsSaving(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logoutUser(user);
      navigate("/");
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

  if (firebaseUser && !firebaseUser.emailVerified) {
    return <Navigate to="/verify-email" replace />;
  }

  if (user?.role === "parent" && user.onboardingComplete !== false) {
    return <Navigate to="/parent" replace />;
  }

  if (user?.role !== "parent" || user.onboardingComplete !== false) {
    return (
      <PqAuthShell>
        <PqSpinner />
      </PqAuthShell>
    );
  }

  return (
    <PqAuthShell>
      <div className="pq-glass-window overflow-hidden p-8">
        <OnboardingStepper currentStep={2} />
        <div className="mx-auto w-16 h-16 rounded-2xl flex items-center justify-center mb-6" style={{ background: "color-mix(in srgb, var(--pq-mark-coral) 14%, white)", color: "var(--pq-mark-coral)" }}>
          <Baby className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-extrabold tracking-tight mb-2 text-center">Add Your Child</h1>
        <p className="pq-muted text-sm mb-6 text-center">
          Create at least one child profile to finish setup and access the parent portal.
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">
          <ChildProfileForm value={formValue} onChange={setFormValue} idPrefix="onboarding-child" />
          <button
            type="submit"
            disabled={isSaving || !isChildProfileValid(formValue)}
            className="pq-btn-primary w-full"
          >
            {isSaving ? "Saving..." : (
              <>
                Continue
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </form>

        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center py-3 px-4 font-semibold rounded-[0.95rem] min-h-[44px] mt-4"
          style={{ color: "var(--pq-alert)" }}
        >
          <LogOut className="w-5 h-5 mr-2" />
          Back to Login
        </button>
      </div>
    </PqAuthShell>
  );
}
