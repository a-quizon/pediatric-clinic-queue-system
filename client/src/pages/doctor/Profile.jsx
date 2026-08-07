import React, { useState, useEffect } from "react";
import { useAuth } from "../../hooks/useAuth";
import { logoutUser, updateUserProfile, changeUserPassword } from "../../services/authService";
import { subscribeToBranchConfigurations } from "../../services/branchConfigurationService";
import { LogOut, User as UserIcon, Building, Edit2, Save, Shield, MapPin, X, Lock, Key } from "lucide-react";
import toast from "react-hot-toast";

export default function Profile() {
  const { user, role } = useAuth();
  
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const [fullName, setFullName] = useState(user?.displayName || user?.name || "");
  const [contactNumber, setContactNumber] = useState(user?.contactNumber || user?.phone || "");
  const [professionalTitle, setProfessionalTitle] = useState(user?.professionalTitle || "");
  const [clinicName, setClinicName] = useState(user?.clinicName || "L.A. Magat Pediatric Clinic");
  
  const [branches, setBranches] = useState([]);

  // Password state
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    const unsub = subscribeToBranchConfigurations((data) => {
      setBranches(data);
    });
    return () => unsub();
  }, []);

  const handleLogout = async () => {
    await logoutUser();
  };

  const handleSave = async () => {
    if (!fullName.trim()) {
      toast.error("Full Name is required.");
      return;
    }
    if (!contactNumber.trim()) {
      toast.error("Contact Number is required.");
      return;
    }
    if (!clinicName.trim()) {
      toast.error("Clinic Name is required.");
      return;
    }

    setIsSaving(true);
    try {
      await updateUserProfile(user.uid, {
        name: fullName.trim(),
        contactNumber: contactNumber.trim(),
        professionalTitle: professionalTitle.trim(),
        clinicName: clinicName.trim()
      });
      toast.success("Profile updated successfully!");
      setIsEditing(false);
    } catch (err) {
      console.error(err);
      toast.error("Failed to update profile.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setFullName(user?.displayName || user?.name || "");
    setContactNumber(user?.contactNumber || user?.phone || "");
    setProfessionalTitle(user?.professionalTitle || "");
    setClinicName(user?.clinicName || "L.A. Magat Pediatric Clinic");
    setIsEditing(false);
  };

  const handleUpdatePassword = async () => {
    if (!currentPassword) return toast.error("Current Password is required.");
    if (!newPassword) return toast.error("New Password is required.");
    if (!confirmPassword) return toast.error("Confirm Password is required.");
    if (newPassword !== confirmPassword) return toast.error("New Passwords do not match.");
    if (currentPassword === newPassword) return toast.error("New password must be different from current.");
    if (newPassword.length < 6) return toast.error("New password must be at least 6 characters.");

    setIsUpdatingPassword(true);
    try {
      await changeUserPassword(currentPassword, newPassword);
      toast.success("Password updated successfully!");
      setIsChangingPassword(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      console.error(err);
      if (err.code === "auth/invalid-credential" || err.code === "auth/wrong-password") {
        toast.error("Incorrect current password.");
      } else {
        toast.error(err.message || "Failed to update password.");
      }
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const hasChanges = 
    fullName.trim() !== (user?.displayName || user?.name || "") ||
    contactNumber.trim() !== (user?.contactNumber || user?.phone || "") ||
    professionalTitle.trim() !== (user?.professionalTitle || "") ||
    clinicName.trim() !== (user?.clinicName || "L.A. Magat Pediatric Clinic");

  return (
    <div className="space-y-6 pb-8 max-w-4xl mx-auto animate-in fade-in">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Doctor Profile</h1>
        <p className="text-gray-500 text-sm mt-0.5">Manage your personal and clinic information.</p>
      </div>

      {/* Unified Profile Information Card */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-6 md:p-8 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gray-50/30">
          <h2 className="text-lg font-bold text-gray-800 flex items-center">
            <UserIcon className="w-5 h-5 mr-2 text-blue-600" />
            Profile Information
          </h2>
          {isEditing ? (
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <button 
                onClick={handleCancel}
                disabled={isSaving}
                className="flex-1 sm:flex-none flex items-center justify-center text-sm font-bold text-gray-700 bg-white border border-gray-300 px-5 py-2.5 rounded-xl hover:bg-gray-50 transition-colors shadow-sm disabled:opacity-50"
              >
                <X className="w-4 h-4 mr-2" /> Cancel
              </button>
              <button 
                onClick={handleSave} 
                disabled={!hasChanges || isSaving}
                className="flex-1 sm:flex-none flex items-center justify-center text-sm font-bold text-white bg-blue-600 px-5 py-2.5 rounded-xl hover:bg-blue-700 transition-colors shadow-sm active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                Save Changes
              </button>
            </div>
          ) : (
            <button 
              onClick={() => setIsEditing(true)} 
              className="w-full sm:w-auto flex items-center justify-center text-sm font-bold text-gray-700 bg-white border border-gray-200 px-5 py-2.5 rounded-xl hover:bg-gray-50 transition-colors shadow-sm active:scale-95"
            >
              <Edit2 className="w-4 h-4 mr-2" /> Edit Information
            </button>
          )}
        </div>
        
        <div className="p-6 md:p-8 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
            {/* Account Information Fields */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                Full Name <span className="text-red-500">*</span>
              </label>
              {isEditing ? (
                <input 
                  type="text" 
                  value={fullName} 
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full font-semibold text-gray-800 bg-white px-4 py-3 rounded-xl border-2 border-blue-100 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all"
                  placeholder="e.g. Dr. Juan Dela Cruz"
                />
              ) : (
                <div className="font-semibold text-gray-800 bg-gray-50 px-4 py-3 rounded-xl border border-gray-100">
                  {user?.displayName || user?.name || "Not provided"}
                </div>
              )}
            </div>
            
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                Professional Title
              </label>
              {isEditing ? (
                <input 
                  type="text" 
                  value={professionalTitle} 
                  onChange={(e) => setProfessionalTitle(e.target.value)}
                  className="w-full font-semibold text-gray-800 bg-white px-4 py-3 rounded-xl border-2 border-blue-100 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all"
                  placeholder="e.g. Pediatrician"
                />
              ) : (
                <div className="font-semibold text-gray-800 bg-gray-50 px-4 py-3 rounded-xl border border-gray-100">
                  {user?.professionalTitle || "Not provided"}
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                Email Address
              </label>
              <div className="font-semibold text-gray-800 bg-gray-50 px-4 py-3 rounded-xl border border-gray-100 truncate opacity-70 cursor-not-allowed" title="Email address cannot be changed here">
                {user?.email || "Not provided"}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                Contact Number <span className="text-red-500">*</span>
              </label>
              {isEditing ? (
                <input 
                  type="text" 
                  value={contactNumber} 
                  onChange={(e) => setContactNumber(e.target.value)}
                  className="w-full font-semibold text-gray-800 bg-white px-4 py-3 rounded-xl border-2 border-blue-100 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all"
                  placeholder="e.g. +63 912 345 6789"
                />
              ) : (
                <div className="font-semibold text-gray-800 bg-gray-50 px-4 py-3 rounded-xl border border-gray-100">
                  {user?.contactNumber || user?.phone || "Not provided"}
                </div>
              )}
            </div>

            {/* Clinic Information Fields */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                Clinic Name <span className="text-red-500">*</span>
              </label>
              {isEditing ? (
                <input 
                  type="text" 
                  value={clinicName} 
                  onChange={(e) => setClinicName(e.target.value)}
                  className="w-full font-semibold text-gray-800 bg-white px-4 py-3 rounded-xl border-2 border-blue-100 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all"
                  placeholder="e.g. L.A. Magat Pediatric Clinic"
                />
              ) : (
                <div className="font-semibold text-gray-800 bg-gray-50 px-4 py-3 rounded-xl border border-gray-100">
                  {user?.clinicName || "L.A. Magat Pediatric Clinic"}
                </div>
              )}
            </div>
            
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                Role
              </label>
              <div className="font-semibold text-gray-800 bg-gray-50 px-4 py-3 rounded-xl border border-gray-100 flex items-center opacity-70">
                <Shield className="w-4 h-4 mr-2 text-blue-600" />
                Doctor / Clinic Owner
              </div>
            </div>
          </div>

          <div className="border-t border-gray-100 pt-8">
            <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center">
              <MapPin className="w-4 h-4 mr-2 text-gray-400" />
              Clinic Locations
            </h3>
            {branches.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                {branches.map(branch => (
                  <div key={branch.id} className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm hover:border-gray-300 transition-colors">
                    <h4 className="font-bold text-gray-800 mb-1">{branch.name} Branch</h4>
                    <p className="text-sm text-gray-500 leading-relaxed whitespace-pre-line">
                      {branch.clinicAddress || "Address not provided"}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-gray-500 italic p-4 bg-gray-50 rounded-xl border border-gray-100">
                No clinic branches have been configured yet. They will appear here once added by an administrator.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Security Information */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-6 md:p-8 border-b border-gray-100 bg-gray-50/30">
          <h2 className="text-lg font-bold text-gray-800 flex items-center">
            <Lock className="w-5 h-5 mr-2 text-blue-600" />
            Security
          </h2>
        </div>
        <div className="p-6 md:p-8">
          {!isChangingPassword ? (
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                  Password
                </label>
                <div className="font-semibold text-gray-800 flex items-center text-2xl tracking-widest pt-1 leading-none">
                  ••••••••••••
                </div>
              </div>
              <button 
                onClick={() => setIsChangingPassword(true)}
                className="w-full sm:w-auto flex items-center justify-center text-sm font-bold text-gray-700 bg-white border border-gray-200 px-5 py-2.5 rounded-xl hover:bg-gray-50 transition-colors shadow-sm active:scale-95"
              >
                <Key className="w-4 h-4 mr-2" /> Change Password
              </button>
            </div>
          ) : (
            <div className="max-w-md space-y-5 animate-in fade-in slide-in-from-top-2">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                  Current Password <span className="text-red-500">*</span>
                </label>
                <input 
                  type="password" 
                  value={currentPassword} 
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full font-semibold text-gray-800 bg-white px-4 py-3 rounded-xl border-2 border-blue-100 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all"
                  placeholder="Enter current password"
                />
              </div>
              
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                  New Password <span className="text-red-500">*</span>
                </label>
                <input 
                  type="password" 
                  value={newPassword} 
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full font-semibold text-gray-800 bg-white px-4 py-3 rounded-xl border-2 border-blue-100 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all"
                  placeholder="Enter new password"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                  Confirm New Password <span className="text-red-500">*</span>
                </label>
                <input 
                  type="password" 
                  value={confirmPassword} 
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full font-semibold text-gray-800 bg-white px-4 py-3 rounded-xl border-2 border-blue-100 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all"
                  placeholder="Confirm new password"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button 
                  onClick={() => {
                    setIsChangingPassword(false);
                    setCurrentPassword("");
                    setNewPassword("");
                    setConfirmPassword("");
                  }}
                  disabled={isUpdatingPassword}
                  className="flex-1 flex items-center justify-center text-sm font-bold text-gray-700 bg-white border border-gray-300 px-5 py-2.5 rounded-xl hover:bg-gray-50 transition-colors shadow-sm disabled:opacity-50"
                >
                  <X className="w-4 h-4 mr-2" /> Cancel
                </button>
                <button 
                  onClick={handleUpdatePassword} 
                  disabled={isUpdatingPassword || !currentPassword || !newPassword || !confirmPassword}
                  className="flex-1 flex items-center justify-center text-sm font-bold text-white bg-blue-600 px-5 py-2.5 rounded-xl hover:bg-blue-700 transition-colors shadow-sm active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isUpdatingPassword ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  Update Password
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="pt-4">
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center p-4 bg-white text-red-600 rounded-2xl font-bold border border-gray-200 shadow-sm hover:bg-red-50 hover:border-red-100 transition-colors active:scale-[0.98]"
        >
          <LogOut className="w-5 h-5 mr-2" />
          Sign Out
        </button>
      </div>
    </div>
  );
}
