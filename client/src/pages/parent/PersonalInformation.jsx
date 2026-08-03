import React, { useState, useEffect } from "react";
import { useAuth } from "../../hooks/useAuth";
import { updateUserProfile } from "../../services/authService";
import { User, Mail, Phone, ArrowLeft, Save } from "lucide-react";
import { useNavigate } from "react-router-dom";
import InformationModal from "../../components/common/InformationModal";

export default function PersonalInformation() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [successModalOpen, setSuccessModalOpen] = useState(false);

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
    
    // Simple phone number validation (digits only, at least 10 chars usually)
    const phoneRegex = /^[0-9+\s-]{10,15}$/;
    if (!phone.trim() || !phoneRegex.test(phone)) {
      setError("Please enter a valid phone number.");
      return false;
    }

    setError("");
    return true;
  };

  const handleSave = async () => {
    if (!validate()) return;

    setIsSaving(true);
    try {
      await updateUserProfile(user.uid, { name: name.trim(), phone: phone.trim() });
      setSuccessModalOpen(true);
    } catch (err) {
      console.error("Failed to update profile:", err);
      setError("Failed to update profile. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleModalClose = () => {
    setSuccessModalOpen(false);
    navigate("/parent/profile");
  };

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
        <h1 className="text-3xl font-black text-gray-800 tracking-tight">Personal Information</h1>
      </div>

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
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none text-gray-800 font-medium"
                placeholder="09XXXXXXXXX"
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
              disabled={isSaving}
              className="px-6 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 w-full sm:w-auto shadow-sm focus:outline-none"
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
          </div>
        </div>
      </div>

      <InformationModal
        isOpen={successModalOpen}
        onClose={handleModalClose}
        title="Profile Updated"
        message="Your personal information has been successfully updated."
        buttonText="Back to Profile"
      />
    </div>
  );
}
