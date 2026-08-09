import React, { useState, useEffect } from "react";
import { FileText, Activity as ActivityIcon, Search, Filter, Shield, Stethoscope, UserCog, User, MapPin, Clock, ArrowDownToLine, AlertCircle, Calendar, Users, Inbox } from "lucide-react";
import { ref, query, limitToLast, onValue } from "firebase/database";
import { database } from "../../firebase/database";
import { AUDIT_CATEGORIES } from "../../services/auditService";
import { useAdminReportsData } from "../../hooks/useAdminReportsData";
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const formatDateTime = (timestamp) => {
  if (!timestamp) return "Unknown";
  const d = new Date(timestamp);
  return new Intl.DateTimeFormat("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit", hour12: true
  }).format(d);
};

const AdminReports = () => {
  const { loading, error, metrics, filters } = useAdminReportsData();
  const { dateRange, setDateRange } = filters;

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center text-gray-500 bg-white rounded-2xl border border-gray-100 shadow-sm md:flex-1">
        <AlertCircle className="w-12 h-12 text-red-300 mb-3" />
        <p className="font-semibold text-gray-600">Failed to load reports data.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 min-h-[400px] flex justify-center items-center md:flex-1">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const { kpis, adoptionData, branchData, outcomeData, hasData } = metrics;

  return (
    <div className="space-y-6 md:flex-1 overflow-y-auto">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-gray-500" />
          <h2 className="text-lg font-bold text-gray-800">System Analytics</h2>
        </div>
        
        <div className="relative min-w-[180px]">
          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <select 
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="w-full pl-9 pr-8 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm font-medium text-gray-700 shadow-sm appearance-none cursor-pointer"
          >
            <option value="This Month">This Month</option>
            <option value="Last 3 Months">Last 3 Months</option>
            <option value="This Year">This Year</option>
            <option value="All Time">All Time</option>
          </select>
        </div>
      </div>

      {!hasData ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center md:flex-1 flex flex-col items-center justify-center min-h-[300px]">
          <div className="mx-auto w-16 h-16 bg-gray-50 text-gray-400 rounded-full flex items-center justify-center mb-4">
            <Inbox className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-gray-800 mb-1">No Activity Found</h3>
          <p className="text-gray-500 text-sm max-w-sm mx-auto">
            There is no system activity for the selected date range. Try expanding your search.
          </p>
        </div>
      ) : (
        <>
          {/* KPI Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-blue-50 rounded-lg">
                  <Users className="w-5 h-5 text-blue-600" />
                </div>
                <span className="text-sm font-semibold text-gray-600 uppercase tracking-wider">Registered Parents</span>
              </div>
              <div className="text-3xl font-bold text-gray-800 mt-auto">{kpis.totalParents}</div>
            </div>
            
            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-indigo-50 rounded-lg">
                  <MapPin className="w-5 h-5 text-indigo-600" />
                </div>
                <span className="text-sm font-semibold text-gray-600 uppercase tracking-wider">Completed Sessions</span>
              </div>
              <div className="text-3xl font-bold text-gray-800 mt-auto">{kpis.totalSessions}</div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-green-50 rounded-lg">
                  <ActivityIcon className="w-5 h-5 text-green-600" />
                </div>
                <span className="text-sm font-semibold text-gray-600 uppercase tracking-wider">Total Reservations</span>
              </div>
              <div className="text-3xl font-bold text-gray-800 mt-auto">{kpis.totalReservations}</div>
            </div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Adoption Trend */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 lg:col-span-2">
              <h3 className="text-lg font-bold text-gray-800 mb-6">Parent Adoption Trend</h3>
              <div className="h-72 w-full">
                {adoptionData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={adoptionData} margin={{ top: 5, right: 0, bottom: 5, left: -20 }}>
                      <defs>
                        <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                      <XAxis 
                        dataKey="date" 
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#6b7280', fontSize: 12 }}
                        dy={10}
                      />
                      <YAxis 
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#6b7280', fontSize: 12 }}
                        allowDecimals={false}
                      />
                      <Tooltip 
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        labelStyle={{ fontWeight: 'bold', color: '#374151', marginBottom: '4px' }}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="users" 
                        name="New Users"
                        stroke="#2563eb" 
                        strokeWidth={3}
                        fillOpacity={1} 
                        fill="url(#colorUsers)" 
                        activeDot={{ r: 6, strokeWidth: 0 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-400">
                    No adoption data in this period
                  </div>
                )}
              </div>
            </div>

            {/* Branch Utilization */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <h3 className="text-lg font-bold text-gray-800 mb-6">Reservations by Branch</h3>
              <div className="h-72 w-full">
                {branchData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={branchData} margin={{ top: 5, right: 0, bottom: 5, left: -20 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                      <XAxis 
                        dataKey="branch" 
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#6b7280', fontSize: 12 }}
                        dy={10}
                      />
                      <YAxis 
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#6b7280', fontSize: 12 }}
                        allowDecimals={false}
                      />
                      <Tooltip 
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        cursor={{ fill: '#f9fafb' }}
                      />
                      <Bar dataKey="reservations" name="Reservations" fill="#4f46e5" radius={[4, 4, 0, 0]} maxBarSize={60} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-400">
                    No branch data in this period
                  </div>
                )}
              </div>
            </div>

            {/* Global Outcomes */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <h3 className="text-lg font-bold text-gray-800 mb-6">Global Outcomes</h3>
              <div className="h-72 w-full">
                {outcomeData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={outcomeData}
                        cx="50%"
                        cy="50%"
                        innerRadius={70}
                        outerRadius={95}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {outcomeData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      />
                      <Legend 
                        verticalAlign="bottom" 
                        height={36}
                        iconType="circle"
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-400">
                    No outcome data to display
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default function Activity() {
  const [activeTab, setActiveTab] = useState("audit");
  
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [logLimit, setLogLimit] = useState(100);
  const [hasMoreLogs, setHasMoreLogs] = useState(true);
  const [error, setError] = useState(null);

  const [categoryFilter, setCategoryFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (activeTab !== "audit") return;
    
    setLoading(true);
    setError(null);
    const auditRef = ref(database, "auditLogs");
    const q = query(auditRef, limitToLast(logLimit));
    
    const unsubscribe = onValue(q, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const logsList = Object.keys(data).map(key => ({
          id: key,
          ...data[key]
        }));
        
        // Reverse to show newest first
        logsList.sort((a, b) => b.timestamp - a.timestamp);
        
        setLogs(logsList);
        // If we get fewer logs than the limit, we've reached the end
        setHasMoreLogs(logsList.length === logLimit);
      } else {
        setLogs([]);
        setHasMoreLogs(false);
      }
      setLoading(false);
    }, (err) => {
      console.error("Failed to load audit logs", err);
      setError("Failed to load audit logs. Please try again later.");
      setLoading(false);
    });

    return () => unsubscribe();
  }, [activeTab, logLimit]);

  const filteredLogs = logs.filter(log => {
    const term = searchQuery.toLowerCase();
    const matchesSearch = (log.actorName && log.actorName.toLowerCase().includes(term)) || 
                          (log.description && log.description.toLowerCase().includes(term));
    const matchesCategory = categoryFilter === "all" || log.category === categoryFilter;
    const matchesRole = roleFilter === "all" || log.actorRole === roleFilter;

    return matchesSearch && matchesCategory && matchesRole;
  });

  const getRoleIcon = (role) => {
    switch(role) {
      case 'doctor': return <Stethoscope className="w-4 h-4 mr-1.5" />;
      case 'secretary': return <UserCog className="w-4 h-4 mr-1.5" />;
      case 'admin': return <Shield className="w-4 h-4 mr-1.5" />;
      default: return <User className="w-4 h-4 mr-1.5" />;
    }
  };

  const getRoleColor = (role) => {
    switch(role) {
      case 'doctor': return "bg-purple-50 text-purple-700 border-purple-200";
      case 'secretary': return "bg-amber-50 text-amber-700 border-amber-200";
      case 'admin': return "bg-blue-50 text-blue-700 border-blue-200";
      default: return "bg-gray-50 text-gray-700 border-gray-200";
    }
  };

  const formatCategory = (categoryStr) => {
    if (!categoryStr) return "System";
    return categoryStr.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  return (
    <div className="space-y-6 pb-8 md:h-[calc(100vh-140px)] md:flex md:flex-col">
      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        <button
          className={`flex items-center pb-4 px-4 font-semibold text-sm transition-colors border-b-2 ${
            activeTab === "audit"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-gray-500 hover:text-gray-800"
          }`}
          onClick={() => setActiveTab("audit")}
        >
          <ActivityIcon className="w-4 h-4 mr-2" />
          Audit Logs
        </button>
        <button
          className={`flex items-center pb-4 px-4 font-semibold text-sm transition-colors border-b-2 ${
            activeTab === "reports"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-gray-500 hover:text-gray-800"
          }`}
          onClick={() => setActiveTab("reports")}
        >
          <FileText className="w-4 h-4 mr-2" />
          Reports
        </button>
      </div>

      {/* Content area */}
      {activeTab === "audit" ? (
        <>
          {/* Sticky Search & Filters Toolbar */}
          <div className="sticky top-[64px] z-20 bg-gray-50/95 backdrop-blur-md pb-4 pt-2 -mx-4 px-4 md:-mx-8 md:px-8 lg:-mx-10 lg:px-10 -mt-2 sm:-mt-4">
            <div className="bg-white p-3 sm:p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input 
                  type="text" 
                  placeholder="Search activity..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-colors text-gray-800"
                />
              </div>
              
              <div className="flex gap-3">
                <div className="relative flex-1 md:flex-none">
                  <select 
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="w-full appearance-none pl-10 pr-8 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-colors text-gray-700 font-medium cursor-pointer min-w-[200px]"
                  >
                    <option value="all">All Categories</option>
                    {Object.values(AUDIT_CATEGORIES).map(cat => (
                      <option key={cat} value={cat}>{formatCategory(cat)}</option>
                    ))}
                  </select>
                  <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                </div>

                <div className="relative flex-1 md:flex-none">
                  <select 
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value)}
                    className="w-full appearance-none px-4 pr-8 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-colors text-gray-700 font-medium cursor-pointer"
                  >
                    <option value="all">All Roles</option>
                    <option value="admin">Admin</option>
                    <option value="doctor">Doctor</option>
                    <option value="secretary">Secretary</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden min-h-[300px] md:flex-1 md:flex md:flex-col md:min-h-0">
            {error ? (
              <div className="flex flex-col items-center justify-center p-12 text-center text-gray-500 md:flex-1">
                <AlertCircle className="w-12 h-12 text-red-300 mb-3" />
                <p className="font-semibold text-gray-600">{error}</p>
              </div>
            ) : loading && logs.length === 0 ? (
              <div className="flex justify-center items-center h-48 md:flex-1">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : filteredLogs.length > 0 ? (
              <>
                {/* Mobile Card Layout */}
                <div className="block md:hidden divide-y divide-gray-100 overflow-y-auto">
                  {filteredLogs.map((log) => (
                    <div key={log.id} className="p-5 flex flex-col gap-3">
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <h3 className="font-bold text-gray-800 text-sm leading-tight">{log.description}</h3>
                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-xs text-gray-500 flex items-center">
                              <Clock className="w-3.5 h-3.5 mr-1" />
                              {formatDateTime(log.timestamp)}
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2 mt-1 bg-gray-50/50 p-3 rounded-xl border border-gray-100 items-center">
                        <div className="text-sm">
                          <span className="text-gray-500 text-xs block mb-1">Actor</span>
                          <span className="font-medium text-gray-800 block truncate">{log.actorName}</span>
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold border capitalize mt-1 ${getRoleColor(log.actorRole)}`}>
                            {getRoleIcon(log.actorRole)}
                            {log.actorRole}
                          </span>
                        </div>
                        <div className="text-sm">
                          <span className="text-gray-500 text-xs block mb-1">Category</span>
                          <span className="font-semibold text-gray-700 bg-gray-100 px-2 py-0.5 rounded border border-gray-200 inline-block truncate max-w-full">
                            {formatCategory(log.category)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop Table Layout */}
                <div className="hidden md:block overflow-x-auto md:flex-1 md:overflow-y-auto relative">
                  <table className="w-full text-left border-collapse">
                    <thead className="sticky top-0 z-10 bg-gray-50">
                      <tr className="border-b border-gray-100 text-xs uppercase tracking-wider text-gray-500 font-bold">
                        <th className="p-4 pl-6 w-48">Date & Time</th>
                        <th className="p-4 w-48">Actor</th>
                        <th className="p-4 w-32">Role</th>
                        <th className="p-4 min-w-[200px]">Activity</th>
                        <th className="p-4 w-48">Category</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {filteredLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-gray-50/80 transition-colors group">
                          <td className="p-4 pl-6 text-sm text-gray-500 whitespace-nowrap">
                            {formatDateTime(log.timestamp)}
                          </td>
                          <td className="p-4 font-medium text-gray-800 truncate max-w-[150px]">
                            {log.actorName}
                          </td>
                          <td className="p-4">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${getRoleColor(log.actorRole)} capitalize`}>
                              {getRoleIcon(log.actorRole)}
                              {log.actorRole}
                            </span>
                          </td>
                          <td className="p-4 text-sm font-semibold text-gray-800">
                            {log.description}
                          </td>
                          <td className="p-4">
                            <span className="inline-flex items-center text-xs font-bold text-gray-600 bg-gray-100 px-2.5 py-1 rounded-full border border-gray-200">
                              {formatCategory(log.category)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Expand Window Button */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50/50 gap-4 md:flex-none z-10">
                  <div className="text-sm text-gray-500 font-medium text-center sm:text-left">
                    Showing {filteredLogs.length} matching {filteredLogs.length === 1 ? 'record' : 'records'}
                  </div>
                  <div className="flex items-center justify-center">
                    {hasMoreLogs && (
                      <button 
                        onClick={() => setLogLimit(l => l + 100)}
                        disabled={loading}
                        className="flex items-center px-4 py-2 rounded-lg border border-blue-200 text-sm font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {loading ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-700 mr-2"></div>
                        ) : (
                          <ArrowDownToLine className="w-4 h-4 mr-2" />
                        )}
                        Load Older Logs
                      </button>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center p-12 text-center text-gray-500 md:flex-1">
                <ActivityIcon className="w-12 h-12 text-gray-300 mb-3" />
                <p className="font-semibold text-gray-600">No activity logs found.</p>
                {(searchQuery || categoryFilter !== "all" || roleFilter !== "all") && (
                  <button 
                    onClick={() => { setSearchQuery(""); setCategoryFilter("all"); setRoleFilter("all"); }}
                    className="mt-4 text-sm text-blue-600 font-medium hover:underline"
                  >
                    Clear Filters
                  </button>
                )}
              </div>
            )}
          </div>
        </>
      ) : (
        <AdminReports />
      )}
    </div>
  );
}
