import { Outlet, NavLink, useLocation, useNavigate } from "react-router-dom";
import { Home, QrCode, Users, User, CalendarDays, ChevronLeft } from "lucide-react";
import { PqBrand } from "../parent/pqUi";
import { goBackOr } from "../../utils/navigationRoots";
import LogoutButton from "../common/LogoutButton";

export default function SecretaryLayout() {
  const location = useLocation();
  const navigate = useNavigate();

  const getHeaderInfo = () => {
    const path = location.pathname;
    if (path === "/secretary" || path === "/secretary/") {
      return { title: "Dashboard" };
    }
    if (path.startsWith("/secretary/schedules")) {
      return { title: "Schedules" };
    }
    if (path.startsWith("/secretary/validate")) {
      return { title: "Validate Reservation" };
    }
    if (path.startsWith("/secretary/queue")) {
      return { title: "Manage Queue" };
    }
    if (path.startsWith("/secretary/profile")) {
      return { title: "Profile" };
    }
    if (path.startsWith("/secretary/settings")) {
      return { title: "System Configuration", backTo: "/secretary/profile" };
    }

    return { title: "Dashboard" };
  };

  const headerInfo = getHeaderInfo();

  const navItems = [
    { name: "Dashboard", mobileName: "Home", path: "/secretary", icon: Home, tour: "nav-dashboard" },
    { name: "Schedules", path: "/secretary/schedules", icon: CalendarDays, tour: "nav-schedules" },
    { name: "Validate Reservation", mobileName: "Validate", path: "/secretary/validate", icon: QrCode, tour: "nav-validate" },
    { name: "Manage Queue", mobileName: "Queue", path: "/secretary/queue", icon: Users, tour: "nav-queue" },
    { name: "Profile", path: "/secretary/profile", icon: User, tour: "nav-profile" },
  ];

  const isActive = (path) => {
    if (path === "/secretary") {
      return location.pathname === "/secretary" || location.pathname === "/secretary/";
    }
    return location.pathname.startsWith(path);
  };

  return (
    <div className="pq-shell flex h-screen md:flex-row flex-col overflow-hidden">
      <aside className="hidden md:flex flex-col w-64 pq-glass-nav z-20 flex-shrink-0 rounded-none border-y-0 border-l-0">
        <div className="p-6 flex items-center" style={{ borderBottom: "1px solid var(--pq-glass-line)" }}>
          <PqBrand size={36} />
        </div>
        <nav className="flex-1 min-h-0 py-4 px-4 space-y-1.5 overflow-y-auto pq-scroll-y" aria-label="Secretary">
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
        <div className="p-4 mt-auto" style={{ borderTop: "1px solid var(--pq-glass-line)" }}>
          <LogoutButton className="pq-btn-danger w-full" />
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto pq-scroll-y w-full md:pb-0 pb-[6.5rem] h-full relative flex flex-col bg-transparent">
        <div className="pq-header-wrap">
          <header className="pq-header-pill">
            <div className="flex items-center gap-3 min-w-0">
              {headerInfo.backTo ? (
                <button
                  type="button"
                  onClick={() => goBackOr(navigate, headerInfo.backTo)}
                  className="pq-icon-btn shrink-0"
                  aria-label="Back to profile"
                >
                  <ChevronLeft className="w-5 h-5" aria-hidden="true" />
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
        <div className="pq-dock pq-dock-5">
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
