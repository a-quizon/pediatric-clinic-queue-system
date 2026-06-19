import React, { useState, useEffect } from "react";
import { useAuth } from "../../hooks/useAuth";
import { subscribeToAllReservations } from "../../services/reservationService";
import { getSchedules } from "../../services/scheduleService";
import { History, CalendarDays, MapPin, Search, Filter, ArrowLeft, ArrowUpDown } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function ReservationHistory() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [reservations, setReservations] = useState([]);
  const [schedules, setSchedules] = useState({});
  const [loading, setLoading] = useState(true);
  
  // Filters and Sorting
  const [activeFilter, setActiveFilter] = useState("All");
  const [sortOrder, setSortOrder] = useState("newest"); // 'newest' or 'oldest'

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
          ["cancelled", "completed", "consultation_completed", "expired"].includes(r.status)
        );
        setReservations(history);
        setLoading(false);
      });
    }
    return () => unsub();
  }, [user]);

  const getTerminalTimestamp = (res) => {
    return res.consultationCompletedAt || res.cancelledAt || res.completedAt || res.createdAt;
  };

  const filteredAndSortedReservations = reservations
    .filter(res => {
      if (activeFilter === "All") return true;
      if (activeFilter === "Completed") return ["completed", "consultation_completed"].includes(res.status);
      if (activeFilter === "Cancelled") return res.status === "cancelled";
      if (activeFilter === "Expired") return res.status === "expired";
      return true;
    })
    .sort((a, b) => {
      const timeA = getTerminalTimestamp(a);
      const timeB = getTerminalTimestamp(b);
      return sortOrder === "newest" ? timeB - timeA : timeA - timeB;
    });

  const getStatusDisplay = (status) => {
    if (["completed", "consultation_completed"].includes(status)) {
      return { label: "Completed", color: "bg-green-50 text-green-700 border-green-200" };
    }
    if (status === "cancelled") {
      return { label: "Cancelled", color: "bg-red-50 text-red-700 border-red-200" };
    }
    if (status === "expired") {
      return { label: "Expired", color: "bg-gray-100 text-gray-700 border-gray-300" };
    }
    return { label: status, color: "bg-gray-50 text-gray-600 border-gray-200" };
  };

  return (
    <div className="space-y-6 pb-6 relative">
      <div className="flex items-center gap-3 mb-2">
        <button 
          onClick={() => navigate("/parent/profile")}
          className="w-10 h-10 bg-white border border-gray-200 rounded-full flex items-center justify-center text-gray-600 hover:bg-gray-50 transition-colors shadow-sm"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Reservation History</h1>
          <p className="text-gray-500 text-sm mt-0.5">View your past clinic visits and cancelled slots.</p>
        </div>
      </div>

      <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm sticky top-0 z-10 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0 scrollbar-hide w-full sm:w-auto -mx-4 px-4 sm:mx-0 sm:px-0">
          {["All", "Completed", "Cancelled", "Expired"].map(filter => (
            <button
              key={filter}
              onClick={() => setActiveFilter(filter)}
              className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-colors flex-shrink-0 ${
                activeFilter === filter 
                  ? 'bg-blue-600 text-white shadow-sm' 
                  : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100'
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
              className="w-full sm:w-40 pl-10 pr-8 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 appearance-none outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
            </select>
            <ArrowUpDown className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
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
            
            return (
              <div key={res.id} className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <div className="font-bold text-gray-800 text-lg">{res.childName || "N/A"}</div>
                    <div className="text-xs text-gray-400 uppercase tracking-widest font-bold mt-1">Code: {res.reservationCode}</div>
                  </div>
                  <div className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${color}`}>
                    {label}
                  </div>
                </div>
                
                <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 space-y-2 mb-4">
                  <div className="flex items-center text-sm text-gray-600">
                    <CalendarDays className="w-4 h-4 mr-2 text-gray-400" />
                    <span className="font-medium">{schedule.clinicDate ? new Date(schedule.clinicDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "Unknown Date"}</span>
                  </div>
                  <div className="flex items-center text-sm text-gray-600">
                    <MapPin className="w-4 h-4 mr-2 text-gray-400" />
                    <span className="font-medium">{schedule.branch || "Unknown Branch"}</span>
                  </div>
                </div>

                <div className="text-xs text-gray-500 border-t border-gray-100 pt-3 flex justify-between items-center">
                  <span>{label === "Cancelled" ? "Cancelled on" : label === "Completed" ? "Completed on" : "Logged on"}</span>
                  <span className="font-medium">{timestamp ? new Date(timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "N/A"}</span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 border-dashed shadow-sm p-12 text-center text-gray-500 max-w-2xl mx-auto">
          <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <History className="w-8 h-8 text-gray-300" />
          </div>
          <h3 className="text-lg font-bold text-gray-800 mb-1">No History Found</h3>
          <p className="text-sm">We couldn't find any reservations matching your current filters.</p>
        </div>
      )}
    </div>
  );
}
