import React, { useState, useEffect } from "react";
import { useAuth } from "../../hooks/useAuth";
import { subscribeToAllReservations } from "../../services/reservationService";
import { getSchedules } from "../../services/scheduleService";
import { History, CalendarDays, MapPin, ArrowLeft, ArrowUpDown, FileText } from "lucide-react";
import { useNavigate } from "react-router-dom";
import ReservationDetailsModal from "../../components/parent/ReservationDetailsModal";

export default function ReservationHistory() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [reservations, setReservations] = useState([]);
  const [schedules, setSchedules] = useState({});
  const [loading, setLoading] = useState(true);
  
  // Filters and Sorting
  const [activeFilter, setActiveFilter] = useState("All");
  const [sortOrder, setSortOrder] = useState("newest"); // 'newest' or 'oldest'

  // Modal State
  const [selectedReservation, setSelectedReservation] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    const fetchSchedules = async () => {
      const data = await getSchedules();
      setSchedules(data || {});
    };
    fetchSchedules();

    let unsub = () => {};
    if (user) {
      unsub = subscribeToAllReservations((data) => {
        const history = data.filter(r => 
          r.parentId === user.uid && 
          ["cancelled", "completed", "consultation_completed", "expired", "penalized"].includes(r.status)
        );
        setReservations(history);
        setLoading(false);
      });
    }
    return () => unsub();
  }, [user]);

  const getTerminalTimestamp = (res) => {
    return res.consultationCompletedAt || res.completedAt || res.cancelledAt || res.expiredAt || res.penalizedAt || res.createdAt;
  };

  const filteredAndSortedReservations = reservations
    .filter(res => {
      if (activeFilter === "All") return true;
      if (activeFilter === "Completed") return ["completed", "consultation_completed"].includes(res.status);
      if (activeFilter === "Cancelled") return res.status === "cancelled";
      if (activeFilter === "Expired") return res.status === "expired";
      if (activeFilter === "Penalized") return res.status === "penalized";
      if (activeFilter === "With Notes") {
        return ["completed", "consultation_completed"].includes(res.status) && !!res.doctorNotes && res.doctorNotes.trim() !== "";
      }
      return true;
    })
    .sort((a, b) => {
      const timeA = getTerminalTimestamp(a) || 0;
      const timeB = getTerminalTimestamp(b) || 0;
      return sortOrder === "newest" ? timeB - timeA : timeA - timeB;
    });

  const getStatusDisplay = (status) => {
    if (["completed", "consultation_completed"].includes(status)) {
      return { label: "Completed", color: "bg-green-100 text-green-700 border-green-200" };
    }
    if (status === "cancelled") {
      return { label: "Cancelled", color: "bg-red-100 text-red-700 border-red-200" };
    }
    if (status === "expired") {
      return { label: "Expired", color: "bg-slate-100 text-slate-700 border-slate-200" };
    }
    if (status === "penalized") {
      return { label: "Penalized", color: "bg-amber-100 text-amber-700 border-amber-200" };
    }
    return { label: status.replace("_", " "), color: "bg-gray-100 text-gray-700 border-gray-200 uppercase" };
  };

  const getEmptyStateMessage = () => {
    switch (activeFilter) {
      case "Completed": return "No completed clinic reservations yet.";
      case "Cancelled": return "You have no cancelled clinic reservations.";
      case "Expired": return "You have no expired clinic reservations.";
      case "Penalized": return "You have no penalized clinic reservations.";
      case "With Notes": return "No completed consultations with doctor's notes yet.";
      default: return "You haven't logged any past clinic reservations yet.";
    }
  };

  return (
    <div className="space-y-6 pb-8 relative">
      <div className="flex items-center gap-3.5 mb-2">
        <button 
          onClick={() => navigate("/parent/profile")}
          className="w-10 h-10 bg-white border border-gray-200 rounded-full flex items-center justify-center text-gray-600 hover:bg-gray-50 transition-colors shadow-2xs focus:outline-none"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Reservation History</h1>
          <p className="text-gray-500 text-sm mt-0.5">View your past clinic visits, details, and doctor&apos;s consultation notes.</p>
        </div>
      </div>

      <div className="bg-white p-4 rounded-3xl border border-gray-100 shadow-xs sticky top-0 z-10 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0 scrollbar-hide w-full sm:w-auto -mx-4 px-4 sm:mx-0 sm:px-0">
          {["All", "Completed", "Cancelled", "Expired", "Penalized", "With Notes"].map(filter => (
            <button
              key={filter}
              onClick={() => setActiveFilter(filter)}
              className={`px-4 py-2 rounded-2xl text-xs sm:text-sm font-bold whitespace-nowrap transition-colors flex-shrink-0 focus:outline-none ${
                activeFilter === filter 
                  ? 'bg-blue-600 text-white shadow-2xs' 
                  : 'bg-gray-50 text-gray-600 border border-gray-200/80 hover:bg-gray-100/80'
              }`}
            >
              {filter}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative w-full sm:w-auto">
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              className="w-full sm:w-40 pl-10 pr-8 py-2 bg-gray-50 border border-gray-200/80 rounded-2xl text-xs sm:text-sm font-bold text-gray-700 appearance-none outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
            </select>
            <ArrowUpDown className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : filteredAndSortedReservations.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in slide-in-from-bottom-4">
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
                className="bg-white p-5 rounded-3xl border border-gray-100 shadow-xs hover:shadow-md hover:border-blue-200 transition-all cursor-pointer group flex flex-col justify-between"
              >
                <div>
                  <div className="flex justify-between items-start mb-3.5 gap-2">
                    <div>
                      <div className="font-extrabold text-gray-800 text-lg group-hover:text-blue-600 transition-colors">{res.childName || "N/A"}</div>
                      <div className="text-xs text-gray-400 uppercase tracking-widest font-bold mt-0.5">Code: {res.reservationCode || "N/A"}</div>
                    </div>
                    <div className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border shadow-2xs flex-shrink-0 ${color}`}>
                      {label}
                    </div>
                  </div>
                  
                  <div className="bg-gray-50/80 p-4 rounded-2xl border border-gray-100/80 space-y-2.5 mb-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500 flex items-center text-xs font-semibold">
                        <CalendarDays className="w-3.5 h-3.5 mr-1.5 text-blue-500 flex-shrink-0" />
                        Date
                      </span>
                      <span className="font-bold text-gray-800">
                        {schedule.clinicDate ? new Date(schedule.clinicDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "Unknown Date"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500 flex items-center text-xs font-semibold">
                        <MapPin className="w-3.5 h-3.5 mr-1.5 text-red-500 flex-shrink-0" />
                        Branch
                      </span>
                      <span className="font-bold text-gray-800">{schedule.branch || "Unknown Branch"}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm pt-1 border-t border-gray-100">
                      <span className="text-gray-500 text-xs font-semibold">Queue Number</span>
                      <span className="font-black text-blue-600">
                        {queueNum ? `Queue #${queueNum}` : "—"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex justify-between items-center pt-2.5 border-t border-gray-100/80 mt-auto gap-2">
                  <div className="text-[11px] text-gray-400 font-medium">
                    {label === "Cancelled" ? "Cancelled on" : label === "Completed" ? "Completed on" : label === "Expired" ? "Expired on" : "Logged on"} {timestamp ? new Date(timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "N/A"}
                  </div>
                  {hasNotes && (
                    <span className="bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center border border-blue-200/80 shadow-2xs flex-shrink-0">
                      <FileText className="w-3 h-3 mr-1 text-blue-600" />
                      With Notes
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-xs p-12 text-center max-w-lg mx-auto animate-in fade-in mt-4">
          <div className="w-16 h-16 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <History className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-gray-800 mb-1">
            {activeFilter === "All" ? "No Reservation History" : `No ${activeFilter} Reservations`}
          </h3>
          <p className="text-sm text-gray-500 max-w-sm mx-auto mt-1">{getEmptyStateMessage()}</p>
        </div>
      )}

      {/* Details Modal */}
      <ReservationDetailsModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        reservation={selectedReservation}
        schedule={selectedReservation ? schedules[selectedReservation.scheduleId] : null}
      />
    </div>
  );
}
