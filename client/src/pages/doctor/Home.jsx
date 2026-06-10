import { useAuth } from "../../hooks/useAuth";
import { CalendarDays, Users, Stethoscope, BarChart3, ChevronRight, Activity } from "lucide-react";
import { Link } from "react-router-dom";

export default function Home() {
  const { user } = useAuth();

  const quickLinks = [
    {
      title: "Schedules",
      description: "Manage your clinic sessions and availability.",
      icon: CalendarDays,
      path: "/doctor/schedules",
      color: "blue",
      bgColor: "bg-blue-500",
      lightBg: "bg-blue-50",
      textColor: "text-blue-600",
    },
    {
      title: "Queue",
      description: "Monitor and control patient flow in real-time.",
      icon: Users,
      path: "/doctor/queue",
      color: "emerald",
      bgColor: "bg-emerald-500",
      lightBg: "bg-emerald-50",
      textColor: "text-emerald-600",
    },
    {
      title: "Consultations",
      description: "Review patient concerns and conduct sessions.",
      icon: Stethoscope,
      path: "/doctor/consultations",
      color: "indigo",
      bgColor: "bg-indigo-500",
      lightBg: "bg-indigo-50",
      textColor: "text-indigo-600",
    },
    {
      title: "Reports",
      description: "View clinic statistics and performance metrics.",
      icon: BarChart3,
      path: "/doctor/reports",
      color: "violet",
      bgColor: "bg-violet-500",
      lightBg: "bg-violet-50",
      textColor: "text-violet-600",
    },
  ];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out pb-6">
      {/* Welcome Card */}
      <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-[2rem] p-8 text-white shadow-xl shadow-blue-900/20 relative overflow-hidden">
        {/* Abstract Background Shapes */}
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-blue-500/20 blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-48 h-48 rounded-full bg-blue-400/20 blur-2xl pointer-events-none"></div>
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center px-3 py-1 bg-blue-500/30 border border-blue-400/30 rounded-full backdrop-blur-sm text-blue-50 text-xs font-semibold uppercase tracking-wider mb-4">
              <span className="mr-2 text-lg leading-none">👋</span> Welcome Back
            </div>
            <h1 className="text-3xl md:text-4xl font-extrabold mb-3 tracking-tight">
              Hello, Doctor!
            </h1>
            <p className="text-blue-100 text-lg max-w-lg font-medium leading-relaxed opacity-90">
              Manage schedules, queues, consultations, and clinic operations from your centralized portal.
            </p>
          </div>
          <div className="hidden md:flex items-center justify-center w-24 h-24 bg-white/10 rounded-3xl backdrop-blur-md border border-white/20 shadow-inner">
             <Activity className="w-12 h-12 text-blue-100" />
          </div>
        </div>
      </div>

      {/* Quick Access Grid */}
      <div>
        <h2 className="text-xl font-bold text-slate-800 mb-6 px-2 flex items-center">
          Quick Access
          <div className="ml-4 h-px bg-slate-200 flex-grow"></div>
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {quickLinks.map((link) => (
            <Link 
              key={link.title} 
              to={link.path}
              className="group bg-white rounded-2xl p-6 border border-slate-100 shadow-[0_4px_20px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)] hover:-translate-y-1 transition-all duration-300 relative overflow-hidden"
            >
              {/* Subtle gradient hover background */}
              <div className="absolute inset-0 bg-gradient-to-br from-white to-slate-50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
              
              <div className="relative z-10 flex items-start">
                <div className={`${link.lightBg} p-4 rounded-2xl mr-5 group-hover:scale-110 transition-transform duration-300 shadow-sm`}>
                  <link.icon className={`w-8 h-8 ${link.textColor}`} />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-slate-800 mb-1 group-hover:text-blue-600 transition-colors duration-300">
                    {link.title}
                  </h3>
                  <p className="text-slate-500 text-sm leading-relaxed">
                    {link.description}
                  </p>
                </div>
                <div className="ml-4 flex h-10 w-10 items-center justify-center rounded-full bg-slate-50 border border-slate-100 group-hover:bg-blue-50 group-hover:border-blue-100 transition-colors duration-300">
                  <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-blue-600 transition-colors duration-300" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
