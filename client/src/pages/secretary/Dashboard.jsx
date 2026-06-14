import { Calendar, Users, CheckCircle, Activity } from "lucide-react";

export default function Dashboard() {
  const stats = [
    { name: "Today's Schedules", value: "0", icon: Calendar, color: "text-blue-600", bgColor: "bg-blue-100" },
    { name: "Waiting Patients", value: "0", icon: Users, color: "text-amber-600", bgColor: "bg-amber-100" },
    { name: "Checked-In Patients", value: "0", icon: CheckCircle, color: "text-green-600", bgColor: "bg-green-100" },
    { name: "Active Queue", value: "Coming Soon", icon: Activity, color: "text-purple-600", bgColor: "bg-purple-100" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">Overview of today's clinic activities.</p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, index) => (
          <div key={index} className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500 mb-1">{stat.name}</p>
                <h3 className="text-2xl font-bold text-gray-800">{stat.value}</h3>
              </div>
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${stat.bgColor}`}>
                <stat.icon className={`w-6 h-6 ${stat.color}`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Recent Activity</h2>
          <div className="flex items-center justify-center h-48 bg-gray-50 rounded-xl border border-dashed border-gray-200">
             <p className="text-gray-500">Coming Soon</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Quick Actions</h2>
          <div className="flex items-center justify-center h-48 bg-gray-50 rounded-xl border border-dashed border-gray-200">
             <p className="text-gray-500">Coming Soon</p>
          </div>
        </div>
      </div>
    </div>
  );
}