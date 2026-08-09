import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import ProtectedRoute from "./ProtectedRoute";

import Login from "../pages/auth/Login";
import Register from "../pages/auth/Register";
import ForgotPassword from "../pages/auth/ForgotPassword";
import ResetPassword from "../pages/auth/ResetPassword";

// Parent Layout and Pages
import ParentLayout from "../components/parent/ParentLayout";
import ParentDashboard from "../pages/parent/Dashboard";
import ParentReserveQueue from "../pages/parent/ReserveQueue";
import ParentMyReservation from "../pages/parent/MyReservation";
import ParentProfile from "../pages/parent/Profile";
import ParentReservationHistory from "../pages/parent/ReservationHistory";
import ParentPersonalInformation from "../pages/parent/PersonalInformation";
import ParentNotifications from "../pages/parent/ParentNotifications";

import SecretaryLayout from "../components/secretary/SecretaryLayout";
import SecretaryDashboard from "../pages/secretary/Dashboard";
import SecretaryValidateReservation from "../pages/secretary/ValidateReservation";
import SecretaryManageQueue from "../pages/secretary/ManageQueue";

import SecretaryProfile from "../pages/secretary/Profile";
// Doctor Layout and Pages
import DoctorLayout from "../components/doctor/Layout";
import DoctorHome from "../pages/doctor/Home";
import DoctorSchedules from "../pages/doctor/Schedules";
import DoctorQueue from "../pages/doctor/Queue";
import DoctorReports from "../pages/doctor/Reports";
import DoctorProfile from "../pages/doctor/Profile";

// Admin Layout and Pages
import AdminLayout from "../components/admin/AdminLayout";
import AdminDashboard from "../pages/admin/Dashboard";
import AdminUserManagement from "../pages/admin/UserManagement";
import AdminBranchManagement from "../pages/admin/BranchManagement";
import AdminActivity from "../pages/admin/Activity";
import AdminSystemSettings from "../pages/admin/SystemSettings";
import AdminProfile from "../pages/admin/Profile";

import RoleRoute from "./RoleRoute";

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        
        {/* Parent Routes */}
        <Route path="/parent" element={<ProtectedRoute> <RoleRoute allowedRole="parent"><ParentLayout /></RoleRoute> </ProtectedRoute>}>
          <Route index element={<ParentDashboard />} />
          <Route path="reserve" element={<ParentReserveQueue />} />
          <Route path="reservations" element={<ParentMyReservation />} />
          <Route path="reservations/:id/qr" element={<Navigate to="/parent/reservations" replace />} />
          <Route path="profile" element={<ParentProfile />} />
          <Route path="profile/personal-info" element={<ParentPersonalInformation />} />
          <Route path="profile/history" element={<ParentReservationHistory />} />
          <Route path="notifications" element={<ParentNotifications />} />
        </Route>

        {/* Secretary Routes */}
        <Route path="/secretary" element={<ProtectedRoute> <RoleRoute allowedRole="secretary"><SecretaryLayout /></RoleRoute> </ProtectedRoute>}>
          <Route index element={<SecretaryDashboard />} />
          <Route path="validate" element={<SecretaryValidateReservation />} />
          <Route path="queue" element={<SecretaryManageQueue />} />

          <Route path="profile" element={<SecretaryProfile />} />
        </Route>
        
        {/* Doctor Routes */}
        <Route path="/doctor" element={<ProtectedRoute> <RoleRoute allowedRole="doctor"><DoctorLayout /></RoleRoute> </ProtectedRoute>}>
          <Route index element={<DoctorHome />} />
          <Route path="schedules" element={<DoctorSchedules />} />
          <Route path="queue" element={<DoctorQueue />} />
          <Route path="reports" element={<DoctorReports />} />

          <Route path="profile" element={<DoctorProfile />} />
        </Route>

        {/* Admin Routes */}
        <Route path="/admin" element={<ProtectedRoute> <RoleRoute allowedRole="admin"><AdminLayout /></RoleRoute> </ProtectedRoute>}>
          <Route index element={<AdminDashboard />} />
          <Route path="users" element={<AdminUserManagement />} />
          <Route path="branches" element={<AdminBranchManagement />} />
          <Route path="activity" element={<AdminActivity />} />
          <Route path="settings" element={<AdminSystemSettings />} />
          <Route path="profile" element={<AdminProfile />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}