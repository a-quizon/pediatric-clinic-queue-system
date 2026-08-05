import { Outlet, NavLink, useLocation } from "react-router-dom";
import { Home, QrCode, Users, User, Activity } from "lucide-react";
import PageHeader from "../common/PageHeader";

export default function SecretaryLayout() {
  const location = useLocation();

  const getHeaderInfo = () => {
    const path = location.pathname;
    if (path === "/secretary" || path === "/secretary/") {
      return { desktop: "Dashboard", mobile: "Home" };
    }
    if (path.startsWith("/secretary/validate")) {
      return { desktop: "Validation", mobile: "Validation" };
    }
    if (path.startsWith("/secretary/queue")) {
      return { desktop: "Queue", mobile: "Queue" };
    }
    if (path.startsWith("/secretary/reservations")) {
      return { desktop: "Reservations", mobile: "Reservations" };
    }
    if (path.startsWith("/secretary/history")) {
      return { desktop: "History", mobile: "History" };
    }
    if (path.startsWith("/secretary/profile")) {
      return { desktop: "Profile", mobile: "Profile" };
    }

    return { desktop: "Dashboard", mobile: "Home" };
  };

  const headerInfo = getHeaderInfo();

  const navItems = [
    { name: "Dashboard", path: "/secretary", icon: Home },
    { name: "Validate Reservation", mobileName: "Validate", path: "/secretary/validate", icon: QrCode },
    { name: "Manage Queue", mobileName: "Queue", path: "/secretary/queue", icon: Users },

    { name: "Profile", path: "/secretary/profile", icon: User },
  ];

  const isActive = (path) => {
    if (path === "/secretary") {
      return location.pathname === "/secretary" || location.pathname === "/secretary/";
    }
    return location.pathname.startsWith(path);
  };

  return (
    <div className="flex h-screen bg-white md:bg-gray-50 md:flex-row flex-col font-sans overflow-hidden">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-white border-r border-gray-100 z-20">
        <div className="p-6 flex items-center border-b border-gray-50">
          <Activity className="w-6 h-6 text-blue-600 mr-3" />
          <h1 className="text-lg font-bold text-gray-800">Secretary Portal</h1>
        </div>
        <nav className="flex-1 py-6 px-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.name}
              to={item.path}
              className={() =>
                `flex items-center px-4 py-3 rounded-xl transition-colors duration-200 ${
                  isActive(item.path)
                    ? "bg-blue-50 text-blue-600 font-semibold"
                    : "text-gray-500 hover:bg-gray-50 hover:text-gray-800 font-medium"
                }`
              }
            >
              {() => (
                <>
                  <item.icon 
                    className={`w-5 h-5 mr-3 ${
                      isActive(item.path) ? "text-blue-600" : "text-gray-400"
                    }`} 
                  />
                  <span className="text-[14px]">
                    {item.name}
                  </span>
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto w-full md:pb-0 pb-24 bg-gray-50 h-full relative flex flex-col">
        <PageHeader 
          desktopTitle={headerInfo.desktop} 
          mobileTitle={headerInfo.mobile} 
        />

        <div className="p-4 md:p-8 lg:p-10 max-w-5xl mx-auto flex-1 w-full">
          <Outlet />
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 z-40 pb-safe">
        <div className="flex justify-around items-center h-16 px-1">
          {navItems.filter(item => !item.desktopOnly).map((item) => (
            <NavLink
              key={item.name}
              to={item.path}
              className="flex flex-col items-center justify-center w-full h-full space-y-1"
            >
              {() => {
                const active = isActive(item.path);
                return (
                  <>
                    <item.icon 
                      className={`w-[22px] h-[22px] transition-colors ${
                        active ? "text-blue-600" : "text-gray-400"
                      }`} 
                    />
                    <span className={`text-[10px] transition-colors ${
                      active ? "text-blue-600 font-semibold" : "text-gray-500 font-medium"
                    }`}>
                      {item.mobileName || item.name}
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
