import React from "react";
import { useAuth } from "../../hooks/useAuth";
import { logoutUser } from "../../services/authService";
import { User, Mail, ShieldCheck, LogOut, Activity, History, ChevronRight, Settings, Bell } from "lucide-react";
import { useNavigate, Link } from "react-router-dom";

export default function Profile() {
  const { user, role } = useAuth();
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
      description: "View past consultations and cancelled slots",
      icon: History,
      path: "/parent/profile/history",
      color: "text-blue-600",
      bgColor: "bg-blue-50"
    },
    {
      title: "Account Settings",
      description: "Manage your personal information",
      icon: Settings,
      path: "#",
      color: "text-gray-400",
      bgColor: "bg-gray-50"
    },
    {
      title: "Notifications",
      description: "Configure your alerts and reminders",
      icon: Bell,
      path: "#",
      color: "text-gray-400",
      bgColor: "bg-gray-50"
    }
  ];

  return (
    <div className="space-y-6 pb-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Profile</h1>
        <p className="text-gray-500 mt-1">
          Manage your account settings and history.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-8 animate-in fade-in slide-in-from-bottom-4">
        <div className="p-6 md:p-8 flex flex-col md:flex-row items-center gap-6">
          <div className="w-24 h-24 bg-blue-50 rounded-full flex items-center justify-center border-4 border-white shadow-md flex-shrink-0 relative">
            <User className="w-10 h-10 text-blue-500" />
            <div className="absolute -bottom-1 -right-1 bg-green-500 w-5 h-5 rounded-full border-2 border-white"></div>
          </div>
          
          <div className="text-center md:text-left flex-1">
            <h2 className="text-xl font-bold text-gray-800">{user?.displayName || "Parent"}</h2>
            <div className="flex flex-col md:flex-row gap-2 md:gap-4 mt-2 text-sm text-gray-500 justify-center md:justify-start">
              <span className="flex items-center justify-center md:justify-start">
                <Mail className="w-4 h-4 mr-1.5 text-gray-400" />
                {user?.email || "No email provided"}
              </span>
              <span className="flex items-center justify-center md:justify-start capitalize">
                <ShieldCheck className="w-4 h-4 mr-1.5 text-blue-500" />
                {role}
              </span>
            </div>
          </div>

          <button 
            onClick={handleLogout}
            className="w-full md:w-auto px-6 py-2.5 bg-red-50 text-red-600 font-bold rounded-xl hover:bg-red-100 transition-colors flex items-center justify-center mt-4 md:mt-0 shadow-sm"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Log Out
          </button>
        </div>
      </div>

      <h2 className="text-lg font-bold text-gray-800 mb-4 px-1">Menu</h2>
      
      <div className="grid grid-cols-1 gap-4">
        {menuItems.map((item, index) => (
          <Link 
            to={item.path} 
            key={index}
            className={`bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex items-center justify-between hover:border-blue-200 hover:shadow-md transition-all group ${item.path === '#' ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'}`}
            onClick={e => item.path === '#' && e.preventDefault()}
          >
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${item.bgColor}`}>
                <item.icon className={`w-6 h-6 ${item.color}`} />
              </div>
              <div>
                <h3 className="font-bold text-gray-800 group-hover:text-blue-600 transition-colors">{item.title}</h3>
                <p className="text-sm text-gray-500">{item.description}</p>
              </div>
            </div>
            <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center group-hover:bg-blue-50 transition-colors">
              <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-blue-600" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
