import React, { useEffect, useState } from "react";
import { Outlet, NavLink, useLocation, useNavigate } from "react-router-dom";
import { Home, CalendarPlus, Ticket, User, ArrowLeft, Bell } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { subscribeToUserNotifications } from "../../services/notificationCenterService";
import { goBackOr } from "../../utils/navigationRoots";
import { PqBrand } from "./pqUi";

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
    { name: "Reserve Queue", mobileName: "Reserve", path: "/parent/reserve", icon: CalendarPlus, tour: "nav-reserve" },
    { name: "My Reservations", mobileName: "Tickets", path: "/parent/reservations", icon: Ticket, tour: "nav-tickets" },
    { name: "My Profile", mobileName: "Profile", path: "/parent/profile", icon: User, tour: "nav-profile" },
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
      return { title: "My Reservations", showBack: false };
    }
    if (path.startsWith("/parent/reservations/")) {
      return { title: "QR Ticket", showBack: true, backPath: "/parent/reservations" };
    }
    if (path === "/parent/profile" || path === "/parent/profile/") {
      return { title: "My Profile", showBack: false };
    }
    if (path.includes("/history")) {
      return { title: "Reservation History", showBack: true, backPath: "/parent/profile" };
    }
    if (path.includes("/personal-info")) {
      return { title: "Account", showBack: true, backPath: "/parent/profile" };
    }
    if (path.includes("/children")) {
      return { title: "Child Profiles", showBack: true, backPath: "/parent/profile" };
    }
    if (path.includes("/notification-settings")) {
      return { title: "Notification Settings", showBack: true, backPath: "/parent/profile" };
    }
    if (path === "/parent/notifications" || path.startsWith("/parent/notifications/")) {
      return { title: "Notifications", showBack: true, backPath: "/parent" };
    }
    return { title: "Home", showBack: false };
  };

  const headerInfo = getHeaderInfo();

  const handleBack = () => {
    goBackOr(navigate, headerInfo.backPath || "/parent");
  };

  return (
    <div className="pq-shell flex h-screen md:flex-row flex-col overflow-hidden">
      <aside className="hidden md:flex flex-col w-64 pq-glass-nav z-20 flex-shrink-0 rounded-none border-y-0 border-l-0">
        <div className="p-6 flex items-center" style={{ borderBottom: "1px solid var(--pq-glass-line)" }}>
          <PqBrand size={36} />
        </div>
        <nav className="flex-1 py-6 px-4 space-y-1.5 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.name}
              to={item.path}
              replace
              aria-current={isActive(item.path) ? "page" : undefined}
              data-tour={item.tour}
              className={() =>
                `pq-side-link ${isActive(item.path) ? "pq-side-link-active" : ""}`
              }
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              <span>{item.name}</span>
            </NavLink>
          ))}
        </nav>
      </aside>

      <main className="flex-1 overflow-y-auto w-full md:pb-0 pb-[6.5rem] h-full relative flex flex-col bg-transparent">
        <div className="pq-header-wrap">
          <header className="pq-header-pill">
            <div className="flex items-center gap-3 min-w-0">
              {headerInfo.showBack ? (
                <button
                  onClick={handleBack}
                  className="pq-icon-btn flex-shrink-0"
                  aria-label="Go back"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
              ) : (
                <span className="md:hidden flex-shrink-0">
                  <PqBrand size={32} wordmark={false} />
                </span>
              )}
              <h1 className="text-lg sm:text-xl font-extrabold tracking-tight truncate">
                {headerInfo.title}
              </h1>
            </div>

            <button
              onClick={() => navigate("/parent/notifications")}
              className="pq-icon-btn relative flex-shrink-0"
              aria-label="Notifications"
              data-tour="nav-notifications"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-0.5 right-0.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white rounded-full border-2 border-white" style={{ background: "var(--pq-alert)" }}>
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </button>
          </header>
        </div>

        <div className="p-4 sm:p-6 md:p-8 lg:p-10 max-w-5xl mx-auto w-full flex-1">
          <Outlet />
        </div>
      </main>

      <nav className="md:hidden pq-dock-wrap" aria-label="Main">
        <div className="pq-dock">
          {navItems.map((item) => {
            const active = isActive(item.path);
            const label = item.mobileName || item.name;
            return (
              <NavLink
                key={item.name}
                to={item.path}
                replace
                aria-label={item.name}
                aria-current={active ? "page" : undefined}
                data-tour={item.tour}
                className={`pq-dock-item ${active ? "pq-dock-item-active" : ""}`}
              >
                <item.icon
                  className="w-[22px] h-[22px] flex-shrink-0"
                  strokeWidth={active ? 2 : 1.85}
                  fill={active ? "currentColor" : "none"}
                  aria-hidden="true"
                />
                <span className="pq-dock-label">{label}</span>
              </NavLink>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
