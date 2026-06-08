import { useAuth } from "../../hooks/useAuth";
import { logoutUser } from "../../services/authService";


export default function Dashboard() {
  const { user, role } = useAuth();

  return (
    <div>
      <h1>Doctor Dashboard</h1>

      <p>Email: {user?.email}</p>

      <p>Role: {role}</p>
      <button onClick={async () => { await logoutUser(); }}> Logout </button>
    </div>
  );
}