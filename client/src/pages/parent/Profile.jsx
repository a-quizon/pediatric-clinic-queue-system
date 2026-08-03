import React, { useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { logoutUser } from "../../services/authService";
import { User, Shield, LogOut, History, ChevronRight } from "lucide-react";
import { useNavigate, Link } from "react-router-dom";
import ConfirmationModal from "../../components/common/ConfirmationModal";

export default function Profile() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await logoutUser(user);
      navigate("/");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const menuItems = [
    {
      title: "Personal Information",
      description: "View and edit your account information.",
      icon: User,
      path: "/parent/profile/personal-info",
      color: "text-blue-600",
      bgColor: "bg-blue-50"
    },
    {
      title: "Security",
      description: "Change your account password.",
      icon: Shield,
      path: "/parent/profile/security",
      color: "text-purple-600",
      bgColor: "bg-purple-50"
    },
    {
      title: "Reservation History",
      description: "View completed, cancelled, and forfeited reservations.",
      icon: History,
      path: "/parent/profile/history",
      color: "text-green-600",
      bgColor: "bg-green-50"
    }
  ];

  return (
    <div className="space-y-6 pb-8 max-w-2xl mx-auto mt-4 px-2">
      <h1 className="text-3xl font-black text-gray-800 tracking-tight mb-6">Profile</h1>

      {/* Menu Options */}
      <div className="grid grid-cols-1 gap-4">
        {menuItems.map((item, index) => (
          <Link 
            to={item.path} 
            key={index}
            className="bg-white rounded-3xl p-5 border border-gray-100 shadow-xs flex items-center justify-between transition-all group cursor-pointer hover:border-blue-200 hover:shadow-md"
          >
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 ${item.bgColor}`}>
                <item.icon className={`w-6 h-6 ${item.color}`} />
              </div>
              <div>
                <h3 className="font-extrabold text-gray-800 group-hover:text-blue-600 transition-colors">{item.title}</h3>
                <p className="text-sm text-gray-500 mt-0.5">{item.description}</p>
              </div>
            </div>
            <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center group-hover:bg-blue-50 transition-colors flex-shrink-0">
              <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-blue-600" />
            </div>
          </Link>
        ))}

        {/* Logout Menu Item */}
        <button 
          onClick={() => setIsLogoutModalOpen(true)}
          className="bg-white rounded-3xl p-5 border border-gray-100 shadow-xs flex items-center justify-between transition-all group cursor-pointer hover:border-red-200 hover:shadow-md text-left w-full focus:outline-none"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 bg-red-50">
              <LogOut className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <h3 className="font-extrabold text-gray-800 group-hover:text-red-600 transition-colors">Logout</h3>
              <p className="text-sm text-gray-500 mt-0.5">Sign out of your account.</p>
            </div>
          </div>
          <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center group-hover:bg-red-50 transition-colors flex-shrink-0">
            <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-red-600" />
          </div>
        </button>
      </div>

      {/* Logout Confirmation Modal */}
      <ConfirmationModal
        isOpen={isLogoutModalOpen}
        onClose={() => setIsLogoutModalOpen(false)}
        onConfirm={handleLogout}
        title="Logout"
        message="Are you sure you want to logout?"
        confirmText="Logout"
        cancelText="Cancel"
        isDestructive={true}
      />
    </div>
  );
}
