import React, { useState, useEffect } from "react";
import { changeUserPassword } from "../../services/authService";
import { Shield, Lock, ArrowLeft, Check, X, Key } from "lucide-react";
import { useNavigate } from "react-router-dom";
import InformationModal from "../../components/common/InformationModal";

export default function Security() {
  const navigate = useNavigate();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [successModalOpen, setSuccessModalOpen] = useState(false);

  // Password Policy Checklist
  const [policy, setPolicy] = useState({
    length: false,
    uppercase: false,
    lowercase: false,
    number: false,
    special: false
  });

  useEffect(() => {
    setPolicy({
      length: newPassword.length >= 8,
      uppercase: /[A-Z]/.test(newPassword),
      lowercase: /[a-z]/.test(newPassword),
      number: /[0-9]/.test(newPassword),
      special: /[!@#$%^&*(),.?":{}|<>]/.test(newPassword)
    });
  }, [newPassword]);

  const isPolicyMet = Object.values(policy).every(Boolean);

  const validate = () => {
    if (!currentPassword) {
      setError("Current Password is required.");
      return false;
    }
    if (!isPolicyMet) {
      setError("New password does not meet all requirements.");
      return false;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return false;
    }
    
    setError("");
    return true;
  };

  const handleSave = async () => {
    if (!validate()) return;

    setIsSaving(true);
    try {
      await changeUserPassword(currentPassword, newPassword);
      setSuccessModalOpen(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      console.error("Failed to change password:", err);
      if (err.code === "auth/wrong-password" || err.code === "auth/invalid-credential") {
        setError("Current password is incorrect.");
      } else if (err.code === "auth/too-many-requests") {
        setError("Too many attempts. Please try again later.");
      } else {
        setError("Failed to update password. Please try again.");
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleModalClose = () => {
    setSuccessModalOpen(false);
    navigate("/parent/profile");
  };

  const PolicyItem = ({ met, label }) => (
    <div className={`flex items-center gap-2 text-sm font-medium ${met ? 'text-green-600' : 'text-gray-400'}`}>
      {met ? <Check className="w-4 h-4 flex-shrink-0" /> : <X className="w-4 h-4 flex-shrink-0" />}
      <span>{label}</span>
    </div>
  );

  return (
    <div className="space-y-6 pb-8 max-w-2xl mx-auto mt-4 px-2">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button 
          onClick={() => navigate("/parent/profile")}
          className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center hover:bg-gray-100 transition-colors focus:outline-none"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <h1 className="text-3xl font-black text-gray-800 tracking-tight">Security</h1>
      </div>

      <div className="bg-white rounded-3xl border border-gray-100 shadow-xs p-6 sm:p-8 animate-in fade-in slide-in-from-bottom-4">
        
        {error && (
          <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-xl text-sm font-medium">
            {error}
          </div>
        )}

        <div className="space-y-6">
          {/* Current Password */}
          <div className="space-y-2">
            <label className="block text-sm font-bold text-gray-700 ml-1">Current Password</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Key className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl focus:bg-white focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all outline-none text-gray-800 font-medium"
                placeholder="Enter current password"
              />
            </div>
          </div>

          <div className="h-px bg-gray-100 my-4 w-full"></div>

          {/* New Password */}
          <div className="space-y-2">
            <label className="block text-sm font-bold text-gray-700 ml-1">New Password</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Shield className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl focus:bg-white focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all outline-none text-gray-800 font-medium"
                placeholder="Create new password"
              />
            </div>
          </div>

          {/* Password Policy Checklist */}
          <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100 grid grid-cols-1 sm:grid-cols-2 gap-2">
            <PolicyItem met={policy.length} label="Minimum 8 characters" />
            <PolicyItem met={policy.uppercase} label="Uppercase Letter" />
            <PolicyItem met={policy.lowercase} label="Lowercase Letter" />
            <PolicyItem met={policy.number} label="Number" />
            <PolicyItem met={policy.special} label="Special Character" />
          </div>

          {/* Confirm Password */}
          <div className="space-y-2">
            <label className="block text-sm font-bold text-gray-700 ml-1">Confirm Password</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl focus:bg-white focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all outline-none text-gray-800 font-medium"
                placeholder="Confirm new password"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="pt-6 flex flex-col-reverse sm:flex-row justify-end gap-3 border-t border-gray-50">
            <button
              onClick={() => navigate("/parent/profile")}
              className="px-6 py-3 text-gray-600 font-bold hover:bg-gray-100 rounded-xl transition-colors w-full sm:w-auto focus:outline-none"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || !isPolicyMet || !currentPassword || (newPassword !== confirmPassword && confirmPassword.length > 0)}
              className="px-6 py-3 bg-purple-600 text-white font-bold rounded-xl hover:bg-purple-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 w-full sm:w-auto shadow-sm focus:outline-none"
            >
              {isSaving ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                <>
                  <Shield className="w-5 h-5" />
                  Change Password
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      <InformationModal
        isOpen={successModalOpen}
        onClose={handleModalClose}
        title="Security Updated"
        message="Your password has been successfully changed."
        buttonText="Back to Profile"
      />
    </div>
  );
}
