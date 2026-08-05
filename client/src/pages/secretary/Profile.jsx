import { useAuth } from "../../hooks/useAuth";
import { logoutUser } from "../../services/authService";
import { User, Mail, LogOut, ChevronRight, MapPin, Phone, ShieldCheck, Key } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function Profile() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logoutUser();
      navigate("/");
    } catch (error) {
      console.error("Logout failed", error);
    }
  };

  const menuItems = [
    {
      title: "Personal Information",
      description: "View and edit your personal details.",
      icon: User,
      action: () => console.log("Navigate to Personal Info"), // Placeholder for now
      color: "text-blue-600",
      bgColor: "bg-blue-50"
    },
    {
      title: "Change Password",
      description: "Update your account password securely.",
      icon: Key,
      action: () => console.log("Navigate to Change Password"), // Placeholder for now
      color: "text-purple-600",
      bgColor: "bg-purple-50"
    },
    {
      title: "Log Out",
      description: "Sign out of your secretary account securely.",
      icon: LogOut,
      action: handleLogout,
      color: "text-red-600",
      bgColor: "bg-red-50"
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
          <h2 className="text-2xl font-black text-gray-800">{user?.fullName || user?.displayName || user?.name || "Secretary Account"}</h2>
          <div className="mt-2 space-y-1.5 flex flex-col items-center sm:items-start">
            <div className="flex items-center text-gray-600 text-sm font-medium">
              <Mail className="w-4 h-4 mr-2 text-gray-400" />
              {user?.email || "Loading email..."}
            </div>
            {user?.phone && (
              <div className="flex items-center text-gray-600 text-sm font-medium">
                <Phone className="w-4 h-4 mr-2 text-gray-400" />
                {user.phone}
              </div>
            )}
            <div className="flex items-center text-gray-600 text-sm font-medium">
              <MapPin className="w-4 h-4 mr-2 text-gray-400" />
              Assigned Branch: <span className="ml-1 font-bold text-gray-800">{user?.assignedBranch || "None"}</span>
            </div>
            <div className="flex items-center text-gray-600 text-sm font-medium">
              <ShieldCheck className="w-4 h-4 mr-2 text-gray-400" />
              Role: <span className="ml-1 font-bold text-gray-800 capitalize">{user?.role || "Secretary"}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Menu Options */}
      <div className="grid grid-cols-1 gap-4">
        {menuItems.map((item, index) => (
          <div 
            key={index}
            onClick={item.action}
            className="bg-white rounded-3xl p-5 border border-gray-100 shadow-xs flex items-center justify-between transition-all group cursor-pointer hover:border-blue-200 hover:shadow-md"
          >
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-105 ${item.bgColor} ${item.color}`}>
                <item.icon className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-gray-800">{item.title}</h3>
                <p className="text-sm text-gray-500 font-medium">{item.description}</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-blue-500 transition-colors" />
          </div>
        ))}
      </div>
    </div>
  );
}
