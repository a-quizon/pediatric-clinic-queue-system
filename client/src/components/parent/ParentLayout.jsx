import React, { useEffect, useState } from "react";
import { Outlet, NavLink, useLocation, useNavigate } from "react-router-dom";
import { Home, CalendarPlus, Ticket, User, Activity, ArrowLeft, Bell } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { subscribeToUserNotifications } from "../../services/notificationCenterService";

export default function ParentLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user?.uid) return;
    const unsub = subscribeToUserNotifications(user.uid, (list) => {
      const count = list.filter((n) => !n.read).length;
      setUnreadCount(count);
    });
    return () => unsub();
  }, [user]);

  const navItems = [
    { name: "Home", path: "/parent", icon: Home },
    { name: "Reserve Queue", mobileName: "Reserve", path: "/parent/reserve", icon: CalendarPlus },
    { name: "My Reservation", mobileName: "My Reservation", path: "/parent/reservations", icon: Ticket },
    { name: "My Profile", mobileName: "Profile", path: "/parent/profile", icon: User },
  ];

  const isActive = (path) => {
    if (path === "/parent") {
      return location.pathname === "/parent" || location.pathname === "/parent/";
    }
    if (path === "/parent/reservations") {
      return location.pathname === "/parent/reservations" || location.pathname.startsWith("/parent/reservations/");
    }
    return location.pathname.startsWith(path);
  };

  const getHeaderInfo = () => {
    const path = location.pathname;
    if (path === "/parent" || path === "/parent/") {
      return { title: "Home", showBack: false };
    }
    if (path === "/parent/reserve" || path === "/parent/reserve/") {
      return { title: "Reserve Queue", showBack: false };
    }
    if (path === "/parent/reservations" || path === "/parent/reservations/") {
      return { title: "My Reservation", showBack: false };
    }
    if (path.startsWith("/parent/reservations/")) {
      return { title: "My Reservation", showBack: true, backPath: "/parent/reservations" };
    }
    if (path === "/parent/profile" || path === "/parent/profile/") {
      return { title: "My Profile", showBack: false };
    }
    if (path.includes("/history")) {
      return { title: "Reservation History", showBack: true, backPath: "/parent/profile" };
    }
    if (path.includes("/personal-info")) {
      return { title: "Personal Information", showBack: true, backPath: "/parent/profile" };
    }
    if (path.includes("/notifications")) {
      return { title: "Notifications", showBack: true, useHistoryBack: true, backPath: "/parent" };
    }
    return { title: "Home", showBack: false };
  };

  const headerInfo = getHeaderInfo();

  const handleBack = () => {
    if (headerInfo.useHistoryBack && window.history.state && window.history.state.idx > 0) {
      navigate(-1);
    } else if (headerInfo.backPath) {
      navigate(headerInfo.backPath);
    } else {
      navigate("/parent");
    }
  };

  return (
    <div className="flex h-screen bg-white md:bg-gray-50 md:flex-row flex-col font-sans overflow-hidden">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-white border-r border-gray-100 z-20 flex-shrink-0">
        <div className="p-6 flex items-center border-b border-gray-50">
          <Activity className="w-6 h-6 text-blue-600 mr-3 flex-shrink-0" />
          <h1 className="text-lg font-extrabold text-gray-800 tracking-tight">Pediatric Clinic</h1>
        </div>
        <nav className="flex-1 py-6 px-4 space-y-1.5 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.name}
              to={item.path}
              className={({ isActive: isNavLinkActive }) =>
                `flex items-center px-4 py-3 rounded-2xl transition-all duration-200 ${
                  isActive(item.path)
                    ? "bg-blue-600 text-white font-bold shadow-sm"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 font-semibold"
                }`
              }
            >
              {({ isActive: isNavLinkActive }) => (
                <>
                  <item.icon 
                    className={`w-5 h-5 mr-3 transition-colors ${
                      isActive(item.path) ? "text-white" : "text-gray-400"
                    }`} 
                  />
                  <span className="text-sm">
                    {item.name}
                  </span>
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto w-full md:pb-0 pb-20 bg-gray-50 h-full relative flex flex-col">
        {/* Standardized App Header (Visible across all screen sizes) */}
        <header className="bg-white shadow-xs sticky top-0 z-30 px-4 sm:px-6 md:px-8 py-3.5 sm:py-4 border-b border-gray-100 flex items-center justify-between min-h-[64px] flex-shrink-0">
          <div className="flex items-center gap-3">
            {headerInfo.showBack ? (
              <button
                onClick={handleBack}
                className="w-9 h-9 bg-gray-50 border border-gray-200/80 rounded-full flex items-center justify-center text-gray-700 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-all shadow-2xs focus:outline-none flex-shrink-0 group"
                aria-label="Go back"
              >
                <ArrowLeft className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" />
              </button>
            ) : (
              <Activity className="w-5 h-5 text-blue-600 md:hidden flex-shrink-0" />
            )}
            <h1 className="text-lg sm:text-xl font-extrabold text-gray-800 tracking-tight truncate">
              {headerInfo.title}
            </h1>
          </div>

          <button
            onClick={() => navigate("/parent/notifications")}
            className="relative p-2.5 rounded-full text-gray-600 hover:bg-gray-100 hover:text-blue-600 transition-colors focus:outline-none flex-shrink-0"
            aria-label="Notifications"
          >
            <Bell className="w-5 h-5 sm:w-6 sm:h-6" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-rose-600 rounded-full border-2 border-white shadow-xs">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </button>
        </header>

        <div className="p-4 sm:p-6 md:p-8 lg:p-10 max-w-5xl mx-auto w-full flex-1">
          <Outlet />
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 z-40 pb-safe shadow-lg">
        <div className="flex justify-around items-center h-16 px-2">
          {navItems.map((item) => (
            <NavLink
              key={item.name}
              to={item.path}
              className="flex flex-col items-center justify-center w-full h-full space-y-1 focus:outline-none"
            >
              {({ isActive: isNavLinkActive }) => {
                const active = isActive(item.path);
                return (
                  <>
                    <item.icon 
                      className={`w-[22px] h-[22px] transition-all ${
                        active ? "text-blue-600 scale-110" : "text-gray-400"
                      }`} 
                    />
                    <span className={`text-[10px] transition-colors ${
                      active ? "text-blue-600 font-extrabold" : "text-gray-500 font-medium"
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
