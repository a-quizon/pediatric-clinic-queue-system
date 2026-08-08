import React, { useState, useEffect } from "react";
import { CalendarDays, CheckCircle2, User, Users, MapPin, Activity } from "lucide-react";
import { ref, onValue } from "firebase/database";
import { database } from "../../firebase/database";

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalReservations: 0,
    completedConsultations: 0,
    totalSchedules: 0,
    registeredParents: 0,
    activeStaff: 0,
    branches: 0,
  });

  useEffect(() => {
    // Refs
    const usersRef = ref(database, "users");
    const schedulesRef = ref(database, "schedules");
    const reservationsRef = ref(database, "reservations");
    const branchesRef = ref(database, "branchConfigurations");

    let usersData = {};
    let schedulesData = {};
    let reservationsData = {};
    let branchesData = {};

    let usersLoaded = false;
    let schedulesLoaded = false;
    let reservationsLoaded = false;
    let branchesLoaded = false;
    const computeStats = () => {
      if (!usersLoaded || !schedulesLoaded || !reservationsLoaded || !branchesLoaded) return;
      
      // Calculate Users Stats
      const usersList = Object.values(usersData || {});
      const registeredParents = usersList.filter(u => u.role === "parent").length;
      const activeStaff = usersList.filter(u => 
        (u.role === "doctor" || u.role === "secretary") && u.status === "active"
      ).length;

      // Calculate Branches Stats
      const branches = Object.values(branchesData || {}).length;

      // Calculate Schedule Stats
      const totalSchedules = Object.values(schedulesData || {}).filter(
        s => s.status !== "draft"
      ).length;

      // Calculate Reservation Stats
      const totalReservations = Object.keys(reservationsData || {}).length;

      const completedConsultations = Object.values(reservationsData || {}).filter(r => 
        ["completed", "consultation_completed"].includes(r.status)
      ).length;

      setStats({
        totalReservations,
        completedConsultations,
        totalSchedules,
        registeredParents,
        activeStaff,
        branches,
      });
      setLoading(false);
    };

    const unsubUsers = onValue(usersRef, (snapshot) => {
      usersData = snapshot.val();
      usersLoaded = true;
      computeStats();
    });

    const unsubSchedules = onValue(schedulesRef, (snapshot) => {
      schedulesData = snapshot.val();
      schedulesLoaded = true;
      computeStats();
    });

    const unsubReservations = onValue(reservationsRef, (snapshot) => {
      reservationsData = snapshot.val();
      reservationsLoaded = true;
      computeStats();
    });

    const unsubBranches = onValue(branchesRef, (snapshot) => {
      branchesData = snapshot.val();
      branchesLoaded = true;
      computeStats();
    });

    return () => {
      unsubUsers();
      unsubSchedules();
      unsubReservations();
      unsubBranches();
    };
  }, []);

  const statCards = [
    { title: "Total Reservations", value: stats.totalReservations, icon: CalendarDays, color: "text-blue-600", bg: "bg-blue-50" },
    { title: "Completed Consultations", value: stats.completedConsultations, icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50" },
    { title: "Total Schedules", value: stats.totalSchedules, icon: Activity, color: "text-pink-600", bg: "bg-pink-50" },
    { title: "Registered Parents", value: stats.registeredParents, icon: User, color: "text-indigo-600", bg: "bg-indigo-50" },
    { title: "Active Staff", value: stats.activeStaff, icon: Users, color: "text-purple-600", bg: "bg-purple-50" },
    { title: "Clinic Branches", value: stats.branches, icon: MapPin, color: "text-rose-600", bg: "bg-rose-50" },
  ];

  const recentActivity = [
    { id: 1, action: "Dr. Smith logged in", time: "2 mins ago", type: "auth" },
    { id: 2, action: "New branch 'Downtown' created", time: "1 hour ago", type: "system" },
    { id: 3, action: "Secretary 'Jane Doe' account created", time: "3 hours ago", type: "user" },
    { id: 4, action: "System backup completed", time: "5 hours ago", type: "system" },
  ];

  return (
    <div className="space-y-8">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        {statCards.map((stat, index) => (
          <div key={index} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className={`p-3 rounded-xl ${stat.bg}`}>
                <stat.icon className={`w-6 h-6 ${stat.color}`} />
              </div>
            </div>
            <h3 className="text-gray-500 text-sm font-medium mb-1">{stat.title}</h3>
            {loading ? (
              <div className="h-8 w-16 bg-gray-200 rounded animate-pulse mt-1"></div>
            ) : (
              <p className="text-2xl font-bold text-gray-800">{stat.value}</p>
            )}
          </div>
        ))}
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden opacity-60">
        <div className="p-6 border-b border-gray-50">
          <h2 className="text-lg font-bold text-gray-800">Recent System Activity (Coming Soon)</h2>
        </div>
        <div className="p-6">
          <div className="space-y-6">
            {recentActivity.map((activity) => (
              <div key={activity.id} className="flex items-start">
                <div className="w-2 h-2 mt-2 rounded-full bg-blue-500 mr-4"></div>
                <div>
                  <p className="text-sm font-medium text-gray-800">{activity.action}</p>
                  <p className="text-xs text-gray-500 mt-1">{activity.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
