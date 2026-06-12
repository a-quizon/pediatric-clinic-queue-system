import { Activity, Clock, CalendarPlus, Ticket, User, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";

export default function Dashboard() {
  return (
    <div className="space-y-6 pb-6 relative">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Welcome Back</h1>
        <p className="text-gray-500 mt-1">
          Manage your clinic reservations and monitor your queue status.
        </p>
      </div>

      {/* Queue Monitoring Card */}
      <div className="bg-white rounded-2xl border border-blue-100 shadow-sm overflow-hidden relative">
        <div className="absolute top-0 left-0 w-full h-2 bg-blue-500"></div>
        <div className="p-6 md:p-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-800 flex items-center">
              <Activity className="w-6 h-6 mr-2 text-blue-600" />
              Queue Monitoring
            </h2>
            <span className="px-3 py-1 bg-blue-50 text-blue-700 text-xs font-bold rounded-full">
              Coming Soon
            </span>
          </div>

          <div className="text-center py-8">
            <div className="mx-auto w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-4">
              <span className="text-2xl">🚧</span>
            </div>
            <p className="text-gray-500 text-sm max-w-md mx-auto mb-6">
              Queue monitoring will be available once reservations and live queue management are implemented.
            </p>

            <div className="bg-gray-50 rounded-xl p-5 text-left border border-gray-100 max-w-lg mx-auto">
              <h3 className="font-bold text-gray-700 mb-3 text-sm">Future Information:</h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-center"><Clock className="w-4 h-4 mr-2 text-blue-500" /> Current Queue Position</li>
                <li className="flex items-center"><User className="w-4 h-4 mr-2 text-blue-500" /> My Queue Position</li>
                <li className="flex items-center"><Activity className="w-4 h-4 mr-2 text-blue-500" /> Queue Progress & Estimated Turn</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Action Cards */}
      <div>
        <h2 className="text-lg font-bold text-gray-800 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Link to="/parent/reserve" className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-blue-100 transition-all group flex flex-col justify-between h-full">
            <div>
              <div className="bg-blue-50 w-12 h-12 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <CalendarPlus className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="font-bold text-gray-800 mb-1">Reserve Queue</h3>
              <p className="text-gray-500 text-sm mb-4">View available clinic schedules and reserve a slot.</p>
            </div>
            <div className="flex items-center text-blue-600 text-sm font-semibold mt-auto">
              Open <ChevronRight className="w-4 h-4 ml-1" />
            </div>
          </Link>

          <Link to="/parent/reservations" className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-blue-100 transition-all group flex flex-col justify-between h-full">
            <div>
              <div className="bg-blue-50 w-12 h-12 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Ticket className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="font-bold text-gray-800 mb-1">My Reservations</h3>
              <p className="text-gray-500 text-sm mb-4">View your reservation history and upcoming appointments.</p>
            </div>
            <div className="flex items-center text-blue-600 text-sm font-semibold mt-auto">
              Open <ChevronRight className="w-4 h-4 ml-1" />
            </div>
          </Link>

          <Link to="/parent/profile" className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-blue-100 transition-all group flex flex-col justify-between h-full">
            <div>
              <div className="bg-gray-50 w-12 h-12 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform border border-gray-100">
                <User className="w-6 h-6 text-gray-600" />
              </div>
              <h3 className="font-bold text-gray-800 mb-1">Profile</h3>
              <p className="text-gray-500 text-sm mb-4">Manage account information and preferences.</p>
            </div>
            <div className="flex items-center text-gray-600 text-sm font-semibold mt-auto group-hover:text-blue-600 transition-colors">
              Settings <ChevronRight className="w-4 h-4 ml-1" />
            </div>
          </Link>
        </div>
      </div>

    </div>
  );
}