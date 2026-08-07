import React, { useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { logoutUser } from "../../services/authService";
import { LogOut, User as UserIcon, Building, Edit2, Save, Shield, MapPin } from "lucide-react";

export default function Profile() {
  const { user, role } = useAuth();
  
  const [isEditing, setIsEditing] = useState(false);
  const [contactNumber, setContactNumber] = useState(user?.contactNumber || "+63");
  const [professionalTitle, setProfessionalTitle] = useState(user?.professionalTitle || "Pediatrician");

  const handleLogout = async () => {
    await logoutUser();
  };

  const handleSave = () => {
    setIsEditing(false);
    // In Phase 1, we just exit edit mode. Data persistence logic is out of scope.
  };

  return (
    <div className="space-y-6 pb-8 max-w-4xl mx-auto animate-in fade-in">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Doctor Profile</h1>
        <p className="text-gray-500 text-sm mt-0.5">Manage your personal and clinic information.</p>
      </div>

      {/* Account Information */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-6 md:p-8 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gray-50/30">
          <h2 className="text-lg font-bold text-gray-800 flex items-center">
            <UserIcon className="w-5 h-5 mr-2 text-blue-600" />
            Account Information
          </h2>
          {isEditing ? (
            <button 
              onClick={handleSave} 
              className="w-full sm:w-auto flex items-center justify-center text-sm font-bold text-white bg-blue-600 px-5 py-2.5 rounded-xl hover:bg-blue-700 transition-colors shadow-sm active:scale-95"
            >
              <Save className="w-4 h-4 mr-2" /> Save Changes
            </button>
          ) : (
            <button 
              onClick={() => setIsEditing(true)} 
              className="w-full sm:w-auto flex items-center justify-center text-sm font-bold text-gray-700 bg-white border border-gray-200 px-5 py-2.5 rounded-xl hover:bg-gray-50 transition-colors shadow-sm active:scale-95"
            >
              <Edit2 className="w-4 h-4 mr-2" /> Edit Profile
            </button>
          )}
        </div>
        
        <div className="p-6 md:p-8 grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
              Full Name
            </label>
            <div className="font-semibold text-gray-800 bg-gray-50 px-4 py-3 rounded-xl border border-gray-100">
              {user?.displayName || "Dr. L.A. Magat"}
            </div>
          </div>
          
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
              Email Address
            </label>
            <div className="font-semibold text-gray-800 bg-gray-50 px-4 py-3 rounded-xl border border-gray-100 truncate">
              {user?.email || "doctor@clinic.com"}
            </div>
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
              <div className="font-semibold text-gray-800 bg-white px-4 py-3 rounded-xl border border-gray-200">
                {professionalTitle}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
              Contact Number
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
              <div className="font-semibold text-gray-800 bg-white px-4 py-3 rounded-xl border border-gray-200">
                {contactNumber}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Clinic Information */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-6 md:p-8 border-b border-gray-100 bg-gray-50/30">
          <h2 className="text-lg font-bold text-gray-800 flex items-center">
            <Building className="w-5 h-5 mr-2 text-blue-600" />
            Clinic Information
          </h2>
        </div>
        <div className="p-6 md:p-8 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                Clinic Name
              </label>
              <div className="font-semibold text-gray-800 bg-gray-50 px-4 py-3 rounded-xl border border-gray-100">
                L.A. Magat Pediatric Clinic
              </div>
            </div>
            
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                Role
              </label>
              <div className="font-semibold text-gray-800 bg-gray-50 px-4 py-3 rounded-xl border border-gray-100 flex items-center">
                <Shield className="w-4 h-4 mr-2 text-blue-600" />
                Doctor / Clinic Owner
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center">
              <MapPin className="w-4 h-4 mr-2 text-gray-400" />
              Clinic Locations
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm hover:border-gray-300 transition-colors">
                <h4 className="font-bold text-gray-800 mb-1">Angeles Branch</h4>
                <p className="text-sm text-gray-500 leading-relaxed">
                  Angeles City, Pampanga
                </p>
              </div>
              <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm hover:border-gray-300 transition-colors">
                <h4 className="font-bold text-gray-800 mb-1">Magalang Branch</h4>
                <p className="text-sm text-gray-500 leading-relaxed">
                  Magalang, Pampanga
                </p>
              </div>
            </div>
          </div>
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
