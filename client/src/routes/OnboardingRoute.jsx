import { Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { auth } from "../firebase/auth";

export default function OnboardingRoute({ children }) {
  const { user, role, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  const firebaseUser = auth.currentUser;
  if (role === "parent" && firebaseUser && !firebaseUser.emailVerified) {
    return <Navigate to="/verify-email" replace />;
  }

  if (role === "parent" && user.onboardingComplete === false) {
    return <Navigate to="/onboarding/child" replace />;
  }

  return children;
}
