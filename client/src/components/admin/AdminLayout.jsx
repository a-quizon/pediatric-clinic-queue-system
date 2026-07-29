import { Outlet, NavLink, useLocation } from "react-router-dom";
import { Home, Users, MapPin, Activity as ActivityIcon, User, Shield } from "lucide-react";
import PageHeader from "../common/PageHeader";

export default function AdminLayout() {
  const location = useLocation();

  const getHeaderInfo = () => {
    const path = location.pathname;
    if (path === "/admin" || path === "/admin/") {
      return { desktop: "Dashboard", mobile: "Home" };
    }
    if (path.startsWith("/admin/users")) {
      return { desktop: "User Management", mobile: "Users" };
    }
    if (path.startsWith("/admin/branches")) {
      return { desktop: "Branch Management", mobile: "Branches" };
    }
    if (path.startsWith("/admin/activity")) {
      return { desktop: "Activity", mobile: "Activity" };
    }
    if (path.startsWith("/admin/profile")) {
      return { desktop: "Profile", mobile: "Profile" };
    }
    return { desktop: "Dashboard", mobile: "Home" };
  };

  const headerInfo = getHeaderInfo();

  const navItems = [
    { name: "Dashboard", path: "/admin", icon: Home },
    { name: "User Management", mobileName: "Users", path: "/admin/users", icon: Users },
    { name: "Branch Management", mobileName: "Branches", path: "/admin/branches", icon: MapPin },
    { name: "Activity", path: "/admin/activity", icon: ActivityIcon },
    { name: "Profile", path: "/admin/profile", icon: User },
  ];

  const isActive = (path) => {
    if (path === "/admin") {
      return location.pathname === "/admin" || location.pathname === "/admin/";
    }
    return location.pathname.startsWith(path);
  };

  return (
    <div className="flex h-screen bg-white md:bg-gray-50 md:flex-row flex-col font-sans overflow-hidden">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-white border-r border-gray-100 z-20">
        <div className="p-6 flex items-center border-b border-gray-50">
          <Shield className="w-6 h-6 text-blue-600 mr-3" />
          <h1 className="text-lg font-bold text-gray-800">Admin Portal</h1>
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
          icon={Shield}
        />

        <div className="p-4 md:p-8 lg:p-10 max-w-5xl mx-auto flex-1 w-full">
          <Outlet />
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 z-40 pb-safe">
        <div className="flex justify-around items-center h-16 px-1">
          {navItems.map((item) => (
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
