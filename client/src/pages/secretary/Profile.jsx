import { useAuth } from "../../hooks/useAuth";
import { logoutUser } from "../../services/authService";
import { User, Mail, ShieldCheck, LogOut, Activity } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function Profile() {
  const { user, role } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logoutUser();
      navigate("/");
    } catch (error) {
      console.error("Logout failed", error);
    }
  };

  return (
    <div className="space-y-6 pb-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Secretary Profile</h1>
        <p className="text-gray-500 mt-1">
          Manage your account information.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Profile Card */}
        <div className="md:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-6 md:p-8">
              <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
                <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center flex-shrink-0 border border-blue-100">
                  <User className="w-10 h-10" />
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-bold text-gray-800">{user?.displayName || "Secretary Account"}</h2>
                  <div className="mt-2 space-y-2">
                    <div className="flex items-center text-gray-600 text-sm">
                      <Mail className="w-4 h-4 mr-2 text-gray-400" />
                      {user?.email}
                    </div>
                    <div className="flex items-center text-gray-600 text-sm">
                      <ShieldCheck className="w-4 h-4 mr-2 text-gray-400" />
                      Role: <span className="ml-1 capitalize font-semibold text-gray-700">{role}</span>
                    </div>
                  </div>
                </div>
                <span className="px-3 py-1 bg-green-50 text-green-700 text-xs font-bold rounded-full mt-4 md:mt-0">
                  Active
                </span>
              </div>
            </div>
            <div className="bg-gray-50 p-6 border-t border-gray-100">
              <button 
                onClick={handleLogout}
                className="flex items-center justify-center w-full md:w-auto px-6 py-2.5 bg-white border border-gray-200 text-red-600 font-semibold rounded-xl hover:bg-red-50 hover:border-red-100 hover:text-red-700 transition-colors shadow-sm"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Log Out
              </button>
            </div>
          </div>
        </div>

        {/* Info Card */}
        <div className="md:col-span-1">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
             <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center mb-4">
                <Activity className="w-6 h-6" />
             </div>
             <h3 className="font-bold text-gray-800 mb-2">Workspace Access</h3>
             <p className="text-gray-500 text-sm leading-relaxed mb-4">
               Your secretary account is verified and has full access to the clinic's queue management tools.
             </p>
             <div className="h-1 w-full bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 w-full"></div>
             </div>
             <p className="text-xs text-blue-600 font-semibold mt-2 text-right">Access Granted</p>
          </div>
        </div>
      </div>
    </div>
  );
}
