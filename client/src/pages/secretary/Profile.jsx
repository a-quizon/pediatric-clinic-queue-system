import React, { useState } from "react";
import { User, Mail, MapPin, Phone, UserPlus } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import LogoutButton from "../../components/common/LogoutButton";
import WalkInPatientModal from "../../components/secretary/WalkInPatientModal";

export default function Profile() {
  const { user } = useAuth();
  const [isWalkInOpen, setIsWalkInOpen] = useState(false);

  if (!user) return null;

  return (
    <div className="space-y-6 pb-8 max-w-2xl mx-auto flex flex-col min-h-[70vh]">
      <div className="flex-1 space-y-6">
        <section className="pq-glass p-6 sm:p-8 flex flex-col sm:flex-row items-center gap-5 text-center sm:text-left">
          <div
            className="w-24 h-24 rounded-full flex flex-shrink-0 items-center justify-center"
            style={{ background: "color-mix(in srgb, var(--pq-mark-blue) 14%, white)", color: "var(--pq-mark-blue-deep)" }}
          >
            <User className="w-12 h-12" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h2 className="text-2xl font-extrabold tracking-tight">
              {user?.fullName || user?.displayName || user?.name || "Secretary Account"}
            </h2>
            <div className="mt-4 space-y-2.5 flex flex-col items-center sm:items-start">
              <div className="flex items-center text-sm font-medium pq-muted">
                <Mail className="w-4 h-4 mr-3 pq-faint" aria-hidden="true" />
                {user?.email || "No email available"}
              </div>
              <div className="flex items-center text-sm font-medium pq-muted">
                <Phone className="w-4 h-4 mr-3 pq-faint" aria-hidden="true" />
                {user?.phone || "No phone number available"}
              </div>
              <div className="flex items-center text-sm font-medium pq-muted">
                <MapPin className="w-4 h-4 mr-3 pq-faint" aria-hidden="true" />
                Assigned Branch: <span className="ml-1 font-extrabold" style={{ color: "var(--pq-ink)" }}>{user?.assignedBranch || "None"}</span>
              </div>
            </div>
          </div>
        </section>

        <button
          type="button"
          onClick={() => setIsWalkInOpen(true)}
          className="pq-btn-primary w-full"
        >
          <UserPlus className="w-5 h-5" aria-hidden="true" />
          Walk-in Patient
        </button>
      </div>

      <div className="mt-auto pt-8">
        <LogoutButton className="pq-btn-danger w-full" />
      </div>

      <WalkInPatientModal isOpen={isWalkInOpen} onClose={() => setIsWalkInOpen(false)} />
    </div>
  );
}
