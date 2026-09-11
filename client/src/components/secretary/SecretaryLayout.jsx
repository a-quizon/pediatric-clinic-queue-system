import { Outlet, NavLink, useLocation } from "react-router-dom";
import { Home, QrCode, Users, User, Activity, CalendarDays } from "lucide-react";
import PageHeader from "../common/PageHeader";

export default function SecretaryLayout() {
  const location = useLocation();

  const getHeaderInfo = () => {
    const path = location.pathname;
    if (path === "/secretary" || path === "/secretary/") {
      return { desktop: "Dashboard", mobile: "Home" };
    }
    if (path.startsWith("/secretary/schedules")) {
      return { desktop: "Schedules", mobile: "Schedules" };
    }
    if (path.startsWith("/secretary/validate")) {
      return { desktop: "Validation", mobile: "Validation" };
    }
    if (path.startsWith("/secretary/queue")) {
      return { desktop: "Manage Queue", mobile: "Manage Queue" };
    }
    if (path.startsWith("/secretary/profile")) {
      return { desktop: "Profile", mobile: "Profile" };
    }

    return { desktop: "Dashboard", mobile: "Home" };
  };

  const headerInfo = getHeaderInfo();

  const navItems = [
    { name: "Dashboard", path: "/secretary", icon: Home },
    { name: "Schedules", path: "/secretary/schedules", icon: CalendarDays },
    { name: "Validate Reservation", mobileName: "Validate", path: "/secretary/validate", icon: QrCode, prominent: true },
    { name: "Manage Queue", mobileName: "Queue", path: "/secretary/queue", icon: Users },
    { name: "Profile", path: "/secretary/profile", icon: User },
  ];

  const isActive = (path) => {
    if (path === "/secretary") {
      return location.pathname === "/secretary" || location.pathname === "/secretary/";
    }
    return location.pathname.startsWith(path);
  };

  const sideNavItems = navItems;
  const mobileSideItems = navItems.filter((item) => !item.prominent);
  // Mobile order: Dashboard, Schedules | Validate FAB | Queue, Profile
  const mobileLeft = mobileSideItems.slice(0, 2);
  const mobileRight = mobileSideItems.slice(2);
  const validateItem = navItems.find((item) => item.prominent);

  return (
    <div className="flex h-screen bg-white md:bg-gray-50 md:flex-row flex-col font-sans overflow-hidden">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-white border-r border-gray-100 z-20">
        <div className="p-6 flex items-center border-b border-gray-50">
          <Activity className="w-6 h-6 text-blue-600 mr-3" />
          <h1 className="text-lg font-bold text-gray-800">Secretary Portal</h1>
        </div>
        <nav className="flex-1 py-6 px-4 space-y-1 overflow-y-auto">
          {sideNavItems.map((item) => {
            const active = isActive(item.path);
            if (item.prominent) {
              return (
                <NavLink
                  key={item.name}
                  to={item.path}
                  className={() =>
                    `flex items-center px-4 py-3.5 rounded-xl transition-all duration-200 my-2 ${
                      active
                        ? "bg-blue-600 text-white font-semibold shadow-md shadow-blue-600/25"
                        : "bg-blue-50 text-blue-700 font-semibold border border-blue-100 hover:bg-blue-100"
                    }`
                  }
                >
                  {() => (
                    <>
                      <item.icon
                        className={`w-5 h-5 mr-3 ${active ? "text-white" : "text-blue-600"}`}
                      />
                      <span className="text-[14px]">{item.name}</span>
                    </>
                  )}
                </NavLink>
              );
            }
            return (
              <NavLink
                key={item.name}
                to={item.path}
                className={() =>
                  `flex items-center px-4 py-3 rounded-xl transition-colors duration-200 ${
                    active
                      ? "bg-blue-50 text-blue-600 font-semibold"
                      : "text-gray-500 hover:bg-gray-50 hover:text-gray-800 font-medium"
                  }`
                }
              >
                {() => (
                  <>
                    <item.icon
                      className={`w-5 h-5 mr-3 ${
                        active ? "text-blue-600" : "text-gray-400"
                      }`}
                    />
                    <span className="text-[14px]">{item.name}</span>
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto w-full md:pb-0 pb-28 bg-gray-50 h-full relative flex flex-col">
        <PageHeader
          desktopTitle={headerInfo.desktop}
          mobileTitle={headerInfo.mobile}
        />

        <div className="p-4 md:p-8 lg:p-10 max-w-5xl mx-auto flex-1 w-full">
          <Outlet />
        </div>
      </main>

      {/* Mobile Bottom Navigation — GCash-style raised Validate FAB */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 z-40 pb-safe">
        <div className="relative flex items-end justify-around h-16 px-1">
          {mobileLeft.map((item) => (
            <NavLink
              key={item.name}
              to={item.path}
              className="flex flex-col items-center justify-center flex-1 h-full space-y-1"
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
                    <span
                      className={`text-[10px] transition-colors ${
                        active ? "text-blue-600 font-semibold" : "text-gray-500 font-medium"
                      }`}
                    >
                      {item.mobileName || item.name}
                    </span>
                  </>
                );
              }}
            </NavLink>
          ))}

          {validateItem && (
            <NavLink
              to={validateItem.path}
              className="flex flex-col items-center justify-end flex-1 h-full -mt-6"
            >
              {() => {
                const active = isActive(validateItem.path);
                return (
                  <>
                    <span
                      className={`flex items-center justify-center w-14 h-14 rounded-full shadow-lg transition-transform ${
                        active
                          ? "bg-blue-700 text-white scale-105 shadow-blue-600/40"
                          : "bg-blue-600 text-white shadow-blue-600/30"
                      }`}
                    >
                      <validateItem.icon className="w-7 h-7" strokeWidth={2.25} />
                    </span>
                    <span
                      className={`text-[10px] mt-1 transition-colors ${
                        active ? "text-blue-600 font-semibold" : "text-gray-500 font-medium"
                      }`}
                    >
                      {validateItem.mobileName || validateItem.name}
                    </span>
                  </>
                );
              }}
            </NavLink>
          )}

          {mobileRight.map((item) => (
            <NavLink
              key={item.name}
              to={item.path}
              className="flex flex-col items-center justify-center flex-1 h-full space-y-1"
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
                    <span
                      className={`text-[10px] transition-colors ${
                        active ? "text-blue-600 font-semibold" : "text-gray-500 font-medium"
                      }`}
                    >
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
