import React, { useState, useEffect } from "react";
import { Ticket, Clock, MapPin, CheckCircle2, History, XCircle, Search } from "lucide-react";
import { getSchedules } from "../../services/scheduleService";
import { subscribeToAllReservations, cancelReservation } from "../../services/reservationService";
import { useAuth } from "../../hooks/useAuth";
import ConfirmationModal from "../../components/common/ConfirmationModal";
import MessageModal from "../../components/common/MessageModal";
import ReservationDetailsModal from "../../components/parent/ReservationDetailsModal";

export default function MyReservations() {
  const { user } = useAuth();
  
  const [activeTab, setActiveTab] = useState("current"); // 'current' or 'history'
  const [schedules, setSchedules] = useState({});
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);

  // History State
  const [historyFilter, setHistoryFilter] = useState("All"); // 'All', 'Completed', 'Cancelled'
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedHistoryReservation, setSelectedHistoryReservation] = useState(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

  // Modals
  const [isCancelConfirmOpen, setIsCancelConfirmOpen] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [reservationToCancel, setReservationToCancel] = useState(null);

  const [messageModalState, setMessageModalState] = useState({
    isOpen: false, type: 'info', title: '', message: ''
  });

  useEffect(() => {
    const fetchSchedules = async () => {
      const data = await getSchedules();
      setSchedules(data || {});
    };
    fetchSchedules();

    const unsubReservations = subscribeToAllReservations((data) => {
      if (user) {
        const parentRes = data.filter(r => r.parentId === user.uid);
        setReservations(parentRes);
      }
      setLoading(false);
    });

    return () => unsubReservations();
  }, [user]);

  const formatTime = (time) => {
    if (!time) return '';
    const [hours, minutes] = time.split(':');
    const h = parseInt(hours, 10);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const formattedH = h % 12 || 12;
    return `${formattedH}:${minutes} ${ampm}`;
  };

  const handleCancelClick = (res) => {
    setReservationToCancel(res);
    setIsCancelConfirmOpen(true);
  };

  const handleOpenDetails = (res) => {
    setSelectedHistoryReservation(res);
    setIsDetailsModalOpen(true);
  };

  const handleCancelReservation = async () => {
    if (!reservationToCancel) return;
    setIsCancelling(true);
    try {
      await cancelReservation(reservationToCancel.id);
      setIsCancelConfirmOpen(false);
      setMessageModalState({
        isOpen: true, type: 'success', title: 'Reservation Cancelled', message: 'Your reservation has been cancelled successfully.'
      });
      setReservationToCancel(null);
    } catch (error) {
      console.error(error);
      setIsCancelConfirmOpen(false);
      setMessageModalState({
        isOpen: true, type: 'error', title: 'Cancellation Failed', message: 'There was an error cancelling your reservation.'
      });
    } finally {
      setIsCancelling(false);
    }
  };

  const currentReservation = reservations.find(r => r.status !== "cancelled" && r.status !== "completed");
  
  const historyReservations = reservations
    .filter(r => r.status === "cancelled" || r.status === "completed")
    .filter(r => {
      if (historyFilter === "Completed" && r.status !== "completed") return false;
      if (historyFilter === "Cancelled" && r.status !== "cancelled") return false;
      return true;
    })
    .filter(r => {
      if (!searchQuery) return true;
      const schedule = schedules[r.scheduleId];
      if (!schedule) return false;
      const branchMatch = schedule.branch.toLowerCase().includes(searchQuery.toLowerCase());
      const dateStr = new Date(schedule.clinicDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }).toLowerCase();
      const dateMatch = dateStr.includes(searchQuery.toLowerCase());
      return branchMatch || dateMatch;
    })
    .sort((a, b) => {
      const timeA = a.completedAt || a.cancelledAt || a.createdAt || 0;
      const timeB = b.completedAt || b.cancelledAt || b.createdAt || 0;
      return timeB - timeA;
    });

  return (
    <div className="space-y-6 pb-6 relative">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">My Reservations</h1>
        <p className="text-gray-500 mt-1">
          Manage your current reservation and view history.
        </p>
      </div>

      {/* Sticky Tabs */}
      <div className="sticky top-0 z-10 bg-gray-50/90 backdrop-blur-md pb-4 pt-2 -mx-4 px-4 sm:mx-0 sm:px-0 sm:bg-transparent sm:pt-0 border-b border-gray-200 sm:border-none">
        <div className="flex bg-gray-100 p-1 rounded-xl w-fit">
          <button
            onClick={() => setActiveTab("current")}
            className={`px-6 py-2 flex items-center rounded-lg text-sm font-semibold transition-all ${
              activeTab === "current" 
                ? "bg-white text-blue-600 shadow-sm" 
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <Ticket className="w-4 h-4 mr-2" />
            Current Reservation
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`px-6 py-2 flex items-center rounded-lg text-sm font-semibold transition-all ${
              activeTab === "history" 
                ? "bg-white text-blue-600 shadow-sm" 
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <History className="w-4 h-4 mr-2" />
            Reservation History
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <>
          {activeTab === "current" && (
            currentReservation ? (() => {
              const schedule = schedules[currentReservation.scheduleId];
              if (!schedule) return <div className="p-8 text-center text-gray-500">Loading schedule details...</div>;

              return (
                <div className="bg-white rounded-2xl border border-blue-100 shadow-md p-6 max-w-lg mx-auto animate-in fade-in slide-in-from-bottom-4">
                  <h2 className="text-sm font-bold text-blue-600 uppercase tracking-wider mb-5 flex items-center">
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Active Reservation
                  </h2>
                  
                  <div className="bg-gray-50 rounded-xl p-5 mb-6 border border-gray-100">
                    <div className="grid grid-cols-2 gap-y-4 text-sm">
                      <div className="text-gray-500 flex items-center"><MapPin className="w-4 h-4 mr-2 flex-shrink-0" />Branch</div>
                      <div className="font-bold text-gray-800 text-right">{schedule.branch}</div>
                      
                      <div className="text-gray-500 flex items-center"><Clock className="w-4 h-4 mr-2 flex-shrink-0" />Date</div>
                      <div className="font-bold text-gray-800 text-right">{new Date(schedule.clinicDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</div>
                      
                      <div className="text-gray-500 pl-6">Opening Time</div>
                      <div className="font-bold text-gray-800 text-right">{formatTime(schedule.openingTime)}</div>
                      
                      <div className="text-gray-500 pt-4 border-t border-gray-200 pl-6">Queue Position</div>
                      <div className="font-bold text-blue-600 text-right text-2xl pt-4 border-t border-gray-200">{currentReservation.queuePosition}</div>
                      
                      <div className="text-gray-500 pt-2 pl-6">Status</div>
                      <div className="font-bold text-gray-800 text-right pt-2 capitalize">{currentReservation.status}</div>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => handleCancelClick(currentReservation)}
                    className="w-full py-3 font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-xl transition-colors"
                  >
                    Cancel Reservation
                  </button>
                </div>
              );
            })() : (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center max-w-2xl mx-auto animate-in fade-in">
                <div className="mx-auto w-16 h-16 bg-gray-50 text-gray-400 rounded-full flex items-center justify-center mb-6">
                  <Ticket className="w-8 h-8" />
                </div>
                <h2 className="text-xl font-bold text-gray-800 mb-2">No Active Reservation</h2>
                <p className="text-gray-500 text-sm">You do not have a current slot reserved. Head over to the Reserve Queue tab to book an appointment.</p>
              </div>
            )
          )}

          {activeTab === "history" && (
            <>
              {/* History Toolbar */}
              <div className="space-y-4 mb-6 animate-in fade-in">
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="relative flex-1">
                    <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search reservation history..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0">
                  {["All", "Completed", "Cancelled"].map(filter => (
                    <button
                      key={filter}
                      onClick={() => setHistoryFilter(filter)}
                      className={`px-4 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap transition-colors ${
                        historyFilter === filter 
                          ? 'bg-blue-600 text-white shadow-sm' 
                          : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      {filter}
                    </button>
                  ))}
                </div>
              </div>

              {historyReservations.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 animate-in fade-in slide-in-from-bottom-4">
                  {historyReservations.map(res => {
                    const schedule = schedules[res.scheduleId] || {};
                    const isCancelled = res.status === "cancelled";
                    
                    return (
                      <div 
                        key={res.id} 
                        onClick={() => handleOpenDetails(res)}
                        className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm hover:shadow-md hover:border-blue-200 cursor-pointer transition-all"
                      >
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex items-center text-gray-800 font-bold">
                            <MapPin className="w-4 h-4 mr-1.5 text-gray-400" />
                            {schedule.branch || "Unknown"} Branch
                          </div>
                          <div className={`px-2.5 py-1 rounded-lg text-xs font-bold capitalize flex items-center ${
                            isCancelled ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'
                          }`}>
                            {isCancelled ? <XCircle className="w-3.5 h-3.5 mr-1" /> : <CheckCircle2 className="w-3.5 h-3.5 mr-1" />}
                            {res.status}
                          </div>
                        </div>
                        
                        <div className="space-y-2 text-sm text-gray-600">
                          <div className="flex justify-between">
                            <span>Date:</span>
                            <span className="font-medium text-gray-800">{schedule.clinicDate ? new Date(schedule.clinicDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "N/A"}</span>
                          </div>
                          {res.queuePosition && (
                            <div className="flex justify-between">
                              <span>Queue Position:</span>
                              <span className="font-medium text-gray-800">{res.queuePosition}</span>
                            </div>
                          )}
                          {(res.completedAt || res.cancelledAt) && (
                            <div className="flex justify-between text-xs text-gray-400 pt-2 border-t border-gray-100 mt-2">
                              <span>{isCancelled ? 'Cancelled On:' : 'Completed On:'}</span>
                              <span>{new Date(res.completedAt || res.cancelledAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center max-w-2xl mx-auto animate-in fade-in">
                  <div className="mx-auto w-16 h-16 bg-gray-50 text-gray-400 rounded-full flex items-center justify-center mb-6">
                    <History className="w-8 h-8" />
                  </div>
                  <h2 className="text-xl font-bold text-gray-800 mb-2">No History Found</h2>
                  <p className="text-gray-500 text-sm">
                    {searchQuery ? "No reservations match your search." : "You haven't completed or cancelled any reservations yet."}
                  </p>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* Details Modal */}
      <ReservationDetailsModal
        isOpen={isDetailsModalOpen}
        onClose={() => setIsDetailsModalOpen(false)}
        reservation={selectedHistoryReservation}
        schedule={selectedHistoryReservation ? schedules[selectedHistoryReservation.scheduleId] : null}
      />

      {/* Cancel Confirmation Modal */}
      <ConfirmationModal
        isOpen={isCancelConfirmOpen}
        title="Cancel Reservation?"
        message={`Your reserved slot will be released and become available to other parents.\n\nDo you want to continue?`}
        confirmText="Cancel Reservation"
        cancelText="Keep Reservation"
        onConfirm={handleCancelReservation}
        onCancel={() => setIsCancelConfirmOpen(false)}
        loading={isCancelling}
      />

      {/* Global Message Modal */}
      <MessageModal
        isOpen={messageModalState.isOpen}
        type={messageModalState.type}
        title={messageModalState.title}
        message={messageModalState.message}
        onClose={() => setMessageModalState(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}
