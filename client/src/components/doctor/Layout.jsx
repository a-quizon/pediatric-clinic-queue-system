import { Outlet, NavLink, useLocation, useNavigate } from "react-router-dom";
import { Home, Users, User, BarChart3, ArrowLeft, CalendarDays } from "lucide-react";
import { PqBrand } from "../parent/pqUi";
import { goBackOr } from "../../utils/navigationRoots";

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();

  const getHeaderInfo = () => {
    const path = location.pathname;
    if (path === "/doctor" || path === "/doctor/") {
      return { title: "Dashboard", showBack: false };
    }
    if (path.startsWith("/doctor/queue")) {
      return { title: "Queue", showBack: false };
    }
    if (path.startsWith("/doctor/schedules")) {
      return { title: "Schedules", showBack: false };
    }
    if (path.startsWith("/doctor/reports")) {
      return { title: "Reports & Analytics", showBack: true, backPath: "/doctor" };
    }
    if (path.startsWith("/doctor/profile")) {
      const view = new URLSearchParams(location.search).get("view");
      if (view === "account") return { title: "Account Settings", showBack: true, backPath: "/doctor/profile" };
      if (view === "system") return { title: "About System", showBack: true, backPath: "/doctor/profile" };
      return { title: "Profile", showBack: false };
    }
    return { title: "Dashboard", showBack: false };
  };

  const headerInfo = getHeaderInfo();

  const navItems = [
    { name: "Dashboard", mobileName: "Home", path: "/doctor", icon: Home, replace: true },
    { name: "Queue", path: "/doctor/queue", icon: Users, replace: true },
    { name: "Schedules", path: "/doctor/schedules", icon: CalendarDays, replace: true },
    { name: "Reports & Analytics", mobileName: "Reports", path: "/doctor/reports", icon: BarChart3, desktopOnly: true },
    { name: "Profile", path: "/doctor/profile", icon: User, replace: true },
  ];

  const isActive = (path) => {
    if (path === "/doctor") {
      return location.pathname === "/doctor" || location.pathname === "/doctor/";
    }
    return location.pathname.startsWith(path);
  };

  const handleBack = () => {
    goBackOr(navigate, headerInfo.backPath || "/doctor");
  };

  return (
    <div className="pq-shell flex h-screen md:flex-row flex-col overflow-hidden">
      <aside className="hidden md:flex flex-col w-64 pq-glass-nav z-20 flex-shrink-0 rounded-none border-y-0 border-l-0">
        <div className="p-6 flex items-center" style={{ borderBottom: "1px solid var(--pq-glass-line)" }}>
          <PqBrand size={36} />
        </div>
        <nav className="flex-1 py-6 px-4 space-y-1.5 overflow-y-auto" aria-label="Doctor">
          {navItems.map((item) => (
            <NavLink
              key={item.name}
              to={item.path}
              replace={item.replace === true}
              aria-current={isActive(item.path) ? "page" : undefined}
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
          </header>
        </div>

        <div className="p-4 sm:p-6 md:p-8 lg:p-10 max-w-5xl mx-auto w-full flex-1">
          <Outlet />
        </div>
      </main>

      <nav className="md:hidden pq-dock-wrap" aria-label="Main">
        <div className="pq-dock">
          {navItems.filter((item) => !item.desktopOnly).map((item) => {
            const active = isActive(item.path);
            const label = item.mobileName || item.name;
            return (
              <NavLink
                key={item.name}
                to={item.path}
                replace={item.replace === true}
                aria-label={item.name}
                aria-current={active ? "page" : undefined}
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
