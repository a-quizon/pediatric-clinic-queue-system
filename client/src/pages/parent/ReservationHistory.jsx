import React, { useState, useEffect } from "react";
import { useAuth } from "../../hooks/useAuth";
import { subscribeToParentReservations } from "../../services/reservationService";
import { getSchedules } from "../../services/scheduleService";
import { History, CalendarDays, MapPin, FileText } from "lucide-react";
import { useNavigate } from "react-router-dom";
import ReservationDetailsModal from "../../components/parent/ReservationDetailsModal";
import { getReservationChildDisplayName } from "../../utils/reservationPatients";

export default function ReservationHistory() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [reservations, setReservations] = useState([]);
  const [schedules, setSchedules] = useState({});
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Filters and Sorting
  const [activeFilter, setActiveFilter] = useState("All");

  // Modal State
  const [selectedReservation, setSelectedReservation] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    const fetchSchedules = async () => {
      const data = await getSchedules();
      setSchedules(data || {});
    };
    fetchSchedules();

    import("../../services/branchConfigurationService").then(({ getBranchConfigurations }) => {
      getBranchConfigurations().then(setBranches);
    });

    let unsub = () => {};
    if (user) {
      unsub = subscribeToParentReservations(user.uid, (data) => {
        const history = data.filter(r => 
          ["cancelled", "completed", "consultation_completed", "expired", "validation_expired", "forfeited", "penalized", "late_limit_reached"].includes(r.status)
        );
        setReservations(history);
        setLoading(false);
      });
    }
    return () => unsub();
  }, [user]);

  const getTerminalTimestamp = (res) => {
    return res.consultationCompletedAt || res.completedAt || res.cancelledAt || res.forfeitedAt || res.expiredAt || res.penalizedAt || res.createdAt;
  };

  const filteredAndSortedReservations = reservations
    .filter(res => {
      if (activeFilter === "All") return true;
      if (activeFilter === "Completed") return ["completed", "consultation_completed"].includes(res.status);
      if (activeFilter === "Cancelled") return res.status === "cancelled";
      if (activeFilter === "Forfeited" || activeFilter === "Late Limit Reached") return ["forfeited", "penalized", "late_limit_reached"].includes(res.status);
      if (activeFilter === "With Notes") {
        return ["completed", "consultation_completed"].includes(res.status) && !!res.doctorNotes && res.doctorNotes.trim() !== "";
      }
      return true;
    })
    .sort((a, b) => {
      const timeA = getTerminalTimestamp(a) || 0;
      const timeB = getTerminalTimestamp(b) || 0;
      return timeB - timeA;
    });

  const getStatusDisplay = (status) => {
    if (["completed", "consultation_completed"].includes(status)) {
      return { label: "Completed", color: "pq-chip pq-chip-live" };
    }
    if (status === "cancelled") {
      return { label: "Cancelled", color: "pq-chip pq-chip-alert" };
    }
    if (["forfeited", "penalized", "late_limit_reached"].includes(status)) {
      return { label: "Forfeited", color: "pq-chip pq-chip-alert" };
    }
    return { label: status.replace("_", " "), color: "pq-chip pq-chip-info" };
  };

  const getEmptyStateMessage = () => {
    switch (activeFilter) {
      case "Completed": return "No completed clinic reservations yet.";
      case "Cancelled": return "You have no cancelled clinic reservations.";
      case "Forfeited":
      case "Late Limit Reached": return "You have no forfeited reservations.";
      case "With Notes": return "No completed consultations with doctor's notes yet.";
      default: return "You haven't logged any past clinic reservations yet.";
    }
  };

  return (
    <div className="space-y-5 pb-8 relative" data-tour="reservation-history">
      <div className="pq-filter-bar pq-filter-stick p-4 sm:p-5">
        <div className="flex sm:flex-wrap gap-2 sm:gap-2.5 overflow-x-auto pb-2 sm:pb-0 scrollbar-hide w-full -mx-4 px-4 sm:mx-0 sm:px-0">
          {["All", "Completed", "Cancelled", "Forfeited", "With Notes"].map(filter => (
            <button
              key={filter}
              type="button"
              onClick={() => setActiveFilter(filter)}
              data-tour={filter === "With Notes" ? "history-notes-filter" : undefined}
              className={`px-4 sm:px-5 py-2.5 rounded-2xl text-xs sm:text-sm font-bold whitespace-nowrap flex-shrink-0 min-h-[44px] ${
                activeFilter === filter 
                  ? 'pq-btn-primary' 
                  : 'pq-btn-secondary'
              }`}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-20">
          <span className="pq-spinner" />
        </div>
      ) : filteredAndSortedReservations.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredAndSortedReservations.map(res => {
            const schedule = schedules[res.scheduleId] || {};
            const { label, color } = getStatusDisplay(res.status);
            const timestamp = getTerminalTimestamp(res);
            const hasNotes = !!res.doctorNotes && res.doctorNotes.trim() !== "";
            const queueNum = res.pNum || res.queuePosition || res.queueNumber || null;
            
            return (
              <div 
                key={res.id} 
                onClick={() => {
                  setSelectedReservation(res);
                  setIsModalOpen(true);
                }}
                className="pq-glass p-5 cursor-pointer group flex flex-col justify-between"
              >
                <div>
                  <div className="flex justify-between items-start mb-3.5 gap-2">
                    <div>
                      <div className="font-extrabold text-lg">{getReservationChildDisplayName(res)}</div>
                      <div className="text-xs pq-muted font-bold mt-0.5">Code: {res.reservationCode || "N/A"}</div>
                    </div>
                    <div className={`flex-shrink-0 ${color}`}>
                      {label}
                    </div>
                  </div>
                  
                  <div className="pq-row flex-col items-stretch py-4 mb-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="pq-muted flex items-center text-xs font-semibold">
                        <CalendarDays className="w-3.5 h-3.5 mr-1.5 flex-shrink-0" style={{ color: "var(--pq-mark-blue)" }} />
                        Date
                      </span>
                      <span className="font-bold">
                        {schedule.clinicDate ? new Date(schedule.clinicDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "Unknown Date"}
                      </span>
                    </div>
                    <div className="flex items-start justify-between text-sm">
                      <span className="pq-muted flex items-center text-xs font-semibold mt-0.5">
                        <MapPin className="w-3.5 h-3.5 mr-1.5 flex-shrink-0" style={{ color: "var(--pq-mark-coral)" }} />
                        Branch
                      </span>
                      <div className="flex flex-col text-right">
                        <span className="font-bold">{schedule.branch || "Unknown Branch"}</span>
                        <span className="text-[10px] pq-muted whitespace-pre-line mt-0.5 max-w-[150px]">
                          {branches.find(b => b.name === schedule.branch)?.clinicAddress || "No clinic address provided."}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-sm pt-1" style={{ borderTop: "1px solid var(--pq-glass-line)" }}>
                      <span className="pq-muted text-xs font-semibold">Queue Number</span>
                      <span className="font-extrabold" style={{ color: "var(--pq-mark-blue-deep)" }}>
                        {queueNum ? `Queue #${queueNum}` : "—"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex justify-between items-center pt-2.5 mt-auto gap-2" style={{ borderTop: "1px solid var(--pq-glass-line)" }}>
                  <div className="text-[11px] pq-faint font-medium">
                    {label === "Cancelled" ? "Cancelled on" : label === "Completed" ? "Completed on" : label === "Expired" ? "Expired on" : "Logged on"} {timestamp ? new Date(timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "N/A"}
                  </div>
                  {hasNotes && (
                    <span className="pq-chip pq-chip-info flex-shrink-0">
                      <FileText className="w-3 h-3 mr-1" />
                      With Notes
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="pq-glass p-12 text-center max-w-lg mx-auto mt-4">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: "color-mix(in srgb, var(--pq-mark-blue) 12%, white)", color: "var(--pq-mark-blue)" }}>
            <History className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold mb-1">
            {activeFilter === "All" ? "No Reservation History" : `No ${activeFilter} Reservations`}
          </h3>
          <p className="text-sm pq-muted max-w-sm mx-auto mt-1">{getEmptyStateMessage()}</p>
        </div>
      )}

      {/* Details Modal */}
      <ReservationDetailsModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        reservation={selectedReservation}
        schedule={selectedReservation ? schedules[selectedReservation.scheduleId] : null}
        clinicAddress={selectedReservation && schedules[selectedReservation.scheduleId] ? branches.find(b => b.name === schedules[selectedReservation.scheduleId].branch)?.clinicAddress : null}
      />
    </div>
  );
}
