import React from "react";
import { useAuth } from "../../hooks/useAuth";
import { User, LogOut, History, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import LogoutButton from "../../components/common/LogoutButton";

export default function Profile() {
  const { user } = useAuth();

  if (!user) return null;

  const menuItems = [
    {
      title: "Account",
      description: "View and edit your account information.",
      icon: User,
      path: "/parent/profile/personal-info",
      color: "text-blue-600",
      bgColor: "bg-blue-50"
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
    <div className="space-y-6 pb-8 max-w-2xl mx-auto">
      {/* Profile Header */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-100 shadow-xs flex flex-col sm:flex-row items-center gap-5 text-center sm:text-left">
        <div className="w-20 h-20 bg-blue-100 rounded-full flex flex-shrink-0 items-center justify-center text-blue-600 shadow-inner">
          <User className="w-10 h-10" />
        </div>
        <div>
          <h2 className="text-2xl font-black text-gray-800">{user?.fullName || user?.displayName || user?.name || "Parent Account"}</h2>
          <p className="text-gray-500 font-medium mt-1">{user?.email || "Loading email..."}</p>
        </div>
      </div>

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
      </div>

      <div className="pt-6 mt-8">
        <LogoutButton />
      </div>
    </div>
  );
}
