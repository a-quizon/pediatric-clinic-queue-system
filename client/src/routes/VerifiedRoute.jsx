import { Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

import { auth } from "../firebase/auth";

export default function VerifiedRoute({ children }) {
  const { user, role, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // If there's no user, let ProtectedRoute handle it (or just return children if this is inner)
  if (!user) {
    return <Navigate to="/" replace />;
  }

  // Only parents require email verification
  // We use auth.currentUser to get the raw Firebase Auth user which reliably has emailVerified
  const firebaseUser = auth.currentUser;
  if (role === "parent" && firebaseUser && !firebaseUser.emailVerified) {
    return <Navigate to="/verify-email" replace />;
  }

  return children;
}
