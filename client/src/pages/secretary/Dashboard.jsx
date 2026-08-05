import React, { useState, useEffect } from 'react';
import { Calendar, Users, CheckCircle, Activity, MapPin, Clock, Stethoscope, CheckCircle2, UserCheck, AlertCircle } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { getBranchConfigurations } from "../../services/branchConfigurationService";
import { subscribeToAllReservations } from "../../services/reservationService";
import { subscribeToPublishedSchedules } from "../../services/scheduleService";

export default function Dashboard() {
  const { user } = useAuth();
  const [clinicAddress, setClinicAddress] = useState("");
  const [schedules, setSchedules] = useState({});
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);

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

  const getLocalDateString = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  
  const todayDateStr = getLocalDateString();

  // Find active schedule for today and this branch
  const activeSchedule = Object.values(schedules).find(s => 
    s.branch === user?.assignedBranch && s.clinicDate === todayDateStr
  ) || Object.values(schedules).find(s => 
    s.branch === user?.assignedBranch && ["active", "paused"].includes(s.queueStatus)
  );

  const activeReservations = activeSchedule ? reservations.filter(r => r.scheduleId === activeSchedule.id) : [];

  const totalReservations = activeReservations.length;
  const waitingPatients = activeReservations.filter(r => ["reserved", "waiting", "validation_open", "waiting_for_window"].includes(r.status));
  const checkedInPatients = activeReservations.filter(r => r.status === "checked_in");
  const withDoctorPatients = activeReservations.filter(r => ["with_doctor", "in_consultation"].includes(r.status));
  const completedPatients = activeReservations.filter(r => ["completed", "consultation_completed"].includes(r.status));

  const stats = [
    { name: "Total Reservations", value: totalReservations, icon: Calendar, color: "text-blue-600", bgColor: "bg-blue-100" },
    { name: "Waiting", value: waitingPatients.length, icon: Clock, color: "text-amber-600", bgColor: "bg-amber-100" },
    { name: "Checked In", value: checkedInPatients.length, icon: UserCheck, color: "text-green-600", bgColor: "bg-green-100" },
    { name: "With Doctor", value: withDoctorPatients.length, icon: Stethoscope, color: "text-purple-600", bgColor: "bg-purple-100" },
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
    
    if (res.createdAt) activities.push({ time: res.createdAt, text: `${name} reserved a slot` });
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
      {/* Branch Awareness Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Secretary Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1 flex items-center gap-1.5">
            <MapPin className="w-4 h-4 text-blue-600" />
            <span>Managing <span className="font-bold text-gray-700">{user?.assignedBranch}</span></span>
          </p>
        </div>
      </div>

      {/* 1. Today's Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {stats.map((stat, index) => (
          <div key={index} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="order-2 sm:order-1">
                <p className="text-xs font-medium text-gray-500 mb-0.5">{stat.name}</p>
                <h3 className="text-2xl font-bold text-gray-800">{stat.value}</h3>
              </div>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 order-1 sm:order-2 ${stat.bgColor}`}>
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {activeSchedule ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
          <div className="lg:col-span-2 space-y-6">
            {/* 2. Active Schedule Information */}
            <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
              <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-blue-600" />
                Today's Active Schedule
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-8">
                <div>
                  <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Branch</p>
                  <p className="text-sm font-medium text-gray-800">{activeSchedule.branch}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Clinic Address</p>
                  <p className="text-sm font-medium text-gray-800 whitespace-pre-line leading-snug">{clinicAddress || "No address configured"}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Clinic Hours</p>
                  <p className="text-sm font-medium text-gray-800">
                    {formatTime12h(activeSchedule.startTime)} - {formatTime12h(activeSchedule.endTime)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Queue Status</p>
                  <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-bold uppercase ${
                    activeSchedule.queueStatus === 'active' ? 'bg-green-100 text-green-700' : 
                    activeSchedule.queueStatus === 'paused' ? 'bg-amber-100 text-amber-700' : 
                    activeSchedule.queueStatus === 'closed' ? 'bg-red-100 text-red-700' : 
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {activeSchedule.queueStatus || "NOT STARTED"}
                  </span>
                </div>
              </div>
            </div>

            {/* 3. Current Queue Status */}
            <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
              <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-600" />
                Current Queue
              </h2>
              
              {activeReservations.length === 0 ? (
                <div className="text-center py-6 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                  <p className="text-gray-500 font-medium">No Reservations Yet</p>
                  <p className="text-sm text-gray-400 mt-1">No patients have reserved today's schedule.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* With Doctor */}
                  <div className="flex items-center justify-between p-4 rounded-xl bg-purple-50 border border-purple-100">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center">
                        <Stethoscope className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-purple-700 uppercase tracking-wide">With Doctor</p>
                        <p className="font-bold text-gray-800">
                          {currentWithDoctor ? currentWithDoctor.childName || "Patient" : "None"}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Next Checked In */}
                  <div className="flex items-center justify-between p-4 rounded-xl bg-green-50 border border-green-100">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-green-100 text-green-600 flex items-center justify-center">
                        <UserCheck className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-green-700 uppercase tracking-wide">Next Checked In</p>
                        <p className="font-bold text-gray-800">
                          {nextCheckedIn ? nextCheckedIn.childName || "Patient" : "None"}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Next Waiting */}
                  <div className="flex items-center justify-between p-4 rounded-xl bg-amber-50 border border-amber-100">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center">
                        <Clock className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-amber-700 uppercase tracking-wide">Next Waiting</p>
                        <p className="font-bold text-gray-800">
                          {nextWaiting ? nextWaiting.childName || "Patient" : "None"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 4. Recent Activity */}
          <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm flex flex-col h-[500px] lg:h-auto lg:max-h-[800px]">
            <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Activity className="w-5 h-5 text-blue-600" />
              Recent Activity
            </h2>
            
            <div className="overflow-y-auto flex-1 pr-2 space-y-4">
              {recentActivities.length === 0 ? (
                <div className="text-center py-10">
                  <p className="text-gray-500 font-medium">No activity yet</p>
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
                    <div className="pb-4">
                      <p className="text-xs font-bold text-gray-400 mb-0.5">{formatTime(act.time)}</p>
                      <p className="text-sm font-medium text-gray-800">{act.text}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Empty State: No Active Schedule */
        <div className="mt-8 bg-white rounded-3xl border border-gray-100 shadow-sm p-12 text-center max-w-2xl mx-auto">
          <div className="w-16 h-16 bg-gray-50 text-gray-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">No Active Clinic</h2>
          <p className="text-gray-500 text-sm leading-relaxed max-w-md mx-auto">
            There is currently no active schedule for your assigned branch. Wait for the clinic session to be published by the Doctor.
          </p>
        </div>
      )}
    </div>
  );
}