import React, { useState, useEffect } from "react";
import { CalendarDays, CheckCircle2, User, Users, MapPin, Activity, Clock } from "lucide-react";
import { ref, onValue } from "firebase/database";
import { database } from "../../firebase/database";

// Helper utilities for date/time
const formatTime = (timeStr) => {
  if (!timeStr) return "";
  const [hours, minutes] = timeStr.split(":");
  const h = parseInt(hours, 10);
  const ampm = h >= 12 ? "PM" : "AM";
  const formattedHours = h % 12 || 12;
  return `${formattedHours}:${minutes} ${ampm}`;
};

const formatDate = (dateStr) => {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric"
  });
};

const getTodayStr = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({
    registeredParents: 0,
    activeStaff: 0,
    branches: 0,
  });
  
  const [currentOperation, setCurrentOperation] = useState(null);

  useEffect(() => {
    // Refs
    const usersRef = ref(database, "users");
    const schedulesRef = ref(database, "schedules");
    const branchesRef = ref(database, "branchConfigurations");

    let usersData = {};
    let schedulesData = {};
    let branchesData = {};

    let usersLoaded = false;
    let schedulesLoaded = false;
    let branchesLoaded = false;
    
    const computeStats = () => {
      if (!usersLoaded || !schedulesLoaded || !branchesLoaded) return;
      
      const usersList = Object.values(usersData || {});
      const schedulesList = Object.values(schedulesData || {});
      
      // 1. Registered Parents
      const registeredParents = usersList.filter(u => u.role === "parent").length;
      
      // 2. Active Staff
      const activeStaff = usersList.filter(u => 
        (u.role === "doctor" || u.role === "secretary") && u.status === "active"
      ).length;

      // 3. Clinic Branches
      const branches = Object.keys(branchesData || {}).length;

      setStats({
        registeredParents,
        activeStaff,
        branches,
      });

      // --- Current Clinic Operation Logic ---
      const todayStr = getTodayStr();
      const publishedList = schedulesList.filter(s => s.status === "published");
      
      let relevantSchedule = null;
      let operationState = "";

      // Priority 1: Currently Operating
      const currentlyOperating = publishedList.filter(s => 
        ["active", "paused", "closed"].includes(s.queueStatus)
      );
      
      if (currentlyOperating.length > 0) {
        // Deterministic fallback if multiple are active
        currentlyOperating.sort((a, b) => {
          const statePriority = { "active": 1, "paused": 2, "closed": 3 };
          const pA = statePriority[a.queueStatus] || 99;
          const pB = statePriority[b.queueStatus] || 99;
          if (pA !== pB) return pA - pB;
          const dateA = new Date(a.clinicDate).getTime();
          const dateB = new Date(b.clinicDate).getTime();
          if (dateA !== dateB) return dateA - dateB;
          return (a.openingTime || "").localeCompare(b.openingTime || "");
        });
        
        relevantSchedule = currentlyOperating[0];
        if (relevantSchedule.queueStatus === "active") operationState = "Queue Active";
        else if (relevantSchedule.queueStatus === "paused") operationState = "Queue Paused";
        else if (relevantSchedule.queueStatus === "closed") operationState = "Queue Closed";
      } 
      else {
        // Priority 2: Next Schedule Today
        const todaySchedules = publishedList.filter(s => s.clinicDate === todayStr);
        if (todaySchedules.length > 0) {
          todaySchedules.sort((a, b) => (a.openingTime || "").localeCompare(b.openingTime || ""));
          relevantSchedule = todaySchedules[0];
          operationState = "Schedule Published";
        } 
        else {
          // Priority 3: Earliest Upcoming Schedule
          const upcomingSchedules = publishedList.filter(s => s.clinicDate > todayStr);
          if (upcomingSchedules.length > 0) {
            upcomingSchedules.sort((a, b) => {
              const dateA = new Date(a.clinicDate).getTime();
              const dateB = new Date(b.clinicDate).getTime();
              if (dateA !== dateB) return dateA - dateB;
              return (a.openingTime || "").localeCompare(b.openingTime || "");
            });
            relevantSchedule = upcomingSchedules[0];
            operationState = "Schedule Published";
          }
        }
      }

      if (relevantSchedule) {
        setCurrentOperation({
          branchName: relevantSchedule.branch || "Unknown Branch",
          state: operationState,
          date: formatDate(relevantSchedule.clinicDate),
          timeStr: `${formatTime(relevantSchedule.openingTime)} – ${formatTime(relevantSchedule.closingTime)}`
        });
      } else {
        setCurrentOperation(null);
      }

      setLoading(false);
    };

    const handleError = (err) => {
      console.error("Firebase Read Error:", err);
      setError("Failed to load dashboard data. You may not have permission.");
      setLoading(false);
    };

    const unsubUsers = onValue(usersRef, (snapshot) => {
      usersData = snapshot.val();
      usersLoaded = true;
      setError(null);
      computeStats();
    }, handleError);

    const unsubSchedules = onValue(schedulesRef, (snapshot) => {
      schedulesData = snapshot.val();
      schedulesLoaded = true;
      computeStats();
    }, handleError);

    const unsubBranches = onValue(branchesRef, (snapshot) => {
      branchesData = snapshot.val();
      branchesLoaded = true;
      computeStats();
    }, handleError);

    return () => {
      unsubUsers();
      unsubSchedules();
      unsubBranches();
    };
  }, []);

  const statCards = [
    { title: "Registered Parents", value: stats.registeredParents, icon: User, color: "text-blue-600", bg: "bg-blue-50" },
    { title: "Active Staff", value: stats.activeStaff, icon: Users, color: "text-emerald-600", bg: "bg-emerald-50" },
    { title: "Clinic Branches", value: stats.branches, icon: MapPin, color: "text-indigo-600", bg: "bg-indigo-50" },
  ];

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-100 flex items-center gap-3">
           <Activity className="w-5 h-5 shrink-0" />
           <p className="font-medium text-sm">{error}</p>
        </div>
      )}
      
      {/* System Overview */}
      <div>
        <h2 className="text-xl font-bold text-gray-800 mb-4">System Overview</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {statCards.map((stat, index) => (
            <div key={index} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between mb-3">
                <div className={`p-2.5 rounded-xl ${stat.bg}`}>
                  <stat.icon className={`w-5 h-5 ${stat.color}`} />
                </div>
              </div>
              <div>
                <h3 className="text-gray-500 text-xs font-medium uppercase tracking-wider mb-1">{stat.title}</h3>
                {loading ? (
                  <div className="h-7 w-12 bg-gray-200 rounded animate-pulse"></div>
                ) : (
                  <p className="text-2xl font-bold text-gray-800">{stat.value}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Current Clinic Operation */}
      <div>
        <h2 className="text-xl font-bold text-gray-800 mb-4">Current Clinic Operation</h2>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 lg:p-8">
          {loading ? (
            <div className="animate-pulse space-y-4">
              <div className="h-6 w-1/4 bg-gray-200 rounded"></div>
              <div className="h-8 w-1/3 bg-gray-200 rounded"></div>
              <div className="h-4 w-1/2 bg-gray-200 rounded"></div>
            </div>
          ) : currentOperation ? (
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div>
                <div className="flex items-center text-gray-500 mb-2">
                  <MapPin className="w-4 h-4 mr-1.5" />
                  <span className="font-medium">{currentOperation.branchName}</span>
                </div>
                <h3 className="text-3xl font-bold text-gray-800 tracking-tight">
                  {currentOperation.state}
                </h3>
              </div>
              <div className="flex flex-col gap-2 md:items-end">
                <div className="flex items-center text-gray-700 bg-gray-50 px-4 py-2 rounded-lg font-medium">
                  <CalendarDays className="w-4 h-4 mr-2 text-blue-600" />
                  {currentOperation.date}
                </div>
                <div className="flex items-center text-gray-700 bg-gray-50 px-4 py-2 rounded-lg font-medium">
                  <Clock className="w-4 h-4 mr-2 text-emerald-600" />
                  {currentOperation.timeStr}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-50 text-gray-400 rounded-full flex items-center justify-center mx-auto mb-4">
                <Activity className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-2">No Active Clinic Session</h3>
              <p className="text-gray-500 max-w-md mx-auto">
                There is currently no published clinic schedule waiting to run or currently running.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
