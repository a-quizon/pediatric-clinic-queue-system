import { useAuth } from "../../hooks/useAuth";
import { logoutUser } from "../../services/authService";
import { User, LogOut, Mail, Shield, ChevronRight, BarChart3, Settings } from "lucide-react";
import { Link } from "react-router-dom";

export default function Profile() {
  const { user, role } = useAuth();

  const handleLogout = async () => {
    await logoutUser();
  };

  return (
    <div className="space-y-6 pb-6 max-w-3xl mx-auto">


      {/* Profile Information */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-6 md:p-8 flex flex-col md:flex-row items-center md:items-start gap-6">
          <div className="w-24 h-24 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center shrink-0">
            <User className="w-10 h-10" />
          </div>
          <div className="flex-1 text-center md:text-left">
            <h2 className="text-xl font-bold text-gray-800">Doctor Account</h2>
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
              <p className="text-gray-800 font-medium truncate w-48 md:w-auto" title={user?.email}>{user?.email || "Not provided"}</p>
            </div>
          </div>
          <div className="p-6 flex items-start">
            <Shield className="w-5 h-5 text-gray-400 mr-4 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Account Role</p>
              <p className="text-gray-800 font-medium capitalize">{role}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tools & Insights Section (Mobile Only) */}
      <div className="md:hidden">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4 px-1">
          Tools & Insights
        </h3>
        <div className="space-y-3">

          <Link 
            to="/doctor/reports" 
            className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm hover:border-blue-100 hover:shadow-md transition-all flex items-center group"
          >
            <div className="bg-blue-50 p-3 rounded-xl mr-4 group-hover:bg-blue-100 transition-colors">
              <BarChart3 className="w-6 h-6 text-blue-600" />
            </div>
            <div className="flex-1">
              <h4 className="text-[15px] font-bold text-gray-800 group-hover:text-blue-600 transition-colors">
                Reports & Analytics
              </h4>
              <p className="text-sm text-gray-500">
                View clinic statistics, consultation summaries, and queue performance metrics.
              </p>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-blue-600 transition-colors" />
          </Link>
        </div>
      </div>

      {/* Actions */}
      <div className="pt-4">
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center p-4 bg-white text-red-600 rounded-2xl font-semibold border border-gray-200 shadow-sm hover:bg-red-50 hover:border-red-100 transition-colors"
        >
          <LogOut className="w-5 h-5 mr-2" />
          Sign Out
        </button>
      </div>
    </div>
  );
}
