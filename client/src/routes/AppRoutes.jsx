import { BrowserRouter, Routes, Route } from "react-router-dom";

import ProtectedRoute from "./ProtectedRoute";

import Login from "../pages/auth/Login";
import Register from "../pages/auth/Register";

// Parent Layout and Pages
import ParentLayout from "../components/parent/ParentLayout";
import ParentDashboard from "../pages/parent/Dashboard";
import ParentReserveQueue from "../pages/parent/ReserveQueue";
import ParentMyReservations from "../pages/parent/MyReservations";
import ParentProfile from "../pages/parent/Profile";

import SecretaryDashboard from "../pages/secretary/Dashboard";

// Doctor Layout and Pages
import DoctorLayout from "../components/doctor/Layout";
import DoctorHome from "../pages/doctor/Home";
import DoctorSchedules from "../pages/doctor/Schedules";
import DoctorQueue from "../pages/doctor/Queue";
import DoctorConsultations from "../pages/doctor/Consultations";
import DoctorReports from "../pages/doctor/Reports";
import DoctorProfile from "../pages/doctor/Profile";

import RoleRoute from "./RoleRoute";

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/register" element={<Register />} />
        
        {/* Parent Routes */}
        <Route path="/parent" element={<ProtectedRoute> <RoleRoute allowedRole="parent"><ParentLayout /></RoleRoute> </ProtectedRoute>}>
          <Route index element={<ParentDashboard />} />
          <Route path="reserve" element={<ParentReserveQueue />} />
          <Route path="reservations" element={<ParentMyReservations />} />
          <Route path="profile" element={<ParentProfile />} />
        </Route>

        <Route path="/secretary" element={<ProtectedRoute> <RoleRoute allowedRole="secretary"><SecretaryDashboard /></RoleRoute> </ProtectedRoute>} />
        
        {/* Doctor Routes */}
        <Route path="/doctor" element={<ProtectedRoute> <RoleRoute allowedRole="doctor"><DoctorLayout /></RoleRoute> </ProtectedRoute>}>
          <Route index element={<DoctorHome />} />
          <Route path="schedules" element={<DoctorSchedules />} />
          <Route path="queue" element={<DoctorQueue />} />
          <Route path="consultations" element={<DoctorConsultations />} />
          <Route path="reports" element={<DoctorReports />} />
          <Route path="profile" element={<DoctorProfile />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}