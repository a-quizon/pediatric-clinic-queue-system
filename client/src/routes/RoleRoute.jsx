import { Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

export default function RoleRoute({ children, allowedRole, allowedRoles }) {
  const { role, loading } = useAuth();
  const roles = allowedRoles || (allowedRole ? [allowedRole] : []);

  if (loading) {
    return <h1>Loading...</h1>;
  }

  if (!roles.includes(role)) {
    switch (role) {
      case "parent":
        return <Navigate to="/parent" replace />;

      case "secretary":
        return <Navigate to="/secretary" replace />;

      case "doctor":
      case "admin":
        // Transition: leftover admin accounts use doctor clinic-admin surfaces
        return <Navigate to="/doctor" replace />;

      default:
        return <Navigate to="/" replace />;
    }
  }

  return children;
}
