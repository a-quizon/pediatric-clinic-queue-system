import React, { useState, useEffect } from "react";
import { Activity, PlayCircle, CheckCircle, User, MapPin, X, FileText, AlertCircle } from "lucide-react";
import { subscribeToAllReservations, startConsultation, completeConsultation } from "../../services/reservationService";
import { getSchedules } from "../../services/scheduleService";
import toast from "react-hot-toast";

export default function Consultations() {
  const [reservations, setReservations] = useState([]);
  const [schedules, setSchedules] = useState({});
  const [loading, setLoading] = useState(true);
  
  const [isCompleteModalOpen, setIsCompleteModalOpen] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [doctorNotes, setDoctorNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const fetchSchedules = async () => {
      const data = await getSchedules();
      setSchedules(data || {});
    };
    fetchSchedules();

    const unsub = subscribeToAllReservations((data) => {
      setReservations(data);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const activeConsultation = reservations.find(r => r.status === "in_consultation");
  const waitingPatients = reservations
    .filter(r => r.status === "checked_in")
    .sort((a, b) => (a.queuePosition || 999) - (b.queuePosition || 999));

  const handleStart = async (res) => {
    if (activeConsultation) {
      toast.error("You already have an active consultation. Please complete it first.");
      return;
    }
    try {
      await startConsultation(res.id);
      toast.success("Consultation started.");
    } catch (err) {
      console.error(err);
      toast.error("Failed to start consultation.");
    }
  };

  const handleOpenCompleteModal = (res) => {
    setSelectedPatient(res);
    setDoctorNotes("");
    setIsCompleteModalOpen(true);
  };

  const handleComplete = async () => {
    if (!selectedPatient) return;
    setIsSubmitting(true);
    try {
      await completeConsultation(selectedPatient.id, doctorNotes.trim());
      toast.success("Consultation completed successfully.");
      setIsCompleteModalOpen(false);
      setSelectedPatient(null);
    } catch (err) {
      console.error(err);
      toast.error("Failed to complete consultation.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-6 relative">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Consultations</h1>
        <p className="text-gray-500 mt-1">
          Review patient concerns and conduct medical sessions.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Active Consultation */}
        <div className="lg:col-span-1 space-y-6">
          <h2 className="text-lg font-bold text-gray-800 flex items-center">
            <Activity className="w-5 h-5 mr-2 text-blue-600" />
            Active Session
          </h2>
          
          {activeConsultation ? (() => {
            const schedule = schedules[activeConsultation.scheduleId] || {};
            return (
              <div className="bg-white rounded-2xl border-2 border-blue-200 shadow-md p-6 animate-in zoom-in-95 duration-200">
                <div className="flex justify-between items-start mb-6 border-b border-gray-100 pb-4">
                  <div>
                    <div className="text-xs text-blue-600 font-bold uppercase tracking-wider mb-1">In Consultation</div>
                    <div className="text-xl font-bold text-gray-800">{activeConsultation.childName || activeConsultation.parentEmail}</div>
                    {activeConsultation.age && activeConsultation.sex && (
                      <div className="text-sm text-gray-500 mt-1">{activeConsultation.age} • {activeConsultation.sex}</div>
                    )}
                  </div>
                  <div className="bg-blue-50 w-12 h-12 rounded-xl flex items-center justify-center border border-blue-100">
                    <User className="w-6 h-6 text-blue-600" />
                  </div>
                </div>

                {activeConsultation.concern && (
                  <div className="bg-amber-50/50 p-4 rounded-xl border border-amber-100 mb-6">
                    <div className="text-xs font-bold text-amber-700 uppercase tracking-wider mb-2 flex items-center">
                      <AlertCircle className="w-3.5 h-3.5 mr-1.5" />
                      Reason for Visit
                    </div>
                    <div className="text-gray-700 text-sm whitespace-pre-wrap">{activeConsultation.concern}</div>
                  </div>
                )}

                <div className="space-y-3 mb-8 text-sm text-gray-600">
                  <div className="flex items-center">
                    <MapPin className="w-4 h-4 mr-2 text-gray-400" />
                    <span>Branch: <b>{schedule.branch || "Unknown"}</b></span>
                  </div>
                  <div className="flex items-center">
                    <Activity className="w-4 h-4 mr-2 text-gray-400" />
                    <span>Started: <b>{activeConsultation.consultationStartedAt ? new Date(activeConsultation.consultationStartedAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : "N/A"}</b></span>
                  </div>
                </div>

                <button 
                  onClick={() => handleOpenCompleteModal(activeConsultation)}
                  className="w-full py-3.5 px-4 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 transition-colors flex items-center justify-center gap-2 shadow-sm"
                >
                  <CheckCircle className="w-5 h-5" />
                  <span>Complete Consultation</span>
                </button>
              </div>
            );
          })() : (
            <div className="bg-white rounded-2xl border border-gray-200 border-dashed shadow-sm p-8 text-center text-gray-500">
              <div className="mx-auto w-12 h-12 bg-gray-50 text-gray-400 rounded-full flex items-center justify-center mb-4">
                <PlayCircle className="w-6 h-6" />
              </div>
              <p className="font-medium">No active consultation.</p>
              <p className="text-xs mt-1">Select a patient from the waiting queue to begin.</p>
            </div>
          )}
        </div>

        {/* Right Column: Waiting Queue */}
        <div className="lg:col-span-2 space-y-6">
          <h2 className="text-lg font-bold text-gray-800 flex items-center">
            <User className="w-5 h-5 mr-2 text-gray-500" />
            Waiting Queue <span className="ml-2 bg-gray-100 text-gray-600 px-2.5 py-0.5 rounded-full text-xs">{waitingPatients.length}</span>
          </h2>

          {waitingPatients.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {waitingPatients.map(res => {
                const schedule = schedules[res.scheduleId] || {};
                return (
                  <div key={res.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 hover:shadow-md transition-shadow flex flex-col">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3">
                        <div className="bg-gray-50 w-10 h-10 rounded-lg flex flex-col items-center justify-center flex-shrink-0 border border-gray-100">
                          <span className="text-[9px] text-gray-500 font-bold uppercase leading-none mb-1">Queue</span>
                          <span className="text-sm font-black text-gray-800 leading-none">{res.queuePosition}</span>
                        </div>
                        <div>
                          <div className="font-bold text-gray-800">{res.childName || res.parentEmail}</div>
                          {res.age && res.sex && <div className="text-xs text-gray-500">{res.age} • {res.sex}</div>}
                        </div>
                      </div>
                    </div>
                    
                    {res.concern && (
                      <div className="text-sm text-gray-600 mb-4 bg-gray-50 p-2.5 rounded-lg line-clamp-2 italic">
                        "{res.concern}"
                      </div>
                    )}
                    
                    <div className="mt-auto pt-4 border-t border-gray-50 flex gap-2">
                      <button 
                        onClick={() => handleStart(res)}
                        disabled={!!activeConsultation}
                        className="flex-1 py-2 bg-blue-50 text-blue-600 text-sm font-bold rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                      >
                        <PlayCircle className="w-4 h-4 mr-1.5" /> Start
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center text-gray-500">
               <div className="mx-auto w-16 h-16 bg-gray-50 text-gray-400 rounded-full flex items-center justify-center mb-4">
                <CheckCircle className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-gray-800 mb-1">Queue Empty</h3>
              <p className="text-sm">There are no checked-in patients waiting for consultation.</p>
            </div>
          )}
        </div>
      </div>

      {/* Complete Consultation Modal */}
      {isCompleteModalOpen && selectedPatient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-5 border-b border-gray-100 bg-gray-50">
              <h2 className="text-lg font-bold text-gray-800 flex items-center">
                <CheckCircle className="w-5 h-5 mr-2 text-green-600" />
                Complete Consultation
              </h2>
              <button onClick={() => setIsCompleteModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-lg hover:bg-gray-200">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6">
              <div className="mb-4">
                <div className="text-sm text-gray-500 mb-1">Patient</div>
                <div className="font-bold text-gray-800">{selectedPatient.childName || selectedPatient.parentEmail}</div>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-bold text-gray-700 flex items-center">
                  <FileText className="w-4 h-4 mr-1.5 text-gray-400" />
                  Consultation Notes / Reminder to Parent
                </label>
                <textarea 
                  value={doctorNotes}
                  onChange={(e) => setDoctorNotes(e.target.value)}
                  placeholder="Example:
- Continue prescribed medication
- Return after 2 weeks
- Monitor fever symptoms
- Follow-up consultation required"
                  rows={5}
                  className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all resize-none text-sm placeholder:text-gray-300"
                ></textarea>
                <p className="text-xs text-gray-400 mt-1">These notes will be visible to the parent. Notes are optional.</p>
              </div>
            </div>

            <div className="p-5 border-t border-gray-100 bg-gray-50 flex gap-3 justify-end">
              <button 
                onClick={() => setIsCompleteModalOpen(false)}
                disabled={isSubmitting}
                className="px-5 py-2.5 text-gray-600 font-semibold bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button 
                onClick={handleComplete}
                disabled={isSubmitting}
                className="px-5 py-2.5 text-white font-bold bg-green-600 rounded-xl hover:bg-green-700 transition-colors flex items-center disabled:opacity-70"
              >
                {isSubmitting ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                ) : (
                  <CheckCircle className="w-4 h-4 mr-2" />
                )}
                Complete Consultation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
