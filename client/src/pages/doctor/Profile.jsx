import { useAuth } from "../../hooks/useAuth";
import { logoutUser } from "../../services/authService";
import { User, LogOut, Mail, Shield, CheckCircle2, ChevronRight, Settings, Bell, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";

export default function Profile() {
  const { user, role } = useAuth();

  const handleLogout = async () => {
    await logoutUser();
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 ease-out pb-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="bg-white rounded-3xl p-6 md:p-8 shadow-[0_4px_24px_rgba(0,0,0,0.02)] border border-slate-100 flex items-center justify-between">
        <div className="flex items-center space-x-5">
          <div className="bg-blue-50 p-4 rounded-2xl shadow-sm border border-blue-100/50">
            <User className="w-8 h-8 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Doctor Profile</h1>
            <p className="text-slate-500 font-medium mt-1">
              Manage your personal and clinic account settings.
            </p>
          </div>
        </div>
      </div>

      {/* Main Profile Card */}
      <div className="bg-white rounded-3xl shadow-[0_4px_24px_rgba(0,0,0,0.02)] border border-slate-100 overflow-hidden relative">
        <div className="h-32 bg-gradient-to-r from-blue-500 to-blue-700 w-full relative">
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
        </div>
        
        <div className="px-6 md:px-10 pb-10 relative">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 -mt-16 mb-8">
            <div className="flex flex-col items-center md:items-start">
              <div className="w-32 h-32 bg-white rounded-full flex items-center justify-center border-4 border-white shadow-xl relative z-10">
                <div className="w-full h-full bg-blue-50 rounded-full flex items-center justify-center">
                  <User className="w-14 h-14 text-blue-500" />
                </div>
                <div className="absolute bottom-1 right-1 bg-emerald-500 w-6 h-6 rounded-full border-2 border-white shadow-sm"></div>
              </div>
              <div className="mt-4 text-center md:text-left">
                <h2 className="text-2xl font-bold text-slate-800">Doctor Account</h2>
                <div className="flex items-center justify-center md:justify-start mt-1">
                  <ShieldCheck className="w-4 h-4 text-emerald-500 mr-1.5" />
                  <span className="text-emerald-600 font-semibold text-sm">Verified Medical Professional</span>
                </div>
              </div>
            </div>
            
            <div className="flex gap-3 justify-center md:justify-end w-full md:w-auto">
              <button className="flex-1 md:flex-none flex items-center justify-center px-6 py-2.5 bg-slate-50 text-slate-600 font-semibold rounded-xl border border-slate-200 hover:bg-slate-100 transition-colors">
                <Settings className="w-4 h-4 mr-2" />
                Settings
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100 flex items-start group hover:border-blue-100 hover:bg-blue-50/30 transition-colors">
              <div className="bg-white p-3 rounded-xl shadow-sm mr-4 text-slate-400 group-hover:text-blue-500 transition-colors">
                <Mail className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-500 mb-0.5">Email Address</p>
                <p className="text-slate-800 font-medium truncate max-w-[200px] md:max-w-xs" title={user?.email}>{user?.email || "Not provided"}</p>
              </div>
            </div>

            <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100 flex items-start group hover:border-blue-100 hover:bg-blue-50/30 transition-colors">
              <div className="bg-white p-3 rounded-xl shadow-sm mr-4 text-slate-400 group-hover:text-blue-500 transition-colors">
                <Shield className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-500 mb-0.5">Account Role</p>
                <p className="text-slate-800 font-medium capitalize">{role}</p>
              </div>
            </div>

            <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100 flex items-start group hover:border-emerald-100 hover:bg-emerald-50/30 transition-colors md:col-span-2">
              <div className="bg-white p-3 rounded-xl shadow-sm mr-4 text-slate-400 group-hover:text-emerald-500 transition-colors">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-500 mb-0.5">Account Status</p>
                <p className="text-slate-800 font-medium flex items-center">
                   Active & Good Standing
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Action Settings */}
      <div className="bg-white rounded-3xl shadow-[0_4px_24px_rgba(0,0,0,0.02)] border border-slate-100 overflow-hidden">
        <div className="divide-y divide-slate-100">
          <Link to="#" className="flex items-center justify-between p-5 hover:bg-slate-50 transition-colors group">
            <div className="flex items-center">
              <div className="bg-slate-100 p-2.5 rounded-xl mr-4 group-hover:bg-slate-200 transition-colors">
                <Bell className="w-5 h-5 text-slate-600" />
              </div>
              <div>
                <p className="font-semibold text-slate-800">Notifications</p>
                <p className="text-xs text-slate-500 mt-0.5">Manage your email and push preferences</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-slate-600 transition-colors" />
          </Link>

          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-between p-5 hover:bg-red-50 transition-colors group"
          >
            <div className="flex items-center">
              <div className="bg-red-50 p-2.5 rounded-xl mr-4 group-hover:bg-red-100 transition-colors">
                <LogOut className="w-5 h-5 text-red-600" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-red-600">Secure Logout</p>
                <p className="text-xs text-red-400 mt-0.5">Sign out of your session on this device</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-red-300 group-hover:text-red-500 transition-colors" />
          </button>
        </div>
      </div>
    </div>
  );
}
