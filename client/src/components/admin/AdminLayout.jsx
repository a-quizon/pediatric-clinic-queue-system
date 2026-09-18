import { useState, useCallback } from "react";
import { Outlet, NavLink, useLocation, useNavigate } from "react-router-dom";
import { Home, Users, MapPin, Plus, ChevronLeft, LogOut } from "lucide-react";
import { PqBrand } from "../parent/pqUi";
import AddStaffModal from "./AddStaffModal";
import ConfirmationModal from "../common/ConfirmationModal";
import MobileNavDrawer, { MobileNavToggle } from "../common/MobileNavDrawer";
import { useLogout } from "../../hooks/useLogout";
import { goBackOr } from "../../utils/navigationRoots";

export default function AdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
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
    if (path === "/admin" || path === "/admin/") {
      return { title: "Home" };
    }
    if (path.startsWith("/admin/users")) {
      return { title: "Users", showAddStaff: true };
    }
    if (path.startsWith("/admin/branches")) {
      return { title: "Branches", showAddBranch: true };
    }
    if (path.startsWith("/admin/activity")) {
      return { title: "System Activity", backTo: "/admin" };
    }
    return { title: "Home" };
  };

  const headerInfo = getHeaderInfo();

  const navItems = [
    { name: "Home", path: "/admin", icon: Home },
    { name: "Users", path: "/admin/users", icon: Users },
    { name: "Branches", path: "/admin/branches", icon: MapPin },
  ];

  const isActive = (path) => {
    if (path === "/admin") {
      return location.pathname === "/admin" || location.pathname === "/admin/";
    }
    return location.pathname.startsWith(path);
  };

  const onLogoutClick = () => {
    closeMenu();
    openLogoutModal();
  };

  const renderNavLinks = () =>
    navItems.map((item) => {
      const active = isActive(item.path);
      return (
        <NavLink
          key={item.name}
          to={item.path}
          replace
          end={item.path === "/admin"}
          aria-current={active ? "page" : undefined}
          className={`pq-side-link ${active ? "pq-side-link-active" : ""}`}
        >
          <item.icon className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
          <span>{item.name}</span>
        </NavLink>
      );
    });

  const renderLogout = () => (
    <button type="button" onClick={onLogoutClick} className="pq-btn-danger w-full">
      <LogOut className="w-5 h-5" aria-hidden="true" />
      Log Out
    </button>
  );

  return (
    <div className="pq-shell flex h-screen md:flex-row flex-col overflow-hidden">
      <aside className="hidden md:flex flex-col w-64 pq-glass-nav z-20 flex-shrink-0 rounded-none border-y-0 border-l-0">
        <div className="p-6 flex items-center" style={{ borderBottom: "1px solid var(--pq-glass-line)" }}>
          <PqBrand size={36} />
        </div>
        <nav className="flex-1 py-6 px-4 space-y-1.5 overflow-y-auto" aria-label="Admin">
          {renderNavLinks()}
        </nav>
        <div className="p-4" style={{ borderTop: "1px solid var(--pq-glass-line)" }}>
          {renderLogout()}
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto w-full h-full relative flex flex-col bg-transparent">
        <div className="pq-header-wrap">
          <header className="pq-header-pill">
            <div className="flex items-center gap-3 min-w-0">
              <MobileNavToggle
                open={isMenuOpen}
                onToggle={() => setIsMenuOpen((open) => !open)}
                controlsId="admin-mobile-menu"
              />
              {headerInfo.backTo ? (
                <button
                  type="button"
                  onClick={() => goBackOr(navigate, headerInfo.backTo)}
                  className="pq-icon-btn shrink-0"
                  aria-label="Back to Home"
                >
                  <ChevronLeft className="w-5 h-5" aria-hidden="true" />
                </button>
              ) : null}
              <h1 className="text-lg sm:text-xl font-extrabold tracking-tight truncate">
                {headerInfo.title}
              </h1>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {headerInfo.showAddStaff ? (
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(true)}
                  className="pq-btn-primary"
                >
                  <Plus className="w-5 h-5" aria-hidden="true" />
                  <span className="hidden sm:inline">Add Staff</span>
                  <span className="sm:hidden">Add</span>
                </button>
              ) : null}
              {headerInfo.showAddBranch ? (
                <button
                  type="button"
                  onClick={() => window.dispatchEvent(new CustomEvent("openAddBranchModal"))}
                  className="pq-btn-primary"
                >
                  <Plus className="w-5 h-5" aria-hidden="true" />
                  <span className="hidden sm:inline">Add Branch</span>
                  <span className="sm:hidden">Add</span>
                </button>
              ) : null}
            </div>
          </header>
        </div>

        <div className="p-4 sm:p-6 md:p-8 lg:p-10 max-w-5xl mx-auto w-full flex-1">
          <Outlet />
        </div>

        <AddStaffModal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          onSuccess={() => setIsAddModalOpen(false)}
        />

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
        id="admin-mobile-menu"
        open={isMenuOpen}
        onClose={closeMenu}
        label="Admin"
        footer={renderLogout()}
      >
        {renderNavLinks()}
      </MobileNavDrawer>
    </div>
  );
}
