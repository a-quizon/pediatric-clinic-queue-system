import React, { useState } from "react";
import { User, Mail, MapPin, Phone, UserPlus } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import LogoutButton from "../../components/common/LogoutButton";
import WalkInPatientModal from "../../components/secretary/WalkInPatientModal";

export default function Profile() {
  const { user } = useAuth();
  const [isWalkInOpen, setIsWalkInOpen] = useState(false);

  if (!user) return null;

  return (
    <div className="space-y-6 pb-8 max-w-2xl mx-auto flex flex-col min-h-[70vh]">
      <div className="flex-1 space-y-6">
        {/* Profile Header */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-100 shadow-xs flex flex-col sm:flex-row items-center gap-5 text-center sm:text-left">
          <div className="w-24 h-24 bg-blue-100 rounded-full flex flex-shrink-0 items-center justify-center text-blue-600 shadow-inner">
            <User className="w-12 h-12" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-gray-800">{user?.fullName || user?.displayName || user?.name || "Secretary Account"}</h2>
            <div className="mt-4 space-y-2.5 flex flex-col items-center sm:items-start">
              <div className="flex items-center text-gray-600 text-sm font-medium">
                <Mail className="w-4 h-4 mr-3 text-gray-400" />
                {user?.email || "No email available"}
              </div>
              <div className="flex items-center text-gray-600 text-sm font-medium">
                <Phone className="w-4 h-4 mr-3 text-gray-400" />
                {user?.phone || "No phone number available"}
              </div>
              <div className="flex items-center text-gray-600 text-sm font-medium">
                <MapPin className="w-4 h-4 mr-3 text-gray-400" />
                Assigned Branch: <span className="ml-1 font-bold text-gray-800">{user?.assignedBranch || "None"}</span>
              </div>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsWalkInOpen(true)}
          className="w-full flex items-center justify-center gap-2 py-3.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl shadow-sm transition-colors"
        >
          <UserPlus className="w-5 h-5" />
          Walk-in Patient
        </button>
      </div>

      <div className="mt-auto pt-8">
        <LogoutButton />
      </div>

      <WalkInPatientModal isOpen={isWalkInOpen} onClose={() => setIsWalkInOpen(false)} />
    </div>
  );
}
