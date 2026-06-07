import { BrowserRouter, Routes, Route } from "react-router-dom";

import Login from "../pages/auth/Login";
import Register from "../pages/auth/Register";

import ParentDashboard from "../pages/parent/Dashboard";
import SecretaryDashboard from "../pages/secretary/Dashboard";
import DoctorDashboard from "../pages/doctor/Dashboard";

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/register" element={<Register />} />

        <Route path="/parent" element={<ParentDashboard />} />
        <Route path="/secretary" element={<SecretaryDashboard />} />
        <Route path="/doctor" element={<DoctorDashboard />} />
      </Routes>
    </BrowserRouter>
  );
}