import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

/**
 * Keeps secretaries with mustChangePassword on the forced change screen
 * until they update their password.
 */
export default function MustChangePasswordRoute({ children }) {
  const { user, role, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <h1>Loading...</h1>;
  }

  const mustChange = Boolean(user?.mustChangePassword);
  const onChangePage = location.pathname === "/secretary/change-password";

  if (role === "secretary" && mustChange && !onChangePage) {
    return <Navigate to="/secretary/change-password" replace />;
  }

  if (role === "secretary" && !mustChange && onChangePage) {
    return <Navigate to="/secretary" replace />;
  }

  return children;
}
