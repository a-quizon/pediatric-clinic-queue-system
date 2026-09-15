import React from "react";
import { useAuth } from "../../hooks/useAuth";
import { User, History, ChevronRight, Baby, Bell } from "lucide-react";
import { Link } from "react-router-dom";
import LogoutButton from "../../components/common/LogoutButton";

export default function Profile() {
  const { user } = useAuth();

  if (!user) return null;

  const menuItems = [
    {
      title: "Account",
      description: "View and edit your account information.",
      icon: User,
      path: "/parent/profile/personal-info",
      tour: "profile-account",
    },
    {
      title: "Notification Settings",
      description: "Manage in-app alerts and device push notifications.",
      icon: Bell,
      path: "/parent/profile/notification-settings",
      tour: "profile-notifications",
    },
    {
      title: "Child Profiles",
      description: "Add and manage children for reservations.",
      icon: Baby,
      path: "/parent/profile/children",
      tour: "profile-children",
    },
    {
      title: "Reservation History",
      description: "View completed, cancelled, and forfeited reservations.",
      icon: History,
      path: "/parent/profile/history",
      tour: "profile-history",
    }
  ];

  return (
    <div className="space-y-5 pb-8 max-w-2xl mx-auto">
      <section className="pq-glass p-6 sm:p-8 flex flex-col sm:flex-row items-center gap-5 text-center sm:text-left">
        <div className="w-20 h-20 rounded-full flex flex-shrink-0 items-center justify-center" style={{ background: "color-mix(in srgb, var(--pq-mark-blue) 14%, white)", color: "var(--pq-mark-blue-deep)" }}>
          <User className="w-10 h-10" />
        </div>
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight">{user?.fullName || user?.displayName || user?.name || "Parent Account"}</h2>
          <p className="pq-muted font-medium mt-1">{user?.email || "Loading email..."}</p>
        </div>
      </section>

      <nav className="pq-glass overflow-hidden">
        {menuItems.map((item, index) => (
          <Link
            to={item.path}
            key={item.path}
            data-tour={item.tour}
            className="flex items-center justify-between gap-3 p-5 min-h-[72px] transition-colors"
            style={{ borderTop: index === 0 ? "none" : "1px solid var(--pq-glass-line)" }}
          >
            <div className="flex items-center gap-4 min-w-0">
              <div className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: "color-mix(in srgb, var(--pq-mark-blue) 12%, white)", color: "var(--pq-mark-blue-deep)" }}>
                <item.icon className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="font-extrabold truncate">{item.title}</h3>
                <p className="text-sm pq-muted mt-0.5">{item.description}</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 pq-faint flex-shrink-0" />
          </Link>
        ))}
      </nav>

      <div className="pt-2">
        <LogoutButton className="pq-btn-danger w-full" />
      </div>
    </div>
  );
}
