import { Outlet, NavLink, useLocation } from "react-router-dom";
import { Home, CalendarDays, Users, Stethoscope, User, BarChart3, Activity } from "lucide-react";

export default function Layout() {
  const location = useLocation();

  const navItems = [
    { name: "Home", path: "/doctor", icon: Home },
    { name: "Schedules", path: "/doctor/schedules", icon: CalendarDays },
    { name: "Queue", path: "/doctor/queue", icon: Users },
    { name: "Consultations", path: "/doctor/consultations", icon: Stethoscope },
    { name: "Reports", path: "/doctor/reports", icon: BarChart3, desktopOnly: true },
    { name: "Profile", path: "/doctor/profile", icon: User },
  ];

  // Exact matching for home route, otherwise partial matching for active state
  const isActive = (path) => {
    if (path === "/doctor") {
      return location.pathname === "/doctor" || location.pathname === "/doctor/";
    }
    return location.pathname.startsWith(path);
  };

  return (
    <div className="flex h-screen bg-[#F8FAFC] md:flex-row flex-col font-sans overflow-hidden">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-72 bg-white border-r border-slate-200 shadow-[4px_0_24px_rgba(0,0,0,0.02)] z-20 transition-all duration-300">
        <div className="p-6 flex items-center border-b border-slate-100">
          <div className="bg-blue-600 p-2 rounded-xl mr-3 shadow-md shadow-blue-200">
             <Activity className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800 leading-tight">Pediatric Clinic</h1>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Doctor Portal</p>
          </div>
        </div>
        <nav className="flex-1 py-6 px-4 space-y-2 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.name}
              to={item.path}
              className={({ isActive: isNavLinkActive }) =>
                `group flex items-center px-4 py-3.5 rounded-xl transition-all duration-300 relative overflow-hidden ${
                  isActive(item.path)
                    ? "bg-blue-50 text-blue-700 shadow-sm"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`
              }
            >
              {({ isActive: isNavLinkActive }) => (
                <>
                  {isActive(item.path) && (
                    <span className="absolute left-0 top-0 bottom-0 w-1 bg-blue-600 rounded-r-full shadow-[0_0_8px_rgba(37,99,235,0.6)]"></span>
                  )}
                  <item.icon 
                    className={`w-5 h-5 mr-3.5 transition-transform duration-300 group-hover:scale-110 ${
                      isActive(item.path) ? "text-blue-600" : "text-slate-400 group-hover:text-blue-500"
                    }`} 
                  />
                  <span className={`font-medium text-[15px] ${isActive(item.path) ? "font-semibold" : ""}`}>
                    {item.name}
                  </span>
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto w-full md:pb-0 pb-20 scroll-smooth">
        {/* Mobile Header */}
        <header className="md:hidden bg-white/80 backdrop-blur-md shadow-sm sticky top-0 z-30 p-4 border-b border-slate-100 transition-all duration-300">
          <div className="flex items-center justify-center">
             <div className="flex items-center space-x-2">
                <Activity className="w-5 h-5 text-blue-600" />
                <h1 className="text-lg font-bold text-slate-800">Doctor Portal</h1>
             </div>
          </div>
        </header>

        <div className="p-4 md:p-8 lg:p-10 max-w-7xl mx-auto h-full animate-in fade-in slide-in-from-bottom-4 duration-500 ease-out">
          <Outlet />
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-xl border-t border-slate-200 shadow-[0_-10px_40px_rgba(0,0,0,0.06)] z-40 pb-safe transition-all duration-300">
        <div className="flex justify-around items-center h-16 px-2 max-w-md mx-auto">
          {navItems.filter(item => !item.desktopOnly).map((item) => (
            <NavLink
              key={item.name}
              to={item.path}
              className="flex flex-col items-center justify-center w-full h-full space-y-1 relative group"
            >
              {({ isActive: isNavLinkActive }) => {
                const active = isActive(item.path);
                return (
                  <>
                    {active && (
                      <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-1 bg-blue-600 rounded-b-full shadow-[0_2px_8px_rgba(37,99,235,0.6)] animate-in fade-in zoom-in duration-300"></span>
                    )}
                    <item.icon 
                      className={`w-6 h-6 transition-all duration-300 ${
                        active 
                          ? "text-blue-600 scale-110 drop-shadow-md" 
                          : "text-slate-400 group-hover:text-blue-400 group-hover:scale-105"
                      }`} 
                    />
                    <span className={`text-[10px] transition-all duration-300 ${
                      active ? "text-blue-600 font-bold" : "text-slate-500 font-medium"
                    }`}>
                      {item.name}
                    </span>
                  </>
                );
              }}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
