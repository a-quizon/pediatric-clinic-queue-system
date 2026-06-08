import { BrowserRouter, Routes, Route } from "react-router-dom";

import ProtectedRoute from "./ProtectedRoute";

import Login from "../pages/auth/Login";
import Register from "../pages/auth/Register";

import ParentDashboard from "../pages/parent/Dashboard";
import SecretaryDashboard from "../pages/secretary/Dashboard";
import DoctorDashboard from "../pages/doctor/Dashboard";

import RoleRoute from "./RoleRoute";

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/parent" element={<ProtectedRoute> <RoleRoute allowedRole="parent"><ParentDashboard /></RoleRoute> </ProtectedRoute>} />
        <Route path="/secretary" element={<ProtectedRoute> <RoleRoute allowedRole="secretary"><SecretaryDashboard /></RoleRoute> </ProtectedRoute>} />
        <Route path="/doctor" element={<ProtectedRoute> <RoleRoute allowedRole="doctor"><DoctorDashboard /></RoleRoute> </ProtectedRoute>} />
      </Routes>
    </BrowserRouter>
  );
}