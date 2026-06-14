import React, { useState, useEffect } from "react";
import { Users, UserCheck, Clock, CheckCircle, Activity, Hash, MapPin, Calendar, CheckCircle2, PlayCircle } from "lucide-react";
import { subscribeToAllReservations, startConsultation } from "../../services/reservationService";
import { subscribeToPublishedSchedules } from "../../services/scheduleService";
import toast from "react-hot-toast";

export default function ManageQueue() {
  const [reservations, setReservations] = useState([]);
  const [schedules, setSchedules] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubSchedules = subscribeToPublishedSchedules((data) => {
      const schedulesMap = {};
      data.forEach(s => schedulesMap[s.id] = s);
      setSchedules(schedulesMap);
    });

    const unsubReservations = subscribeToAllReservations((data) => {
      setReservations(data);
      setLoading(false);
    });

    return () => {
      unsubSchedules();
      unsubReservations();
    };
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Derived states
  const waitingPatients = reservations.filter(r => r.status === "reserved").sort((a, b) => a.queuePosition - b.queuePosition);
  const checkedInPatients = reservations.filter(r => r.status === "checked_in").sort((a, b) => a.queuePosition - b.queuePosition);
  const inConsultationPatients = reservations.filter(r => r.status === "in_consultation");
  const completedPatients = reservations.filter(r => r.status === "consultation_completed").sort((a, b) => b.consultationCompletedAt - a.consultationCompletedAt);

  const formatTime = (timestamp) => {
    if (!timestamp) return "N/A";
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const handleCallNext = async () => {
    if (inConsultationPatients.length > 0) {
      toast.error("There is already a patient in consultation.");
      return;
    }
    if (checkedInPatients.length === 0) {
      toast.error("No patients are checked in.");
      return;
    }
    try {
      await startConsultation(checkedInPatients[0].id);
      toast.success(`Started consultation for ${checkedInPatients[0].childName}`);
    } catch (error) {
      toast.error("Failed to start consultation.");
      console.error(error);
    }
  };

  return (
    <div className="space-y-6 pb-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Manage Queue</h1>
          <p className="text-gray-500 text-sm mt-1">Monitor all queue stages in real time.</p>
        </div>
        <button
          onClick={handleCallNext}
          disabled={inConsultationPatients.length > 0 || checkedInPatients.length === 0}
          className="px-6 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
        >
          <PlayCircle className="w-5 h-5 mr-2" />
          Call Next Patient
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* In Consultation */}
        <div className="lg:col-span-1 space-y-4">
          <div className="flex items-center justify-between border-b border-gray-200 pb-2">
            <h2 className="text-lg font-bold text-gray-800 flex items-center">
              <Activity className="w-5 h-5 mr-2 text-blue-500" />
              In Consultation
            </h2>
            <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2 py-0.5 rounded-full">{inConsultationPatients.length}</span>
          </div>

          <div className="space-y-3">
            {inConsultationPatients.length > 0 ? inConsultationPatients.map(res => (
              <div key={res.id} className="bg-blue-50 p-4 rounded-xl border-2 border-blue-200 shadow-sm relative overflow-hidden">
                <div className="flex items-start justify-between mb-2">
                  <div className="font-bold text-blue-900 text-sm">{res.childName}</div>
                  <div className="text-xs font-black text-blue-500 bg-blue-100 px-1.5 py-0.5 rounded">#{res.queuePosition || "?"}</div>
                </div>
                <div className="mb-3">
                  <span className="text-[10px] uppercase font-bold tracking-wider bg-blue-200 text-blue-800 px-2 py-0.5 rounded-md">Currently With Doctor</span>
                </div>
                <div className="text-xs text-blue-700 flex flex-col gap-1">
                  <div className="flex items-center"><PlayCircle className="w-3.5 h-3.5 mr-1" /> Started at {formatTime(res.consultationStartedAt)}</div>
                </div>
              </div>
            )) : (
              <div className="bg-white p-6 rounded-xl border border-gray-200 border-dashed text-center">
                <p className="text-xs text-gray-500 font-medium">Doctor is available</p>
              </div>
            )}
          </div>
        </div>

        {/* Checked In */}
        <div className="lg:col-span-1 space-y-4">
          <div className="flex items-center justify-between border-b border-gray-200 pb-2">
            <h2 className="text-lg font-bold text-gray-800 flex items-center">
              <UserCheck className="w-5 h-5 mr-2 text-green-500" />
              Checked In
            </h2>
            <span className="bg-green-100 text-green-800 text-xs font-bold px-2 py-0.5 rounded-full">{checkedInPatients.length}</span>
          </div>

          <div className="space-y-3">
            {checkedInPatients.length > 0 ? checkedInPatients.map(res => (
              <div key={res.id} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-green-400"></div>
                <div className="flex items-start justify-between mb-2">
                  <div className="font-bold text-gray-800 text-sm">{res.childName}</div>
                  <div className="text-xs font-black text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">#{res.queuePosition}</div>
                </div>
                <div className="text-xs text-gray-500 flex flex-col gap-1 mt-3">
                  <div className="flex items-center"><Clock className="w-3.5 h-3.5 mr-1 text-green-600" /> Checked in at {formatTime(res.checkedInAt)}</div>
                </div>
              </div>
            )) : (
              <div className="bg-white p-6 rounded-xl border border-gray-200 border-dashed text-center">
                <p className="text-xs text-gray-500 font-medium">No checked-in patients</p>
              </div>
            )}
          </div>
        </div>

        {/* Waiting */}
        <div className="lg:col-span-1 space-y-4">
          <div className="flex items-center justify-between border-b border-gray-200 pb-2">
            <h2 className="text-lg font-bold text-gray-800 flex items-center">
              <Clock className="w-5 h-5 mr-2 text-amber-500" />
              Waiting
            </h2>
            <span className="bg-amber-100 text-amber-800 text-xs font-bold px-2 py-0.5 rounded-full">{waitingPatients.length}</span>
          </div>

          <div className="space-y-3">
            {waitingPatients.length > 0 ? waitingPatients.map(res => {
              const schedule = schedules[res.scheduleId] || {};
              const isIncomplete = !res.childName || !res.age || !res.sex;
              return (
                <div key={res.id} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1 h-full bg-amber-400"></div>
                  <div className="flex items-start justify-between mb-2">
                    <div className="font-bold text-gray-800 text-sm">{isIncomplete ? <span className="text-amber-600 italic">Incomplete Info</span> : res.childName}</div>
                    <div className="text-xs font-black text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">#{res.queuePosition || "?"}</div>
                  </div>
                  <div className="text-xs text-gray-500 flex flex-col gap-1 mt-3">
                    <div className="flex items-center"><Hash className="w-3.5 h-3.5 mr-1" /> Code: <b>{res.reservationCode}</b></div>
                    <div className="flex items-center"><MapPin className="w-3.5 h-3.5 mr-1" /> {schedule.branch || "Unknown"}</div>
                  </div>
                </div>
              );
            }) : (
              <div className="bg-white p-6 rounded-xl border border-gray-200 border-dashed text-center">
                <p className="text-xs text-gray-500 font-medium">No waiting patients</p>
              </div>
            )}
          </div>
        </div>

        {/* Completed */}
        <div className="lg:col-span-1 space-y-4">
          <div className="flex items-center justify-between border-b border-gray-200 pb-2">
            <h2 className="text-lg font-bold text-gray-800 flex items-center">
              <CheckCircle className="w-5 h-5 mr-2 text-purple-500" />
              Completed
            </h2>
            <span className="bg-purple-100 text-purple-800 text-xs font-bold px-2 py-0.5 rounded-full">{completedPatients.length}</span>
          </div>

          <div className="space-y-3">
            {completedPatients.length > 0 ? completedPatients.map(res => {
              const schedule = schedules[res.scheduleId] || {};
              return (
                <div key={res.id} className="bg-gray-50 p-4 rounded-xl border border-gray-200 shadow-sm">
                  <div className="font-bold text-gray-600 text-sm mb-2">{res.childName}</div>
                  <div className="text-xs text-gray-500 flex flex-col gap-1">
                    <div className="flex items-center"><Calendar className="w-3.5 h-3.5 mr-1" /> {formatDate(schedule.clinicDate)}</div>
                    <div className="flex items-center"><CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Finished at {formatTime(res.consultationCompletedAt)}</div>
                  </div>
                </div>
              );
            }) : (
              <div className="bg-white p-6 rounded-xl border border-gray-200 border-dashed text-center">
                <p className="text-xs text-gray-500 font-medium">No completed consultations</p>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
