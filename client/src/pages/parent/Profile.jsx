import React from "react";
import { useAuth } from "../../hooks/useAuth";
import { logoutUser } from "../../services/authService";
import { User, Mail, Phone, LogOut, History, ChevronRight, Bell, HelpCircle, Info } from "lucide-react";
import { useNavigate, Link } from "react-router-dom";

export default function Profile() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logoutUser();
      navigate("/");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const menuItems = [
    {
      title: "Reservation History",
      description: "View past consultations and clinic visits",
      icon: History,
      path: "/parent/profile/history",
      color: "text-blue-600",
      bgColor: "bg-blue-50"
    },
    {
      title: "Notifications",
      description: "Configure your alerts and reminders",
      icon: Bell,
      path: "#",
      color: "text-purple-600",
      bgColor: "bg-purple-50"
    },
    {
      title: "Help & Support (Future)",
      description: "Get assistance and clinic FAQs",
      icon: HelpCircle,
      path: "#",
      color: "text-amber-600",
      bgColor: "bg-amber-50"
    },
    {
      title: "About (Future)",
      description: "App version and clinic information",
      icon: Info,
      path: "#",
      color: "text-teal-600",
      bgColor: "bg-teal-50"
    }
  ];

  return (
    <div className="space-y-6 pb-8 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">My Profile</h1>
        <p className="text-gray-500 mt-1 text-sm">
          Manage your account information and view your reservation history.
        </p>
      </div>

      {/* Parent Information Card (No badge icon, no 'Parent' label) */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-xs p-6 sm:p-8 flex flex-col sm:flex-row items-center gap-6 animate-in fade-in slide-in-from-bottom-4">
        <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-full flex items-center justify-center shadow-md flex-shrink-0">
          <User className="w-10 h-10" />
        </div>
        
        <div className="text-center sm:text-left flex-1 space-y-2">
          <h2 className="text-2xl font-black text-gray-800 tracking-tight">{user?.displayName || "Parent Account"}</h2>
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-6 text-sm text-gray-500 justify-center sm:justify-start">
            <span className="flex items-center justify-center sm:justify-start font-medium">
              <Mail className="w-4 h-4 mr-2 text-blue-500 flex-shrink-0" />
              {user?.email || "No email provided"}
            </span>
            {user?.phoneNumber || user?.phone ? (
              <span className="flex items-center justify-center sm:justify-start font-medium">
                <Phone className="w-4 h-4 mr-2 text-green-500 flex-shrink-0" />
                {user?.phoneNumber || user?.phone}
              </span>
            ) : (
              <span className="flex items-center justify-center sm:justify-start text-gray-400 font-medium italic">
                <Phone className="w-4 h-4 mr-2 text-gray-400 flex-shrink-0" />
                No phone number linked
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Menu Options (No 'Menu' title) */}
      <div className="grid grid-cols-1 gap-4 pt-2">
        {menuItems.map((item, index) => (
          <Link 
            to={item.path} 
            key={index}
            className={`bg-white rounded-3xl p-5 border border-gray-100 shadow-xs flex items-center justify-between transition-all group ${
              item.path === '#' 
                ? 'cursor-not-allowed opacity-75 bg-gray-50/50' 
                : 'cursor-pointer hover:border-blue-200 hover:shadow-md'
            }`}
            onClick={e => item.path === '#' && e.preventDefault()}
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
      </div>

      {/* Logout Button separated by generous spacing at the bottom */}
      <div className="pt-8 mt-10 border-t border-gray-100">
        <button 
          onClick={handleLogout}
          className="w-full py-4 bg-red-50 text-red-600 font-extrabold rounded-2xl hover:bg-red-100 hover:shadow-sm transition-all flex items-center justify-center gap-2.5 shadow-xs text-base focus:outline-none"
        >
          <LogOut className="w-5 h-5" />
          Log Out
        </button>
      </div>
    </div>
  );
}
