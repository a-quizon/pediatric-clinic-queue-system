import { useState, useCallback } from "react";
import { Outlet, NavLink, useLocation } from "react-router-dom";
import { Home, QrCode, Users, User, CalendarDays, ChevronLeft, LogOut } from "lucide-react";
import { PqBrand } from "../parent/pqUi";
import MobileNavDrawer, { MobileNavToggle } from "../common/MobileNavDrawer";
import ConfirmationModal from "../common/ConfirmationModal";
import { useLogout } from "../../hooks/useLogout";

export default function SecretaryLayout() {
  const location = useLocation();
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
    { name: "Dashboard", mobileName: "Home", path: "/secretary", icon: Home },
    { name: "Schedules", path: "/secretary/schedules", icon: CalendarDays },
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
        <nav className="flex-1 py-6 px-4 space-y-1.5 overflow-y-auto" aria-label="Secretary">
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
                controlsId="secretary-mobile-menu"
              />
              {headerInfo.backTo ? (
                <NavLink
                  to={headerInfo.backTo}
                  className="pq-icon-btn shrink-0"
                  aria-label="Back to profile"
                >
                  <ChevronLeft className="w-5 h-5" aria-hidden="true" />
                </NavLink>
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
        id="secretary-mobile-menu"
        open={isMenuOpen}
        onClose={closeMenu}
        label="Secretary"
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
