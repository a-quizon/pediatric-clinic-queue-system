import { useAuth } from "../../hooks/useAuth";
import { CalendarDays, Users, Stethoscope, User, ChevronRight, BarChart3 } from "lucide-react";
import { Link } from "react-router-dom";

export default function Home() {
  const { user } = useAuth();

  const actionCards = [
    {
      title: "Schedules",
      description: "Manage your availability",
      icon: CalendarDays,
      path: "/doctor/schedules",
    },
    {
      title: "Queue",
      description: "Monitor patient flow",
      icon: Users,
      path: "/doctor/queue",
    },
    {
      title: "Consultations",
      description: "Conduct sessions",
      icon: Stethoscope,
      path: "/doctor/consultations",
    },
    {
      title: "Profile",
      description: "Account settings",
      icon: User,
      path: "/doctor/profile",
    },
  ];

  return (
    <div className="space-y-6 pb-6">
      {/* Welcome Section */}
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Welcome Back, Doctor</h1>
        <p className="text-gray-500 mt-1">Manage your clinic operations</p>
      </div>

      {/* Dashboard Analytics Placeholder */}
      <div className="bg-white rounded-2xl p-8 border border-gray-100 shadow-sm text-center">
        <div className="mx-auto w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-4">
          <BarChart3 className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-gray-800 mb-2 flex items-center justify-center">
          <span className="mr-2">🚧</span> Dashboard Analytics Coming Soon
        </h2>
        <p className="text-gray-500 text-sm max-w-md mx-auto">
          Future clinic insights, patient statistics, and performance metrics will appear here.
        </p>
      </div>

      {/* Action Cards */}
      <div>
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4 px-1">
          Quick Actions
        </h3>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {actionCards.map((card) => (
            <Link 
              key={card.title} 
              to={card.path}
              className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm hover:border-blue-100 hover:shadow-md transition-all flex items-center group"
            >
              <div className="bg-blue-50 p-3 rounded-xl mr-4 group-hover:bg-blue-100 transition-colors">
                <card.icon className="w-6 h-6 text-blue-600" />
              </div>
              <div className="flex-1">
                <h4 className="text-[15px] font-bold text-gray-800 group-hover:text-blue-600 transition-colors">
                  {card.title}
                </h4>
                <p className="text-sm text-gray-500">
                  {card.description}
                </p>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-blue-600 transition-colors" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
