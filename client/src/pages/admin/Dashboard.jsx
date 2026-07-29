import { CalendarDays, CheckCircle2, User, UserCog, Stethoscope, MapPin, TrendingUp, TrendingDown } from "lucide-react";

export default function Dashboard() {
  const statCards = [
    { title: "Today's Reservations", value: "145", trend: "+12%", trendUp: true, icon: CalendarDays, color: "text-blue-600", bg: "bg-blue-50" },
    { title: "Completed Consultations", value: "89", trend: "+5%", trendUp: true, icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50" },
    { title: "Registered Parents", value: "1,204", trend: "+2%", trendUp: true, icon: User, color: "text-indigo-600", bg: "bg-indigo-50" },
    { title: "Doctors", value: "12", trend: "0%", trendUp: true, icon: Stethoscope, color: "text-purple-600", bg: "bg-purple-50" },
    { title: "Secretaries", value: "5", trend: "0%", trendUp: true, icon: UserCog, color: "text-amber-600", bg: "bg-amber-50" },
    { title: "Branches", value: "3", trend: "+1", trendUp: true, icon: MapPin, color: "text-rose-600", bg: "bg-rose-50" },
  ];

  const recentActivity = [
    { id: 1, action: "Dr. Smith logged in", time: "2 mins ago", type: "auth" },
    { id: 2, action: "New branch 'Downtown' created", time: "1 hour ago", type: "system" },
    { id: 3, action: "Secretary 'Jane Doe' account created", time: "3 hours ago", type: "user" },
    { id: 4, action: "System backup completed", time: "5 hours ago", type: "system" },
  ];

  return (
    <div className="space-y-8">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        {statCards.map((stat, index) => (
          <div key={index} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className={`p-3 rounded-xl ${stat.bg}`}>
                <stat.icon className={`w-6 h-6 ${stat.color}`} />
              </div>
              <div className={`flex items-center text-sm font-semibold ${stat.trendUp ? 'text-green-600' : 'text-red-600'}`}>
                {stat.trendUp ? <TrendingUp className="w-4 h-4 mr-1" /> : <TrendingDown className="w-4 h-4 mr-1" />}
                {stat.trend}
              </div>
            </div>
            <h3 className="text-gray-500 text-sm font-medium mb-1">{stat.title}</h3>
            <p className="text-2xl font-bold text-gray-800">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-50">
          <h2 className="text-lg font-bold text-gray-800">Recent System Activity</h2>
        </div>
        <div className="p-6">
          <div className="space-y-6">
            {recentActivity.map((activity) => (
              <div key={activity.id} className="flex items-start">
                <div className="w-2 h-2 mt-2 rounded-full bg-blue-500 mr-4"></div>
                <div>
                  <p className="text-sm font-medium text-gray-800">{activity.action}</p>
                  <p className="text-xs text-gray-500 mt-1">{activity.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
