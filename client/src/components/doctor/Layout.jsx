import { useState, useCallback } from "react";
import { Outlet, NavLink, useLocation, useNavigate } from "react-router-dom";
import { Home, Users, User, BarChart3, ArrowLeft, CalendarDays, LogOut } from "lucide-react";
import { PqBrand } from "../parent/pqUi";
import MobileNavDrawer, { MobileNavToggle } from "../common/MobileNavDrawer";
import ConfirmationModal from "../common/ConfirmationModal";
import { useLogout } from "../../hooks/useLogout";

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const closeMenu = useCallback(() => setIsMenuOpen(false), []);
  const {
    isLogoutModalOpen,
    isLoggingOut,
    openLogoutModal,
    closeLogoutModal,
    handleLogout,
  } = useLogout();

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
    { name: "Dashboard", mobileName: "Home", path: "/doctor", icon: Home },
    { name: "Queue", path: "/doctor/queue", icon: Users },
    { name: "Schedules", path: "/doctor/schedules", icon: CalendarDays },
    { name: "Reports & Analytics", mobileName: "Reports", path: "/doctor/reports", icon: BarChart3 },
    { name: "Profile", path: "/doctor/profile", icon: User },
  ];

  const isActive = (path) => {
    if (path === "/doctor") {
      return location.pathname === "/doctor" || location.pathname === "/doctor/";
    }
    return location.pathname.startsWith(path);
  };

  const handleBack = () => {
    if (headerInfo.backPath) {
      navigate(headerInfo.backPath);
    } else {
      navigate(-1);
    }
  };

  const onLogoutClick = () => {
    closeMenu();
    openLogoutModal();
  };

  const renderNavLinks = () =>
    navItems.map((item) => (
      <NavLink
        key={item.name}
        to={item.path}
        aria-current={isActive(item.path) ? "page" : undefined}
        className={() =>
          `pq-side-link ${isActive(item.path) ? "pq-side-link-active" : ""}`
        }
      >
        <item.icon className="w-5 h-5 flex-shrink-0" />
        <span>{item.name}</span>
      </NavLink>
    ));

  return (
    <div className="pq-shell flex h-screen md:flex-row flex-col overflow-hidden">
      <aside className="hidden md:flex flex-col w-64 pq-glass-nav z-20 flex-shrink-0 rounded-none border-y-0 border-l-0">
        <div className="p-6 flex items-center" style={{ borderBottom: "1px solid var(--pq-glass-line)" }}>
          <PqBrand size={36} />
        </div>
        <nav className="flex-1 py-6 px-4 space-y-1.5 overflow-y-auto" aria-label="Doctor">
          {renderNavLinks()}
        </nav>
      </aside>

      <main className="flex-1 overflow-y-auto w-full h-full relative flex flex-col bg-transparent">
        <div className="pq-header-wrap">
          <header className="pq-header-pill">
            <div className="flex items-center gap-3 min-w-0">
              <MobileNavToggle
                open={isMenuOpen}
                onToggle={() => setIsMenuOpen((open) => !open)}
                controlsId="doctor-mobile-menu"
              />
              {headerInfo.showBack ? (
                <button
                  type="button"
                  onClick={handleBack}
                  className="pq-icon-btn flex-shrink-0"
                  aria-label="Go back"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
              ) : null}
              <h1 className="text-lg sm:text-xl font-extrabold tracking-tight truncate">
                {headerInfo.title}
              </h1>
            </div>
          </header>
        </div>

        <div className="p-4 sm:p-6 md:p-8 lg:p-10 max-w-5xl mx-auto w-full flex-1">
          <Outlet />
        </div>

        <ConfirmationModal
          isOpen={isLogoutModalOpen}
          onClose={closeLogoutModal}
          onConfirm={handleLogout}
          title="Log Out"
          message="Are you sure you want to logout?"
          confirmText="Log Out"
          cancelText="Cancel"
          isLoading={isLoggingOut}
          isDestructive={true}
        />
      </main>

      <MobileNavDrawer
        id="doctor-mobile-menu"
        open={isMenuOpen}
        onClose={closeMenu}
        label="Doctor"
        footer={
          <button type="button" onClick={onLogoutClick} className="pq-btn-danger w-full">
            <LogOut className="w-5 h-5" aria-hidden="true" />
            Log Out
          </button>
        }
      >
        {renderNavLinks()}
      </MobileNavDrawer>
    </div>
  );
}
