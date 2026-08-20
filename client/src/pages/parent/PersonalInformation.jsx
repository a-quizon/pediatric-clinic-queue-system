import React, { useState, useEffect } from "react";
import { useAuth } from "../../hooks/useAuth";
import { formatName } from "../../utils/stringUtils";
import { updateUserProfile } from "../../services/authService";
import { User, Mail, Phone, Save, Lock, Shield, Key, Eye, EyeOff } from "lucide-react";
import { handlePasswordChangeRequest } from "../../utils/passwordUtils";
import { useNavigate } from "react-router-dom";
import InformationModal from "../../components/common/InformationModal";

export default function PersonalInformation() {
  const { user, updateContextUser } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [successModalOpen, setSuccessModalOpen] = useState(false);

  // Change Password Modal State
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccessModalOpen, setPasswordSuccessModalOpen] = useState(false);

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.fullName || user.displayName || user.name || "");
      setPhone(user.phoneNumber || user.phone || "");
    }
  }, [user]);

  const validate = () => {
    if (!name.trim()) {
      setError("Full Name is required.");
      return false;
    }
    
    if (!phone.trim() || phone.length !== 11) {
      setError("Phone number must be exactly 11 digits.");
      return false;
    }

    setError("");
    return true;
  };

  const handleSave = async () => {
    if (!validate()) return;

    setIsSaving(true);
    try {
      await updateUserProfile(user.uid, { name: formatName(name), phone: phone.trim() });
      updateContextUser({
        name: formatName(name),
        fullName: formatName(name),
        displayName: formatName(name),
        phone: phone.trim(),
        phoneNumber: phone.trim()
      });
      setSuccessModalOpen(true);
    } catch (err) {
      console.error("Failed to update profile:", err);
      setError("Failed to update profile. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handlePasswordSave = async () => {
    setIsChangingPassword(true);
    setPasswordError("");
    
    try {
      const result = await handlePasswordChangeRequest(currentPassword, newPassword, confirmPassword);
      
      if (result.success) {
        setPasswordModalOpen(false);
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setPasswordError("");
        setTimeout(() => setPasswordSuccessModalOpen(true), 150);
      } else {
        setPasswordError(result.error);
      }
    } catch (err) {
      console.error(err);
      setPasswordError("An unexpected error occurred. Please try again.");
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <div className="space-y-6 pb-8 max-w-2xl mx-auto mt-2">
      <div className="bg-white rounded-3xl border border-gray-100 shadow-xs p-6 sm:p-8 animate-in fade-in slide-in-from-bottom-4">
        
        {error && (
          <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-xl text-sm font-medium">
            {error}
          </div>
        )}

        <div className="space-y-6">
          {/* Full Name */}
          <div className="space-y-2">
            <label className="block text-sm font-bold text-gray-700 ml-1">Full Name</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <User className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none text-gray-800 font-medium"
                placeholder="Enter your full name"
              />
            </div>
          </div>

          {/* Email Address (Read-only) */}
          <div className="space-y-2">
            <label className="block text-sm font-bold text-gray-700 ml-1">Email Address</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Mail className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="email"
                value={user?.email || ""}
                disabled
                className="w-full pl-11 pr-4 py-3 bg-gray-100 border border-gray-200 rounded-2xl text-gray-500 font-medium cursor-not-allowed outline-none"
              />
            </div>
            <p className="text-xs text-gray-400 ml-1 mt-1">Email address cannot be changed.</p>
          </div>

          {/* Phone Number */}
          <div className="space-y-2">
            <label className="block text-sm font-bold text-gray-700 ml-1">Phone Number</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Phone className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="tel"
                maxLength={11}
                value={phone}
                onChange={(e) => {
                  const sanitized = e.target.value.replace(/\D/g, "");
                  setPhone(sanitized);
                }}
                className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none text-gray-800 font-medium"
                placeholder="09XXXXXXXXX"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="pt-6 flex flex-col items-center gap-3 border-t border-gray-50 mt-6">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-6 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 w-full sm:w-auto shadow-sm focus:outline-none min-w-[200px]"
            >
              {isSaving ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  Save Changes
                </>
              )}
            </button>
            <button
              onClick={() => {
                setPasswordError("");
                setCurrentPassword("");
                setNewPassword("");
                setConfirmPassword("");
                setPasswordModalOpen(true);
              }}
              className="text-sm font-bold text-blue-600 hover:text-blue-800 transition-colors mt-2"
            >
              Change Password
            </button>
          </div>
        </div>
      </div>

      <InformationModal
        isOpen={successModalOpen}
        onClose={() => setSuccessModalOpen(false)}
        title="Profile Updated"
        message="Your personal information has been successfully updated."
        buttonText="Okay"
      />

      <InformationModal
        isOpen={passwordSuccessModalOpen}
        onClose={() => setPasswordSuccessModalOpen(false)}
        title="Password Updated"
        message="Your password has been successfully changed."
        buttonText="Okay"
      />

      {/* Change Password Modal */}
      {passwordModalOpen && (
        <div 
          className="fixed inset-0 z-[60] flex items-center justify-center bg-gray-900/40 backdrop-blur-sm p-4 sm:p-6"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isChangingPassword) {
              setPasswordModalOpen(false);
            }
          }}
        >
          <div 
            className="bg-white rounded-3xl shadow-xl w-full max-w-md overflow-hidden flex flex-col transform transition-all animate-in fade-in zoom-in-95 duration-200"
            role="dialog"
            aria-modal="true"
          >
            <div className="p-6">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-full shrink-0 bg-purple-50">
                  <Shield className="w-6 h-6 text-purple-600" />
                </div>
                
                <div className="flex-1 mt-1">
                  <h2 className="text-xl font-bold text-gray-800">Change Password</h2>
                  <p className="mt-1 text-gray-600 text-sm">Update your account security.</p>
                </div>
              </div>

              <div className="mt-6 space-y-4">
                {passwordError && (
                  <div className="p-3 bg-red-50 text-red-600 rounded-xl text-sm font-medium">
                    {passwordError}
                  </div>
                )}

                <div className="space-y-1">
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Key className="h-4 w-4 text-gray-400" />
                    </div>
                    <input
                      type={showCurrentPassword ? "text" : "password"}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="w-full pl-9 pr-10 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all outline-none text-gray-800 text-sm"
                      placeholder="Current Password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 focus:outline-none"
                    >
                      {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Lock className="h-4 w-4 text-gray-400" />
                    </div>
                    <input
                      type={showNewPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full pl-9 pr-10 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all outline-none text-gray-800 text-sm"
                      placeholder="New Password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 focus:outline-none"
                    >
                      {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 px-1 pt-1">
                    Password must contain: 8+ characters • Uppercase • Lowercase • Number • Special character
                  </p>
                </div>

                <div className="space-y-1">
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Lock className="h-4 w-4 text-gray-400" />
                    </div>
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full pl-9 pr-10 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all outline-none text-gray-800 text-sm"
                      placeholder="Confirm New Password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 focus:outline-none"
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-5 border-t border-gray-100 bg-gray-50/50 flex justify-end gap-3 rounded-b-3xl">
              <button 
                onClick={() => setPasswordModalOpen(false)}
                disabled={isChangingPassword}
                className="px-5 py-2 text-gray-600 font-bold hover:bg-gray-200 rounded-xl transition-colors disabled:opacity-50 text-sm"
              >
                Cancel
              </button>
              <button 
                onClick={handlePasswordSave}
                disabled={isChangingPassword || !currentPassword || !newPassword || newPassword !== confirmPassword}
                className="px-5 py-2 font-bold rounded-xl shadow-sm transition-colors disabled:opacity-50 flex justify-center items-center bg-purple-600 hover:bg-purple-700 text-white text-sm min-w-[120px]"
              >
                {isChangingPassword ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : (
                  "Update"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
