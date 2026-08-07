import React from "react";
import { User, Mail, Shield, Settings, LogOut } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import LogoutButton from "../../components/common/LogoutButton";

export default function Profile() {
  const { user, role } = useAuth();

  if (!user) return null;

  return (
    <div className="space-y-6 pb-6 max-w-3xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Admin Profile</h1>
        <p className="text-gray-500 mt-1">Manage your administrator account settings</p>
      </div>

      {/* Profile Information */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-6 md:p-8 flex flex-col md:flex-row items-center md:items-start gap-6">
          <div className="w-24 h-24 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center shrink-0">
            <User className="w-10 h-10" />
          </div>
          <div className="flex-1 text-center md:text-left">
            <h2 className="text-xl font-bold text-gray-800">Administrator Account</h2>
            <div className="inline-block mt-2 px-3 py-1 bg-green-50 text-green-700 text-xs font-semibold rounded-full border border-green-100">
              Active Status
            </div>
          </div>
          <button className="flex items-center justify-center px-4 py-2 bg-white text-gray-600 text-sm font-semibold rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors">
            <Settings className="w-4 h-4 mr-2" />
            Settings
          </button>
        </div>

        <div className="border-t border-gray-50 grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-gray-50">
          <div className="p-6 flex items-start">
            <Mail className="w-5 h-5 text-gray-400 mr-4 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Email Address</p>
              <p className="text-gray-800 font-medium truncate w-48 md:w-auto" title={user?.email}>{user?.email || "admin@clinic.com"}</p>
            </div>
          </div>
          <div className="p-6 flex items-start">
            <Shield className="w-5 h-5 text-gray-400 mr-4 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Account Role</p>
              <p className="text-gray-800 font-medium capitalize">{role || "admin"}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="pt-4">
        <LogoutButton />
      </div>
    </div>
  );
}
