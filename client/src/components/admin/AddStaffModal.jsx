import React, { useState } from "react";
import { X, UserPlus, Stethoscope, UserCog, Mail, Phone, Lock, MapPin, Eye, EyeOff } from "lucide-react";
import toast from "react-hot-toast";
import { createStaffAccount } from "../../services/adminService";

export default function AddStaffModal({ isOpen, onClose, onSuccess }) {
  const [step, setStep] = useState(1);
  const [role, setRole] = useState(null); // 'doctor' or 'secretary'
  
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    assignedBranch: ""
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const resetState = () => {
    setStep(1);
    setRole(null);
    setFormData({
      name: "",
      email: "",
      phone: "",
      password: "",
      confirmPassword: "",
      assignedBranch: ""
    });
    setShowPassword(false);
    setShowConfirmPassword(false);
  };

  const handleClose = () => {
    if (!loading) {
      resetState();
      onClose();
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleContinue = () => {
    if (!role) {
      toast.error("Please select a role to continue.");
      return;
    }
    setStep(2);
  };

  const validateForm = () => {
    const { name, email, phone, password, confirmPassword, assignedBranch } = formData;
    if (!name.trim()) return "Name is required.";
    if (!email.trim() || !/^\S+@\S+\.\S+$/.test(email)) return "A valid email is required.";
    if (!phone.trim()) return "Phone number is required.";
    
    if (!password) return "Password is required.";
    if (password.length < 6) return "Password must be at least 6 characters long.";
    if (password !== confirmPassword) return "Passwords do not match.";

    if (role === "secretary" && !assignedBranch) {
      return "Assigned Branch is required for Secretary.";
    }

    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errorMsg = validateForm();
    if (errorMsg) {
      toast.error(errorMsg);
      return;
    }

    setLoading(true);
    try {
      await createStaffAccount({
        role,
        name: formData.name.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim(),
        password: formData.password,
        assignedBranch: role === "secretary" ? formData.assignedBranch : undefined
      });
      
      toast.success(`${role.charAt(0).toUpperCase() + role.slice(1)} account created successfully!`);
      resetState();
      onSuccess(); // Close and refresh
    } catch (error) {
      console.error("Create Staff Error:", error);
      let errMsg = error.message;
      if (error.code === 'auth/email-already-in-use') {
        errMsg = "The email address is already in use by another account.";
      }
      toast.error(errMsg || "An error occurred while creating the account.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex justify-between items-center p-5 border-b border-gray-100 bg-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-800">
                {step === 1 ? "Add Staff" : `Create ${role.charAt(0).toUpperCase() + role.slice(1)}`}
              </h2>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                {step === 1 ? "Step 1 of 2" : "Step 2 of 2"}
              </p>
            </div>
          </div>
          <button 
            onClick={handleClose}
            disabled={loading}
            className="text-gray-400 hover:text-gray-600 transition-colors p-2 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto">
          {step === 1 ? (
            <div className="space-y-4">
              <p className="text-sm text-gray-600 font-medium mb-2">Select the role for the new staff member:</p>
              
              <button
                onClick={() => setRole("doctor")}
                className={`w-full flex items-center p-4 rounded-xl border-2 transition-all text-left ${
                  role === "doctor" 
                    ? "border-blue-600 bg-blue-50" 
                    : "border-gray-200 hover:border-blue-300 hover:bg-gray-50"
                }`}
              >
                <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 mr-4 ${
                  role === "doctor" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-500"
                }`}>
                  <Stethoscope className="w-6 h-6" />
                </div>
                <div>
                  <h3 className={`font-bold ${role === "doctor" ? "text-blue-900" : "text-gray-800"}`}>Doctor</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Manages clinic schedules, consultations, and queue status.</p>
                </div>
              </button>

              <button
                onClick={() => setRole("secretary")}
                className={`w-full flex items-center p-4 rounded-xl border-2 transition-all text-left ${
                  role === "secretary" 
                    ? "border-blue-600 bg-blue-50" 
                    : "border-gray-200 hover:border-blue-300 hover:bg-gray-50"
                }`}
              >
                <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 mr-4 ${
                  role === "secretary" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-500"
                }`}>
                  <UserCog className="w-6 h-6" />
                </div>
                <div>
                  <h3 className={`font-bold ${role === "secretary" ? "text-blue-900" : "text-gray-800"}`}>Secretary</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Validates reservations, manages the waiting queue, and assists patients.</p>
                </div>
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} id="staff-form" className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Full Name <span className="text-red-500">*</span></label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <UserPlus className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    disabled={loading}
                    className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 text-gray-800 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-colors outline-none"
                    placeholder="Enter full name"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Email Address <span className="text-red-500">*</span></label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    disabled={loading}
                    className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 text-gray-800 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-colors outline-none"
                    placeholder="Enter email address"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Phone Number <span className="text-red-500">*</span></label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Phone className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    required
                    disabled={loading}
                    className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 text-gray-800 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-colors outline-none"
                    placeholder="Enter phone number"
                  />
                </div>
              </div>

              {role === "secretary" && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Assigned Branch <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                      <MapPin className="h-5 w-5 text-gray-400" />
                    </div>
                    <select
                      name="assignedBranch"
                      value={formData.assignedBranch}
                      onChange={handleChange}
                      required
                      disabled={loading}
                      className="w-full pl-10 pr-10 py-2.5 bg-gray-50 border border-gray-200 text-gray-800 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-colors outline-none appearance-none"
                    >
                      <option value="" disabled>Select assigned branch</option>
                      <option value="Angeles">Angeles</option>
                      <option value="Magalang">Magalang</option>
                    </select>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Password <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                      <Lock className="h-4 w-4 text-gray-400" />
                    </div>
                    <input
                      type={showPassword ? "text" : "password"}
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      required
                      minLength={6}
                      disabled={loading}
                      className="w-full pl-9 pr-10 py-2.5 bg-gray-50 border border-gray-200 text-gray-800 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-colors outline-none text-sm"
                      placeholder="Min 6 chars"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Confirm Password <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                      <Lock className="h-4 w-4 text-gray-400" />
                    </div>
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      name="confirmPassword"
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      required
                      minLength={6}
                      disabled={loading}
                      className={`w-full pl-9 pr-10 py-2.5 bg-gray-50 border rounded-xl outline-none text-sm transition-colors ${
                        formData.confirmPassword && formData.password !== formData.confirmPassword 
                          ? 'border-red-300 focus:ring-red-500/20 focus:border-red-500' 
                          : 'border-gray-200 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white'
                      }`}
                      placeholder="Confirm"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-gray-100 bg-gray-50 flex gap-3 justify-end mt-auto">
          {step === 2 && (
            <button 
              type="button"
              onClick={() => setStep(1)}
              disabled={loading}
              className="px-5 py-2.5 text-gray-600 font-semibold bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Back
            </button>
          )}
          
          {step === 1 ? (
            <button 
              type="button"
              onClick={handleContinue}
              disabled={!role}
              className="px-5 py-2.5 text-white font-bold bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              Continue
            </button>
          ) : (
            <button 
              type="submit"
              form="staff-form"
              disabled={loading}
              className="px-5 py-2.5 text-white font-bold bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors flex items-center disabled:opacity-70"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Creating...
                </>
              ) : "Create Account"}
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
