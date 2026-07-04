import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Ticket, Clock, MapPin, CheckCircle2, History, XCircle, Search, User } from "lucide-react";
import { subscribeToAllSchedules } from "../../services/scheduleService";
import { subscribeToAllReservations, cancelReservation, updatePatientInfo } from "../../services/reservationService";
import { useAuth } from "../../hooks/useAuth";
import ConfirmationModal from "../../components/common/ConfirmationModal";
import NotesDetailsModal from "../../components/parent/NotesDetailsModal";
import toast from "react-hot-toast";

export default function MyReservations() {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const location = useLocation();
  const [activeTab, setActiveTab] = useState("current"); // 'current' or 'notes'
  const [schedules, setSchedules] = useState({});
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);

  // Notes State
  const [notesFilter, setNotesFilter] = useState("All Notes"); // 'All Notes', 'This Month', 'Last 3 Months'
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedHistoryReservation, setSelectedHistoryReservation] = useState(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    if (searchParams.get("tab") === "notes") {
      setActiveTab("notes");
    }
  }, [location]);

  // Modals
  const [isCancelConfirmOpen, setIsCancelConfirmOpen] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [reservationToCancel, setReservationToCancel] = useState(null);

  // Patient Info Modal
  const [isPatientInfoModalOpen, setIsPatientInfoModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({ childName: "", age: "", sex: "", concern: "" });

  useEffect(() => {
    const unsubSchedules = subscribeToAllSchedules((data) => {
      setSchedules(data || {});
    });

    const unsubReservations = subscribeToAllReservations((data) => {
      if (user) {
        const parentRes = data.filter(r => r.parentId === user.uid);
        setReservations(parentRes);
      }
      setLoading(false);
    });

    return () => {
      unsubSchedules();
      unsubReservations();
    };
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
      toast.success('Your reservation has been cancelled successfully.');
      setReservationToCancel(null);
    } catch (error) {
      console.error(error);
      setIsCancelConfirmOpen(false);
      toast.error('There was an error cancelling your reservation.');
    } finally {
      setIsCancelling(false);
    }
  };

  const handleOpenPatientInfo = () => {
    const res = reservations.find(r => r.status !== "cancelled" && r.status !== "completed" && r.status !== "consultation_completed");
    if (!res) return;
    setFormData({
      childName: res.childName || "",
      age: res.age || "",
      sex: res.sex || "",
      concern: res.concern || ""
    });
    setIsPatientInfoModalOpen(true);
  };

  const handleSubmitPatientInfo = async () => {
    const currentRes = reservations.find(r => r.status !== "cancelled" && r.status !== "completed" && r.status !== "consultation_completed");
    if (!currentRes) return;
    setIsSubmitting(true);
    try {
      await updatePatientInfo(currentRes.id, {
        childName: formData.childName.trim(),
        age: formData.age.trim(),
        sex: formData.sex,
        concern: formData.concern.trim()
      });
      setIsPatientInfoModalOpen(false);
      toast.success("Patient information updated successfully.");
    } catch (err) {
      toast.error("Failed to update patient information.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentReservation = reservations.find(r => r.status !== "cancelled" && r.status !== "completed" && r.status !== "consultation_completed");
  
  const notesReservations = reservations
    .filter(r => r.status === "consultation_completed")
    .filter(r => r.doctorNotes && r.doctorNotes.trim() !== "")
    .filter(r => {
      if (notesFilter === "All Notes") return true;
      const completedAt = r.consultationCompletedAt || 0;
      const oneMonth = 30 * 24 * 60 * 60 * 1000;
      if (notesFilter === "This Month") return Date.now() - completedAt < oneMonth;
      if (notesFilter === "Last 3 Months") return Date.now() - completedAt < 3 * oneMonth;
      return true;
    })
    .filter(r => {
      if (!searchQuery) return true;
      const schedule = schedules[r.scheduleId];
      if (!schedule) return false;
      const childMatch = (r.childName || "").toLowerCase().includes(searchQuery.toLowerCase());
      const branchMatch = schedule.branch.toLowerCase().includes(searchQuery.toLowerCase());
      const dateStr = new Date(schedule.clinicDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }).toLowerCase();
      const dateMatch = dateStr.includes(searchQuery.toLowerCase());
      return childMatch || branchMatch || dateMatch;
    })
    .sort((a, b) => {
      const timeA = a.consultationCompletedAt || 0;
      const timeB = b.consultationCompletedAt || 0;
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
            onClick={() => { setActiveTab("notes"); navigate("/parent/reservations?tab=notes"); }}
            className={`px-6 py-2 flex items-center rounded-lg text-sm font-semibold transition-all ${
              activeTab === "notes" 
                ? "bg-white text-blue-600 shadow-sm" 
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <History className="w-4 h-4 mr-2" />
            Consultations With Notes
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

              const isIncomplete = !currentReservation.childName || !currentReservation.age || !currentReservation.sex;

              return (
                <div className="bg-white rounded-2xl border border-blue-100 shadow-md p-6 max-w-lg mx-auto animate-in fade-in slide-in-from-bottom-4 relative">
                  {isIncomplete && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-amber-100 text-amber-700 text-xs font-bold px-4 py-1.5 rounded-full border border-amber-200 shadow-sm whitespace-nowrap z-10 flex items-center">
                      <XCircle className="w-3.5 h-3.5 mr-1.5" /> Patient Information Required
                    </div>
                  )}

                  <h2 className="text-sm font-bold text-blue-600 uppercase tracking-wider mb-5 flex items-center mt-2">
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Active Reservation
                  </h2>
                  
                  <div className="bg-gray-50 rounded-xl p-5 mb-6 border border-gray-100">
                    <div className="grid grid-cols-2 gap-y-4 text-sm">
                      <div className="text-gray-500 flex items-center"><User className="w-4 h-4 mr-2 flex-shrink-0" />Patient</div>
                      <div className="font-bold text-gray-800 text-right">{currentReservation.childName || "N/A"}</div>
                      
                      <div className="text-gray-500 flex items-center"><MapPin className="w-4 h-4 mr-2 flex-shrink-0" />Branch</div>
                      <div className="font-bold text-gray-800 text-right">{schedule.branch}</div>
                      
                      <div className="text-gray-500 flex items-center"><Clock className="w-4 h-4 mr-2 flex-shrink-0" />Date</div>
                      <div className="font-bold text-gray-800 text-right">{new Date(schedule.clinicDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</div>
                      
                      <div className="text-gray-500 pl-6">Opening Time</div>
                      <div className="font-bold text-gray-800 text-right">{formatTime(schedule.openingTime)}</div>
                      
                      {currentReservation.status === "in_consultation" ? (
                        <>
                          <div className="text-gray-500 pt-4 border-t border-gray-200 pl-6">Status</div>
                          <div className="font-bold text-blue-600 text-right text-lg pt-4 border-t border-gray-200 uppercase">In Consultation</div>
                        </>
                      ) : schedule.status === 'completed' || schedule.queueStatus === 'completed' ? (
                        <div className="col-span-2 pt-4 border-t border-gray-200 text-center">
                          <h3 className="font-bold text-gray-800 mb-1">Clinic Session Completed</h3>
                          <p className="text-xs text-gray-500">
                            Today's clinic session has ended.
                          </p>
                        </div>
                      ) : schedule.queueStatus === 'not_started' ? (
                        <div className="col-span-2 pt-4 border-t border-gray-200 text-center">
                          <h3 className="font-bold text-gray-800 mb-1">Queue Not Started</h3>
                          <p className="text-xs text-gray-500">
                            The clinic queue hasn't started yet. You have successfully reserved your slot. Real-time queue updates will appear once the doctor starts today's clinic.
                          </p>
                        </div>
                      ) : (
                        <>
                          <div className="text-gray-500 pt-4 border-t border-gray-200 pl-6">Queue Position</div>
                          <div className="font-bold text-blue-600 text-right text-2xl pt-4 border-t border-gray-200">{currentReservation.queuePosition || "Assigned"}</div>
                          
                          <div className="text-gray-500 pt-2 pl-6">Patients Ahead</div>
                          <div className="font-bold text-orange-500 text-right text-2xl pt-2">{currentReservation.queuePosition ? Math.max(0, currentReservation.queuePosition - 1) : 0}</div>
                          
                          <div className="text-gray-500 pt-2 pl-6">Status</div>
                          <div className={`font-bold text-right pt-2 capitalize ${currentReservation.status === 'checked_in' ? 'text-green-600' : 'text-gray-800'}`}>
                            {currentReservation.status === 'checked_in' ? 'Ready For Consultation' : currentReservation.status.replace("_", " ")}
                          </div>
                          {currentReservation.status === 'checked_in' && (
                            <div className="col-span-2 text-xs text-green-600 font-medium text-right mt-1">Waiting for Doctor Consultation</div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex flex-col gap-3">
                    {isIncomplete ? (
                      <button
                        onClick={handleOpenPatientInfo}
                        className="w-full py-3 font-bold text-white bg-amber-500 hover:bg-amber-600 rounded-xl transition-colors flex items-center justify-center shadow-sm"
                      >
                        Complete Information
                      </button>
                    ) : (
                      <button
                        onClick={() => navigate(`/parent/reservations/${currentReservation.id}/qr`)}
                        className="w-full py-3 font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-xl transition-colors flex items-center justify-center"
                      >
                        <Ticket className="w-5 h-5 mr-2" />
                        View QR Code
                      </button>
                    )}
                    {currentReservation.status !== "checked_in" && currentReservation.status !== "in_consultation" && (
                      <button
                        onClick={() => handleCancelClick(currentReservation)}
                        className="w-full py-3 font-bold rounded-xl transition-colors flex items-center justify-center text-red-600 bg-red-50 hover:bg-red-100"
                      >
                        Cancel Reservation
                      </button>
                    )}
                  </div>
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

          {activeTab === "notes" && (
            <>
              {/* Notes Toolbar */}
              <div className="space-y-4 mb-6 animate-in fade-in">
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="relative flex-1">
                    <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search notes or branch..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
                  <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0 scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0">
                    {["All Notes", "This Month", "Last 3 Months"].map(filter => (
                      <button
                        key={filter}
                        onClick={() => setNotesFilter(filter)}
                        className={`px-4 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap transition-colors ${
                          notesFilter === filter 
                            ? 'bg-blue-600 text-white shadow-sm' 
                            : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        {filter}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {notesReservations.length > 0 ? (
                <div className="grid grid-cols-1 gap-5 animate-in fade-in slide-in-from-bottom-4">
                  {notesReservations.map(res => {
                    const schedule = schedules[res.scheduleId] || {};
                    
                    return (
                      <div 
                        key={res.id} 
                        onClick={() => handleOpenDetails(res)}
                        className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-all flex flex-col cursor-pointer"
                      >
                        <div className="flex justify-between items-start mb-4 border-b border-gray-100 pb-4">
                          <div>
                            <div className="text-gray-500 text-xs uppercase font-bold tracking-wider mb-1">Child Name</div>
                            <div className="text-lg font-bold text-gray-800">{res.childName || "N/A"}</div>
                          </div>
                          <div className="text-right">
                            <div className={`px-2.5 py-1 rounded-lg text-xs font-bold capitalize flex items-center bg-blue-50 text-blue-600`}>
                              <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                              Completed
                            </div>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4 text-sm text-gray-600 mb-5">
                          <div>
                            <div className="text-xs text-gray-400 mb-0.5">Consultation Date</div>
                            <div className="font-medium text-gray-800">{schedule.clinicDate ? new Date(schedule.clinicDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "N/A"}</div>
                          </div>
                          <div>
                            <div className="text-xs text-gray-400 mb-0.5">Branch</div>
                            <div className="font-medium text-gray-800">{schedule.branch || "Unknown"}</div>
                          </div>
                        </div>

                        <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 mt-auto flex items-center justify-between">
                          <div className="text-xs font-bold text-blue-600 uppercase tracking-wider flex items-center">
                            <History className="w-3.5 h-3.5 mr-1.5" />
                            Doctor's Notes
                          </div>
                          <div className="text-gray-500 text-xs italic">
                            Tap to view doctor's notes
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center max-w-2xl mx-auto animate-in fade-in">
                  <div className="mx-auto w-16 h-16 bg-blue-50 text-blue-400 rounded-full flex items-center justify-center mb-6">
                    <History className="w-8 h-8" />
                  </div>
                  <h2 className="text-xl font-bold text-gray-800 mb-2">No Consultation Notes</h2>
                  <p className="text-gray-500 text-sm">
                    {searchQuery ? "No notes match your search." : "You haven't completed any consultations yet."}
                  </p>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* Details Modal */}
      <NotesDetailsModal
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

      {/* Complete Patient Info Modal */}
      {isPatientInfoModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-5 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-800">Complete Information</h2>
              <button onClick={() => setIsPatientInfoModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-lg hover:bg-gray-50">
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Child Full Name *</label>
                  <input 
                    type="text" 
                    value={formData.childName}
                    onChange={e => setFormData(prev => ({ ...prev, childName: e.target.value }))}
                    placeholder="Enter child's full name"
                    className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Age *</label>
                    <input 
                      type="text" 
                      value={formData.age}
                      onChange={e => setFormData(prev => ({ ...prev, age: e.target.value }))}
                      placeholder="e.g. 5 yrs"
                      className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Sex *</label>
                    <select
                      value={formData.sex}
                      onChange={e => setFormData(prev => ({ ...prev, sex: e.target.value }))}
                      className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all cursor-pointer"
                    >
                      <option value="">Select</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Concern / Reason for Visit</label>
                  <textarea 
                    value={formData.concern}
                    onChange={e => setFormData(prev => ({ ...prev, concern: e.target.value }))}
                    placeholder="Optional: briefly describe the symptoms or reason for visit"
                    rows={3}
                    className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all resize-none"
                  ></textarea>
                </div>
              </div>
            </div>

            <div className="p-5 border-t border-gray-100 bg-gray-50 flex gap-3 justify-end">
              <button 
                onClick={() => setIsPatientInfoModalOpen(false)}
                disabled={isSubmitting}
                className="px-5 py-2.5 text-gray-600 font-semibold bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button 
                onClick={handleSubmitPatientInfo}
                disabled={isSubmitting || !formData.childName.trim() || !formData.age.trim() || !formData.sex}
                className="px-5 py-2.5 text-white font-bold bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors flex items-center disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Saving...
                  </>
                ) : "Save Information"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
