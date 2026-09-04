import React, { useState, useEffect } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { Baby, ArrowRight, LogOut } from "lucide-react";
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
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
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
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4 font-sans py-8">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden p-8">
        <OnboardingStepper currentStep={2} />
        <div className="mx-auto w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mb-6 shadow-sm border border-indigo-100">
          <Baby className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-bold text-gray-800 tracking-tight mb-2 text-center">Add Your Child</h1>
        <p className="text-gray-500 text-sm mb-6 text-center">
          Create at least one child profile to finish setup and access the parent portal.
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">
          <ChildProfileForm value={formValue} onChange={setFormValue} idPrefix="onboarding-child" />
          <button
            type="submit"
            disabled={isSaving || !isChildProfileValid(formValue)}
            className={`w-full flex items-center justify-center py-3.5 px-4 font-bold rounded-xl shadow-sm transition-all ${
              isSaving || !isChildProfileValid(formValue)
                ? "bg-blue-400 text-white cursor-not-allowed"
                : "bg-blue-600 text-white hover:bg-blue-700 hover:shadow"
            }`}
          >
            {isSaving ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
            ) : (
              <>
                Continue
                <ArrowRight className="w-5 h-5 ml-2" />
              </>
            )}
          </button>
        </form>

        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center py-3 px-4 text-red-600 font-semibold hover:bg-red-50 rounded-xl transition-colors mt-4"
        >
          <LogOut className="w-5 h-5 mr-2" />
          Back to Login
        </button>
      </div>
    </div>
  );
}
