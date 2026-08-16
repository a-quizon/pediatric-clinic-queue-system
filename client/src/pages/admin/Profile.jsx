import React from "react";
import { User, Settings, ChevronRight, MapPin } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import LogoutButton from "../../components/common/LogoutButton";
import SystemSettings from "./SystemSettings";

export default function Profile() {
  const { user } = useAuth();
  const navigate = useNavigate();

  if (!user) return null;

  return (
    <div className="space-y-6 pb-6 max-w-3xl mx-auto">
      {/* Profile Information */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-6 md:p-8 flex flex-col md:flex-row items-center gap-6">
          <div className="w-24 h-24 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center shrink-0">
            <User className="w-10 h-10" />
          </div>
          <div className="flex-1 text-center md:text-left">
            <h2 className="text-2xl font-bold text-gray-800">Administrator Account</h2>
          </div>
        </div>
      </div>

      {/* Desktop System Configuration */}
      <div className="hidden md:block">
        <SystemSettings isEmbedded={true} />
      </div>

      {/* Mobile Links */}
      <div className="block md:hidden space-y-4">
        <button 
          onClick={() => navigate("/admin/branches")}
          className="w-full bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center justify-between hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center">
            <div className="w-12 h-12 bg-green-50 text-green-600 rounded-full flex items-center justify-center shrink-0 mr-4">
              <MapPin className="w-6 h-6" />
            </div>
            <span className="font-bold text-gray-800 text-lg">Branch Management</span>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-400" />
        </button>

        <button 
          onClick={() => navigate("/admin/settings")}
          className="w-full bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center justify-between hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center">
            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center shrink-0 mr-4">
              <Settings className="w-6 h-6" />
            </div>
            <span className="font-bold text-gray-800 text-lg">System Configuration</span>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-400" />
        </button>
      </div>

      <div className="pt-4">
        <LogoutButton />
      </div>
    </div>
  );
}
