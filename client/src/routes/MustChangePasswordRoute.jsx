import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

/** Staff roles that receive admin-issued temporary passwords. */
const FORCED_CHANGE_ROLES = ["secretary", "doctor"];

/**
 * Keeps secretaries and doctors with mustChangePassword on the forced change screen
 * until they update their password.
 */
export default function MustChangePasswordRoute({ children }) {
  const { user, role, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <h1>Loading...</h1>;
  }

  if (!FORCED_CHANGE_ROLES.includes(role)) return children;

  const mustChange = Boolean(user?.mustChangePassword);
  const changePath = `/${role}/change-password`;
  const onChangePage = location.pathname === changePath;

  if (mustChange && !onChangePage) {
    return <Navigate to={changePath} replace />;
  }

  if (!mustChange && onChangePage) {
    return <Navigate to={`/${role}`} replace />;
  }

  return children;
}
