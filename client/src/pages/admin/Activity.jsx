import React, { useState, useEffect } from "react";
import { FileText, Activity as ActivityIcon, Search, Filter, Shield, Stethoscope, UserCog, User, MapPin, Clock, ArrowDownToLine, AlertCircle } from "lucide-react";
import { ref, query, limitToLast, onValue } from "firebase/database";
import { database } from "../../firebase/database";
import { AUDIT_CATEGORIES } from "../../services/auditService";

const formatDateTime = (timestamp) => {
  if (!timestamp) return "Unknown";
  const d = new Date(timestamp);
  return new Intl.DateTimeFormat("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit", hour12: true
  }).format(d);
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
      <div>
        <h1 className="text-2xl font-bold text-gray-800">System Activity</h1>
        <p className="text-gray-500 mt-1">View audit logs and system reports</p>
      </div>

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
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 min-h-[400px] flex flex-col items-center justify-center text-center md:flex-1">
          <div className="w-16 h-16 bg-purple-50 text-purple-600 rounded-full flex items-center justify-center mb-4">
            <FileText className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">System Reports Coming Soon</h2>
          <p className="text-gray-500 max-w-md">
            Detailed analytical reports and export functionality will be available in this section.
          </p>
        </div>
      )}
    </div>
  );
}
