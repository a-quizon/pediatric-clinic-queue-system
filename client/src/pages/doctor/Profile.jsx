import React, { useState, useEffect } from "react";
import { useAuth } from "../../hooks/useAuth";
import { updateUserProfile } from "../../services/authService";
import { subscribeToBranchConfigurations } from "../../services/branchConfigurationService";
import { handlePasswordChangeRequest } from "../../utils/passwordUtils";
import { LogOut, User as UserIcon, Edit2, Save, MapPin, X, Lock, ChevronRight, Info, ArrowLeft, BarChart3 } from "lucide-react";
import { useSearchParams, useNavigate } from "react-router-dom";
import LogoutButton from "../../components/common/LogoutButton";
import toast from "react-hot-toast";

export default function Profile() {
  const { user } = useAuth();
  
  const [isSaving, setIsSaving] = useState(false);
  
  const [fullName, setFullName] = useState(user?.displayName || user?.name || "");
  const [contactNumber, setContactNumber] = useState(user?.contactNumber || user?.phone || "");
  const [professionalTitle, setProfessionalTitle] = useState(user?.professionalTitle || "");
  const [clinicName, setClinicName] = useState(user?.clinicName || "L.A. Magat Pediatric Clinic");
  
  const [branches, setBranches] = useState([]);

  // Password state
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Mobile navigation state via URL params
  const [searchParams, setSearchParams] = useSearchParams();
  const mobileView = searchParams.get("view") || "hub";
  const navigate = useNavigate();

  const setMobileView = (view) => {
    if (view === "hub") {
      setSearchParams({});
    } else {
      setSearchParams({ view });
    }
  };

  useEffect(() => {
    const unsub = subscribeToBranchConfigurations((data) => {
      setBranches(data);
    });
    return () => unsub();
  }, []);

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
    } catch (err) {
      console.error(err);
      toast.error("Failed to update profile.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdatePassword = async () => {
    setIsUpdatingPassword(true);
    try {
      const result = await handlePasswordChangeRequest(currentPassword, newPassword, confirmPassword);
      
      if (result.success) {
        toast.success("Password updated successfully!");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        toast.error(result.error);
      }
    } catch (err) {
      console.error(err);
      toast.error("An unexpected error occurred. Please try again.");
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const hasChanges = 
    fullName.trim() !== (user?.displayName || user?.name || "") ||
    contactNumber.trim() !== (user?.contactNumber || user?.phone || "") ||
    professionalTitle.trim() !== (user?.professionalTitle || "") ||
    clinicName.trim() !== (user?.clinicName || "L.A. Magat Pediatric Clinic");

  const getInitials = (name) => {
    if (!name) return "U";
    const cleanName = name.replace(/^Dr\.?\s+/i, "");
    const parts = cleanName.trim().split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return cleanName.substring(0, 2).toUpperCase();
  };

  const renderMobileSummary = () => {
    const currentName = user?.displayName || user?.name || "Doctor";
    const initials = getInitials(currentName);
    
    return (
      <div className="flex flex-col items-center justify-center pt-4 pb-8 text-center">
        <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-blue-700 text-white rounded-full flex items-center justify-center text-3xl font-bold shadow-lg mb-4 ring-4 ring-blue-50">
          {initials}
        </div>
        <h2 className="text-xl font-bold text-gray-800">{currentName}</h2>
        <p className="text-sm text-gray-500 mt-1">{user?.email}</p>
      </div>
    );
  };

  const renderProfileCard = () => (
    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="p-6 md:p-8 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gray-50/30">
        <h2 className="text-lg font-bold text-gray-800 flex items-center">
          <UserIcon className="w-5 h-5 mr-2 text-blue-600" />
          Profile Information
        </h2>
      </div>
      
      <div className="p-6 md:p-8 space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
              Full Name <span className="text-red-500">*</span>
            </label>
            <input 
              type="text" 
              value={fullName} 
              onChange={(e) => setFullName(e.target.value)}
              className="w-full font-semibold text-gray-800 bg-white px-4 py-3 rounded-xl border-2 border-blue-100 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all"
              placeholder="e.g. Dr. Juan Dela Cruz"
            />
          </div>
          
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
              Professional Title
            </label>
            <input 
              type="text" 
              value={professionalTitle} 
              onChange={(e) => setProfessionalTitle(e.target.value)}
              className="w-full font-semibold text-gray-800 bg-white px-4 py-3 rounded-xl border-2 border-blue-100 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all"
              placeholder="e.g. Pediatrician"
            />
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
            <input 
              type="text" 
              value={contactNumber} 
              onChange={(e) => setContactNumber(e.target.value)}
              className="w-full font-semibold text-gray-800 bg-white px-4 py-3 rounded-xl border-2 border-blue-100 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all"
              placeholder="e.g. +63 912 345 6789"
            />
          </div>

          <div className="space-y-1.5 md:col-span-2">
            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
              Clinic Name <span className="text-red-500">*</span>
            </label>
            <input 
              type="text" 
              value={clinicName} 
              onChange={(e) => setClinicName(e.target.value)}
              className="w-full font-semibold text-gray-800 bg-white px-4 py-3 rounded-xl border-2 border-blue-100 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all"
              placeholder="e.g. L.A. Magat Pediatric Clinic"
            />
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

        <div className="pt-6 border-t border-gray-100 flex justify-end">
          <button 
            onClick={handleSave} 
            disabled={!hasChanges || isSaving}
            className="w-full sm:w-auto flex items-center justify-center text-sm font-bold text-white bg-blue-600 px-6 py-3 rounded-xl hover:bg-blue-700 transition-colors shadow-sm active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Save Information
          </button>
        </div>
      </div>
    </div>
  );

  const renderSecurityCard = () => (
    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="p-6 md:p-8 border-b border-gray-100 bg-gray-50/30">
        <h2 className="text-lg font-bold text-gray-800 flex items-center">
          <Lock className="w-5 h-5 mr-2 text-blue-600" />
          Security
        </h2>
      </div>
      <div className="p-6 md:p-8">
        <div className="max-w-md space-y-5">
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

          <div className="pt-2">
            <button 
              onClick={handleUpdatePassword} 
              disabled={isUpdatingPassword || !currentPassword || !newPassword || !confirmPassword}
              className="w-full sm:w-auto flex items-center justify-center text-sm font-bold text-white bg-blue-600 px-6 py-3 rounded-xl hover:bg-blue-700 transition-colors shadow-sm active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
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
      </div>
    </div>
  );

  return (
    <>
      {/* --- DESKTOP VIEW --- */}
      <div className="hidden md:block space-y-6 pb-8 max-w-4xl mx-auto animate-in fade-in">
        {renderProfileCard()}
        {renderSecurityCard()}
        <div className="pt-4">
          <LogoutButton />
        </div>
      </div>

      {/* --- MOBILE VIEW --- */}
      <div className="block md:hidden pb-8 animate-in fade-in">
        {mobileView === "hub" && (
          <div className="space-y-4">
            {renderMobileSummary()}
            
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden p-2">
              <button onClick={() => setMobileView("account")} className="w-full flex items-center justify-between p-4 hover:bg-gray-50 rounded-2xl transition-colors">
                <div className="flex items-center">
                  <div className="bg-blue-50 p-3 rounded-xl mr-4">
                    <UserIcon className="w-6 h-6 text-blue-600" />
                  </div>
                  <div className="text-left">
                    <h3 className="font-bold text-gray-800 text-base">Account Settings</h3>
                    <p className="text-xs text-gray-500 mt-0.5">Manage account & clinic details</p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400" />
              </button>

              <button onClick={() => navigate("/doctor/reports")} className="w-full flex items-center justify-between p-4 hover:bg-gray-50 rounded-2xl transition-colors mt-1">
                <div className="flex items-center">
                  <div className="bg-green-50 p-3 rounded-xl mr-4">
                    <BarChart3 className="w-6 h-6 text-green-600" />
                  </div>
                  <div className="text-left">
                    <h3 className="font-bold text-gray-800 text-base">Reports & Analytics</h3>
                    <p className="text-xs text-gray-500 mt-0.5">View clinic performance data</p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400" />
              </button>

              <button onClick={() => setMobileView("system")} className="w-full flex items-center justify-between p-4 hover:bg-gray-50 rounded-2xl transition-colors mt-1">
                <div className="flex items-center">
                  <div className="bg-purple-50 p-3 rounded-xl mr-4">
                    <Info className="w-6 h-6 text-purple-600" />
                  </div>
                  <div className="text-left">
                    <h3 className="font-bold text-gray-800 text-base">About System</h3>
                    <p className="text-xs text-gray-500 mt-0.5">App version and information</p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            
            <div className="pt-2">
              <LogoutButton />
            </div>
          </div>
        )}

        {mobileView === "account" && (
          <div className="space-y-6 slide-in-from-right-4 animate-in fade-in">
            {renderProfileCard()}
            {renderSecurityCard()}
          </div>
        )}

        {mobileView === "system" && (
          <div className="space-y-6 slide-in-from-right-4 animate-in fade-in">
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden p-8 text-center mt-2">
              <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-3xl flex items-center justify-center mx-auto mb-5">
                <Info className="w-10 h-10" />
              </div>
              <h3 className="text-lg font-bold text-gray-800">Pediatric Clinic Queue System</h3>
              <p className="text-sm text-gray-500 mt-2 mb-8 px-4">A modern solution for managing clinic queues and schedules.</p>
              
              <div className="bg-gray-50 rounded-2xl p-4 flex justify-between items-center text-sm border border-gray-100">
                <span className="font-bold text-gray-500 uppercase tracking-wider text-[11px]">Application Version</span>
                <span className="font-bold text-gray-800">v1.0.0</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
