import React, { useState, useEffect } from "react";
import { BarChart3, TrendingUp, Users, Clock, AlertCircle, PieChart, Activity, CheckCircle, XCircle, Calendar, MapPin, Inbox, Loader2, ChevronLeft, ChevronRight, RefreshCcw } from "lucide-react";
import { useReportsData } from "../../hooks/useReportsData";
import { getBranchConfigurations } from "../../services/branchConfigurationService";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart as RePieChart, Pie, Cell, Legend } from 'recharts';

export default function Reports() {
  const { loading, error, dataset, unfilteredDataset, filters } = useReportsData();
  const { branch, setBranch, dateRange, setDateRange } = filters;
  const [branches, setBranches] = useState([]);

  // Pagination state must be declared before any conditional returns
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    getBranchConfigurations().then(setBranches);
  }, []);

  // Reset pagination when dataset changes
  useEffect(() => {
    setCurrentPage(1);
  }, [dataset]);

  if (error) return <div className="text-red-500 text-center py-10">Failed to load reports data.</div>;

  const aggregated = dataset.reduce((acc, curr) => {
    acc.totalReservations += curr.metrics.totalReservations;
    acc.checkedUp += curr.metrics.checkedUp;
    acc.cancelled += curr.metrics.cancelled;
    acc.forfeited += curr.metrics.forfeited;
    return acc;
  }, {
    totalReservations: 0,
    checkedUp: 0,
    cancelled: 0,
    forfeited: 0,
  });

  const completionRate = aggregated.totalReservations > 0 
    ? ((aggregated.checkedUp / aggregated.totalReservations) * 100).toFixed(0) 
    : 0;

  // Chart Data Preparation
  const trendDataMap = dataset.reduce((acc, curr) => {
    const date = curr.clinicDate; 
    if (!acc[date]) {
      acc[date] = { date, reservations: 0 };
    }
    acc[date].reservations += curr.metrics.totalReservations;
    return acc;
  }, {});
  
  const trendData = Object.values(trendDataMap).sort((a, b) => new Date(a.date) - new Date(b.date));

  const outcomeData = [
    { name: 'Checked Up', value: aggregated.checkedUp, color: '#16a34a' },
    { name: 'Cancelled', value: aggregated.cancelled, color: '#dc2626' },
    { name: 'Forfeited', value: aggregated.forfeited, color: '#ea580c' },
  ].filter(item => item.value > 0);

  const sortedDataset = [...dataset].sort((a, b) => {
    const dateA = new Date(a.clinicDate).getTime();
    const dateB = new Date(b.clinicDate).getTime();
    if (dateA !== dateB) return dateB - dateA;
    return (a.openingTime || '').localeCompare(b.openingTime || '');
  });

  const totalPages = Math.ceil(sortedDataset.length / itemsPerPage);
  const paginatedDataset = sortedDataset.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const handleResetFilters = () => {
    setBranch("All Branches");
    setDateRange("This Month");
  };

  const isFiltered = branch !== "All Branches" || dateRange !== "This Month";

  return (
    <div className="space-y-6 pb-6 relative">
      
      {/* Filters and Summary */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
        <div className="flex flex-col">
          <span className="text-sm text-gray-500 font-medium">Showing:</span>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-gray-800 font-semibold">{branch}</span>
            <span className="text-gray-400">•</span>
            <span className="text-gray-800 font-semibold">{dateRange}</span>
            {isFiltered && (
              <button 
                onClick={handleResetFilters}
                className="ml-2 flex items-center text-xs font-medium text-blue-600 hover:text-blue-700 bg-blue-50 px-2 py-1 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
                aria-label="Reset filters"
              >
                <RefreshCcw className="w-3 h-3 mr-1" /> Reset
              </button>
            )}
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative min-w-[180px]">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <select 
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              className="w-full pl-9 pr-8 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm font-medium text-gray-700 shadow-sm appearance-none cursor-pointer"
              aria-label="Filter by Branch"
            >
              <option value="All Branches">All Branches</option>
              {branches.map(b => (
                <option key={b.id} value={b.name}>{b.name}</option>
              ))}
            </select>
          </div>
          <div className="relative min-w-[160px]">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <select 
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="w-full pl-9 pr-8 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm font-medium text-gray-700 shadow-sm appearance-none cursor-pointer"
              aria-label="Filter by Date Range"
            >
              <option value="Today">Today</option>
              <option value="This Week">This Week</option>
              <option value="This Month">This Month</option>
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="space-y-6 animate-pulse">
          {/* Summary Cards Skeleton */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm col-span-1 h-[104px] flex flex-col">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 bg-gray-200 rounded-lg"></div>
                  <div className="h-4 bg-gray-200 rounded w-20"></div>
                </div>
                <div className="h-8 bg-gray-200 rounded w-12 mt-auto"></div>
              </div>
            ))}
          </div>
          {/* Charts Skeleton */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 h-[340px]">
              <div className="h-6 bg-gray-200 rounded w-40 mb-6"></div>
              <div className="h-64 bg-gray-100 rounded"></div>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 h-[340px]">
              <div className="h-6 bg-gray-200 rounded w-40 mb-6"></div>
              <div className="h-64 bg-gray-100 rounded-full mx-auto w-64"></div>
            </div>
          </div>
          {/* Table Skeleton */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm h-64 p-6 mt-6">
             <div className="h-6 bg-gray-200 rounded w-32 mb-6"></div>
             <div className="space-y-4">
               {[1, 2, 3, 4].map(i => (
                 <div key={i} className="h-4 bg-gray-100 rounded w-full"></div>
               ))}
             </div>
          </div>
        </div>
      ) : dataset.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
          <div className="mx-auto w-16 h-16 bg-gray-50 text-gray-400 rounded-full flex items-center justify-center mb-4">
            <Inbox className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-gray-800 mb-1">
            {unfilteredDataset && unfilteredDataset.length === 0 
              ? "No completed clinic sessions yet" 
              : "No reports available for these filters"}
          </h3>
          <p className="text-gray-500 text-sm max-w-sm mx-auto">
            {unfilteredDataset && unfilteredDataset.length === 0 
              ? "Complete a clinic session to start viewing analytics and historical reports."
              : "Try adjusting your branch or date range to see more results."}
          </p>
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col col-span-2 md:col-span-1 lg:col-span-1">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-blue-50 rounded-lg">
                  <Users className="w-5 h-5 text-blue-600" />
                </div>
                <span className="text-sm font-semibold text-gray-600">Total Reservations</span>
              </div>
              <div className="text-3xl font-bold text-gray-800 mt-auto">{aggregated.totalReservations}</div>
            </div>
            
            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col col-span-1 md:col-span-1 lg:col-span-1">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-green-50 rounded-lg">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                </div>
                <span className="text-sm font-semibold text-gray-600">Checked Up</span>
              </div>
              <div className="text-3xl font-bold text-gray-800 mt-auto">{aggregated.checkedUp}</div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col col-span-1 md:col-span-1 lg:col-span-1">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-red-50 rounded-lg">
                  <XCircle className="w-5 h-5 text-red-600" />
                </div>
                <span className="text-sm font-semibold text-gray-600">Cancelled</span>
              </div>
              <div className="text-3xl font-bold text-gray-800 mt-auto">{aggregated.cancelled}</div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col col-span-1 md:col-span-1 lg:col-span-1">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-orange-50 rounded-lg">
                  <AlertCircle className="w-5 h-5 text-orange-600" />
                </div>
                <span className="text-sm font-semibold text-gray-600">Forfeited</span>
              </div>
              <div className="text-3xl font-bold text-gray-800 mt-auto">{aggregated.forfeited}</div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col col-span-1 md:col-span-2 lg:col-span-1">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-purple-50 rounded-lg">
                  <Activity className="w-5 h-5 text-purple-600" />
                </div>
                <span className="text-sm font-semibold text-gray-600">Completion Rate</span>
              </div>
              <div className="text-3xl font-bold text-gray-800 mt-auto">{completionRate}%</div>
            </div>
          </div>

          {/* Charts Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
            {/* Reservation Trend Chart */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <h3 className="text-lg font-bold text-gray-800 mb-6">Reservation Trend</h3>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
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
                    <Line 
                      type="monotone" 
                      dataKey="reservations" 
                      name="Reservations"
                      stroke="#2563eb" 
                      strokeWidth={3}
                      dot={{ r: 4, strokeWidth: 2 }}
                      activeDot={{ r: 6, strokeWidth: 0 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Outcome Distribution Chart */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <h3 className="text-lg font-bold text-gray-800 mb-6">Outcome Distribution</h3>
              <div className="h-72 w-full">
                {outcomeData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <RePieChart>
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
                    </RePieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-400">
                    No outcome data to display
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Session History Table */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mt-6">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
              <h3 className="text-lg font-bold text-gray-800">Session History</h3>
            </div>
            {paginatedDataset.length === 0 ? (
              <div className="p-8 text-center text-gray-500 text-sm">
                No completed clinic sessions match the selected filters.
              </div>
            ) : (
              <>
                {/* Desktop/Tablet Table View */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                        <th className="p-4 font-semibold">Clinic Date</th>
                        <th className="p-4 font-semibold">Branch</th>
                        <th className="p-4 font-semibold text-center">Total</th>
                        <th className="p-4 font-semibold text-center">Checked Up</th>
                        <th className="p-4 font-semibold text-center">Cancelled</th>
                        <th className="p-4 font-semibold text-center">Forfeited</th>
                        <th className="p-4 font-semibold text-center">Completion</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-sm">
                      {paginatedDataset.map((session) => (
                        <tr key={session.id} className="hover:bg-gray-50 transition-colors">
                          <td className="p-4 text-gray-800 font-medium whitespace-nowrap">
                            {formatDate(session.clinicDate)}
                            <div className="text-xs text-gray-500 font-normal mt-0.5">
                              {session.openingTime} - {session.closingTime}
                            </div>
                          </td>
                          <td className="p-4 text-gray-600 whitespace-nowrap">{session.branch}</td>
                          <td className="p-4 text-center font-medium text-gray-800">{session.metrics.totalReservations}</td>
                          <td className="p-4 text-center font-medium text-green-600">{session.metrics.checkedUp}</td>
                          <td className="p-4 text-center font-medium text-red-600">{session.metrics.cancelled}</td>
                          <td className="p-4 text-center font-medium text-orange-600">{session.metrics.forfeited}</td>
                          <td className="p-4 text-center font-bold text-purple-600">{(session.metrics.completionRate || 0).toFixed(1)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Card View */}
                <div className="block md:hidden divide-y divide-gray-100">
                  {paginatedDataset.map((session) => (
                    <div key={session.id} className="p-4 space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-bold text-gray-800">{formatDate(session.clinicDate)}</div>
                          <div className="text-xs text-gray-500">{session.openingTime} - {session.closingTime}</div>
                        </div>
                        <div className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-1 rounded-full">{session.branch}</div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm bg-gray-50 p-3 rounded-xl">
                        <div className="flex flex-col">
                          <span className="text-gray-500 text-xs">Total</span>
                          <span className="font-medium text-gray-800">{session.metrics.totalReservations}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-gray-500 text-xs">Completion</span>
                          <span className="font-bold text-purple-600">{(session.metrics.completionRate || 0).toFixed(1)}%</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-gray-500 text-xs">Checked Up</span>
                          <span className="font-medium text-green-600">{session.metrics.checkedUp}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-gray-500 text-xs">Cancelled/Forfeited</span>
                          <span className="font-medium text-gray-800">
                            <span className="text-red-600">{session.metrics.cancelled}</span> / <span className="text-orange-600">{session.metrics.forfeited}</span>
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
            
            {/* Pagination */}
            {totalPages > 1 && (
              <div className="p-4 border-t border-gray-100 flex items-center justify-between bg-gray-50/50">
                <span className="text-sm text-gray-500">
                  Showing <span className="font-medium text-gray-700">{(currentPage - 1) * itemsPerPage + 1}</span> to <span className="font-medium text-gray-700">{Math.min(currentPage * itemsPerPage, sortedDataset.length)}</span> of <span className="font-medium text-gray-700">{sortedDataset.length}</span> sessions
                </span>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-1.5 rounded-lg border border-gray-200 bg-white text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button 
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="p-1.5 rounded-lg border border-gray-200 bg-white text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
