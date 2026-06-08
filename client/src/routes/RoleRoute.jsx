import { Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

export default function RoleRoute({ children, allowedRole }) {
  const { role, loading } = useAuth();

  if (loading) {
    return <h1>Loading...</h1>;
  }

  if (role !== allowedRole) {
    switch (role) {
      case "parent":
        return <Navigate to="/parent" replace />;

      case "secretary":
        return <Navigate to="/secretary" replace />;

      case "doctor":
        return <Navigate to="/doctor" replace />;

      default:
        return <Navigate to="/" replace />;
    }
  }

  return children;
}