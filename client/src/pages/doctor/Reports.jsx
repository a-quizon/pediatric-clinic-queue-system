import React, { useState, useEffect } from "react";
import { BarChart3, TrendingUp, Users, Clock, AlertCircle, PieChart, Activity, CheckCircle, XCircle, Calendar, MapPin, Inbox, Loader2 } from "lucide-react";
import { useReportsData } from "../../hooks/useReportsData";
import { getBranchConfigurations } from "../../services/branchConfigurationService";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart as RePieChart, Pie, Cell, Legend } from 'recharts';

export default function Reports() {
  const { loading, error, dataset, filters } = useReportsData();
  const { branch, setBranch, dateRange, setDateRange } = filters;
  const [branches, setBranches] = useState([]);

  useEffect(() => {
    getBranchConfigurations().then(setBranches);
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-blue-500">
        <Loader2 className="w-10 h-10 animate-spin mb-4" />
        <span className="font-medium">Loading reports...</span>
      </div>
    );
  }
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

  return (
    <div className="space-y-6 pb-6 relative">
      
      {/* Filters Only */}
      <div className="flex justify-end gap-3 mb-6">
        <div className="relative min-w-[180px]">
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <select 
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
            className="w-full pl-9 pr-8 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm font-medium text-gray-700 shadow-sm appearance-none cursor-pointer"
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
          >
            <option value="Today">Today</option>
            <option value="This Week">This Week</option>
            <option value="This Month">This Month</option>
          </select>
        </div>
      </div>

      {dataset.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
          <div className="mx-auto w-16 h-16 bg-gray-50 text-gray-400 rounded-full flex items-center justify-center mb-4">
            <Inbox className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-gray-800 mb-1">No analytics available for the selected filters.</h3>
          <p className="text-gray-500 text-sm">Complete a clinic session to generate analytics.</p>
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
        </>
      )}
    </div>
  );
}
