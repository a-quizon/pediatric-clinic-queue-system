import React, { useState, useEffect } from 'react';
import { Calendar, Users, Activity, MapPin, Clock, Stethoscope, CheckCircle2, UserCheck, AlertCircle } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { getBranchConfigurations } from "../../services/branchConfigurationService";
import { subscribeToScheduleReservations } from "../../services/reservationService";
import { subscribeToPublishedSchedules } from "../../services/scheduleService";
import ManageQueue from "./ManageQueue";

export default function Dashboard() {
  const { user } = useAuth();
  const [clinicAddress, setClinicAddress] = useState("");
  const [schedules, setSchedules] = useState({});
  const [schedulesLoaded, setSchedulesLoaded] = useState(false);
  const [reservations, setReservations] = useState([]);
  const [reservationsLoaded, setReservationsLoaded] = useState(false);

  useEffect(() => {
    const fetchAddress = async () => {
      if (user?.assignedBranch) {
        const branches = await getBranchConfigurations();
        const branch = branches.find(b => b.name === user.assignedBranch);
        if (branch && branch.clinicAddress) {
          setClinicAddress(branch.clinicAddress);
        }
      }
    };
    fetchAddress();
  }, [user?.assignedBranch]);

  useEffect(() => {
    const unsubSchedules = subscribeToPublishedSchedules((data) => {
      const schedulesMap = {};
      data.forEach(s => schedulesMap[s.id] = s);
      setSchedules(schedulesMap);
      setSchedulesLoaded(true);
    });

    return () => {
      unsubSchedules();
    };
  }, []);

  // Primary active or published schedule for this branch
  // The service subscribeToPublishedSchedules already filters for status === "published".
  // We just need to find the one for the assigned branch.
  const publishedSchedule = Object.values(schedules).find(s => s.branch === user?.assignedBranch);

  useEffect(() => {
    if (!publishedSchedule) {
      setReservations([]);
      return;
    }

    setReservationsLoaded(false);
    const unsubReservations = subscribeToScheduleReservations(publishedSchedule.id, (data) => {
      setReservations(data);
      setReservationsLoaded(true);
    });

    return () => unsubReservations();
  }, [publishedSchedule?.id]);

  const loading = !schedulesLoaded || (!!publishedSchedule && !reservationsLoaded);

  const activeReservations = publishedSchedule ? reservations.filter(r => r.scheduleId === publishedSchedule.id) : [];

  const totalReservations = activeReservations.length;
  const waitingPatients = activeReservations.filter(r => ["reserved", "waiting", "validation_open", "waiting_for_window"].includes(r.status));
  const checkedInPatients = activeReservations.filter(r => r.status === "checked_in");
  const withDoctorPatients = activeReservations.filter(r => ["with_doctor", "in_consultation"].includes(r.status));
  const completedPatients = activeReservations.filter(r => ["completed", "consultation_completed"].includes(r.status));

  const stats = [
    { name: "Total Reservations", value: totalReservations, icon: Calendar, color: "text-blue-600", bgColor: "bg-blue-100" },
    { name: "Waiting", value: waitingPatients.length, icon: Clock, color: "text-amber-600", bgColor: "bg-amber-100" },
    { name: "Checked In", value: checkedInPatients.length, icon: UserCheck, color: "text-green-600", bgColor: "bg-green-100" },
    { name: "Completed", value: completedPatients.length, icon: CheckCircle2, color: "text-teal-600", bgColor: "bg-teal-100" }
  ];

  const sortedWaitingQueue = activeReservations
    .filter(r => ["checked_in", "reserved", "waiting", "validation_open", "waiting_for_window"].includes(r.status))
    .sort((a, b) => {
      if (a.queueOrder !== undefined && b.queueOrder !== undefined) {
        return a.queueOrder - b.queueOrder;
      }
      return (a.sortTimestamp || a.createdAt || 0) - (b.sortTimestamp || b.createdAt || 0);
    });

  const nextCheckedIn = sortedWaitingQueue.find(r => r.status === "checked_in");
  const nextWaiting = sortedWaitingQueue.find(r => ["reserved", "waiting", "validation_open", "waiting_for_window"].includes(r.status));
  const currentWithDoctor = withDoctorPatients[0];

  let activities = [];
  activeReservations.forEach(res => {
    const name = res.childName || "Patient";
    
    if (res.createdAt) activities.push({ time: res.createdAt, text: `Parent/Guardian reserved a slot.` });
    if (res.checkedInAt) activities.push({ time: res.checkedInAt, text: `${name} checked in` });
    if (res.sentToDoctorAt) activities.push({ time: res.sentToDoctorAt, text: `${name} sent to Doctor` });
    if (res.consultationCompletedAt) activities.push({ time: res.consultationCompletedAt, text: `${name} consultation completed` });
    if (res.cancelledAt) activities.push({ time: res.cancelledAt, text: `${name} cancelled reservation` });
    if (res.forfeitedAt) activities.push({ time: res.forfeitedAt, text: `${name} was forfeited` });
    if (res.penalizedAt || res.lastPenalizedAt) activities.push({ time: res.lastPenalizedAt || res.penalizedAt, text: `${name} penalized` });
  });

  activities.sort((a, b) => b.time - a.time);
  const recentActivities = activities.slice(0, 15);

  const formatTime = (timestamp) => {
    if (!timestamp) return "";
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
  
  const formatTime12h = (time24) => {
    if (!time24) return "";
    const [h, m] = time24.split(":");
    let hours = parseInt(h, 10);
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12 || 12;
    return `${hours}:${m} ${ampm}`;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">


      {/* 1. Primary Dashboard Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card 1: Published Schedule */}
        <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-md">
          <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-600" />
            Published Schedule
          </h2>
          {publishedSchedule ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-6">
              <div>
                <p className="text-xs text-gray-500 uppercase font-bold mb-1">Branch Name</p>
                <p className="text-sm font-semibold text-gray-900">{publishedSchedule.branch}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase font-bold mb-1">Reservation Schedule Status</p>
                <span className={`inline-flex px-3 py-1 rounded-full text-xs font-bold uppercase ${
                  publishedSchedule.queueStatus === 'active' ? 'bg-green-100 text-green-700' : 
                  'bg-blue-100 text-blue-700'
                }`}>
                  {publishedSchedule.queueStatus === 'active' ? 'Active' : 'Published'}
                </span>
              </div>
              <div className="sm:col-span-2">
                <p className="text-xs text-gray-500 uppercase font-bold mb-1">Clinic Address</p>
                <p className="text-sm font-medium text-gray-700 whitespace-pre-line leading-relaxed">{clinicAddress || "No address configured"}</p>
              </div>
              <div className="sm:col-span-2">
                <p className="text-xs text-gray-500 uppercase font-bold mb-1">Clinic Hours</p>
                <p className="text-sm font-medium text-gray-900">
                  {formatTime12h(publishedSchedule.startTime)} - {formatTime12h(publishedSchedule.endTime)}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <AlertCircle className="w-10 h-10 text-gray-300 mb-3" />
              <p className="text-gray-800 font-bold">No Published Schedule</p>
              <p className="text-sm text-gray-500 mt-1 max-w-[250px]">The doctor has not yet published a reservation schedule for your assigned branch.</p>
            </div>
          )}
        </div>

        {/* Card 2: With Doctor */}
        <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-md">
          <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Stethoscope className="w-5 h-5 text-purple-600" />
            With Doctor
          </h2>
          {currentWithDoctor ? (
            <div className="flex flex-col h-full justify-center pb-8">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-purple-100 text-purple-700 flex flex-col items-center justify-center border border-purple-200 shadow-sm shrink-0">
                  <span className="text-[10px] uppercase font-bold leading-none mb-1 opacity-80">Queue</span>
                  <span className="text-xl font-black">#{currentWithDoctor.queueNumber || currentWithDoctor.queuePosition}</span>
                </div>
                <div>
                  <p className="text-xl font-bold text-gray-900 mb-1">{currentWithDoctor.childName || "Unnamed Patient"}</p>
                  <p className="text-sm font-medium text-purple-700 bg-purple-50 inline-flex items-center px-2 py-1 rounded-md">
                    Consultation Started: {formatTime(currentWithDoctor.consultationStartedAt || currentWithDoctor.sentToDoctorAt)}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-6 text-center h-full pb-10">
              <div className="w-12 h-12 rounded-full bg-gray-50 text-gray-300 flex items-center justify-center mb-3 border border-gray-100">
                <Stethoscope className="w-6 h-6" />
              </div>
              <p className="text-gray-800 font-bold">Consultation Room Available</p>
              <p className="text-sm text-gray-500 mt-1">Waiting for the next patient.</p>
            </div>
          )}
        </div>
      </div>

      {/* 3. Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((stat, index) => (
          <div key={index} className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="order-2 sm:order-1">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">{stat.name}</p>
                <h3 className="text-2xl font-black text-gray-800">{stat.value}</h3>
              </div>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 order-1 sm:order-2 ${stat.bgColor}`}>
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 8. Desktop Layout: Main Content + Sidebar */}
      <div className="flex flex-col lg:flex-row gap-6">
        
        {/* Main Content (Left) - Queue Management */}
        {/* Hidden on mobile, visible on desktop */}
        <div className="hidden lg:block lg:flex-[2.5] min-w-0">
          <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden relative">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
              <h2 className="text-sm font-black uppercase text-gray-700 tracking-wide flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-600" />
                Queue Management
              </h2>
              <a 
                href="/secretary/monitor" 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl transition-all shadow-sm active:scale-95"
              >
                <Activity className="w-4 h-4" />
                Live Queue Monitor
              </a>
            </div>
            <div className="p-4 sm:p-6 pb-0">
               {/* Embed ManageQueue Component natively */}
               {/* Note: ManageQueue itself fetches activeStartedSchedule. To prevent duplicated empty states if ManageQueue shows "No Active Queue", it is completely functional and preserves existing logic. */}
               <ManageQueue />
            </div>
          </div>
        </div>

        {/* Information Sidebar (Right) */}
        <div className="lg:flex-1 flex flex-col gap-6 min-w-0">
          

          {/* Recent Activity */}
          <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm flex flex-col flex-1 min-h-[300px]">
            <h2 className="text-sm font-black uppercase text-gray-700 tracking-wide mb-4 flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-600" />
              Recent Activity
            </h2>
            
            <div className="overflow-y-auto flex-1 pr-1 space-y-4 max-h-[400px]">
              {recentActivities.length === 0 ? (
                <div className="text-center py-10 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                  <p className="text-gray-500 font-bold text-sm">No Activity Yet</p>
                  <p className="text-xs text-gray-400 mt-1 max-w-[180px] mx-auto">Clinic activity will appear here throughout the day.</p>
                </div>
              ) : (
                recentActivities.map((act, i) => (
                  <div key={i} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5" />
                      {i < recentActivities.length - 1 && (
                        <div className="w-0.5 h-full bg-gray-200 mt-1" />
                      )}
                    </div>
                    <div className="pb-3 min-w-0">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">{formatTime(act.time)}</p>
                      <p className="text-sm font-medium text-gray-800 break-words">{act.text}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
}