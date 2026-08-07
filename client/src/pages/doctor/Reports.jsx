import React, { useState, useEffect } from "react";
import { BarChart3, TrendingUp, Users, Clock, AlertCircle, PieChart, Activity, CheckCircle, XCircle, Calendar, MapPin, Inbox, Loader2 } from "lucide-react";
import { useReportsData } from "../../hooks/useReportsData";
import { getBranchConfigurations } from "../../services/branchConfigurationService";

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

  return (
    <div className="space-y-6 pb-6 relative">
      
      {/* Header and Filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Reports & Analytics</h1>
          <p className="text-gray-500 text-sm mt-1">Overview of your clinic performance</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
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
      </div>

      {/* Summary Section */}
      {dataset.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
          <div className="mx-auto w-16 h-16 bg-gray-50 text-gray-400 rounded-full flex items-center justify-center mb-4">
            <Inbox className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-gray-800 mb-1">No reports available</h3>
          <p className="text-gray-500 text-sm">Complete a clinic session to generate analytics.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col col-span-2 sm:col-span-1">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-blue-50 rounded-lg">
                <Users className="w-5 h-5 text-blue-600" />
              </div>
              <span className="text-sm font-semibold text-gray-600">Total Reservations</span>
            </div>
            <div className="text-3xl font-bold text-gray-800 mt-auto">{aggregated.totalReservations}</div>
          </div>
          
          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col col-span-2 sm:col-span-1">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-green-50 rounded-lg">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <span className="text-sm font-semibold text-gray-600">Checked Up</span>
            </div>
            <div className="text-3xl font-bold text-gray-800 mt-auto">{aggregated.checkedUp}</div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col col-span-2 sm:col-span-1">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-purple-50 rounded-lg">
                <Activity className="w-5 h-5 text-purple-600" />
              </div>
              <span className="text-sm font-semibold text-gray-600">Completion Rate</span>
            </div>
            <div className="text-3xl font-bold text-gray-800 mt-auto">{completionRate}%</div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col col-span-1 sm:col-span-1">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-red-50 rounded-lg">
                <XCircle className="w-5 h-5 text-red-600" />
              </div>
              <span className="text-sm font-semibold text-gray-600">Cancelled</span>
            </div>
            <div className="text-3xl font-bold text-gray-800 mt-auto">{aggregated.cancelled}</div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col col-span-1 sm:col-span-1">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-orange-50 rounded-lg">
                <AlertCircle className="w-5 h-5 text-orange-600" />
              </div>
              <span className="text-sm font-semibold text-gray-600">Forfeited</span>
            </div>
            <div className="text-3xl font-bold text-gray-800 mt-auto">{aggregated.forfeited}</div>
          </div>
        </div>
      )}

      {/* Coming Soon Card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mt-6">
        <div className="p-8 md:p-12 text-center">
          <div className="mx-auto w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-6">
            <span className="text-2xl">🚧</span>
          </div>
          
          <h2 className="text-xl font-bold text-gray-800 mb-2">Feature Under Development</h2>
          <p className="text-gray-500 mb-10 max-w-lg mx-auto text-sm">
            Analytics are currently being built to provide insights into your clinic operations.
          </p>

          <div className="bg-gray-50 rounded-2xl p-6 md:p-8 text-left border border-gray-100 max-w-2xl mx-auto">
            <h3 className="font-bold text-gray-800 mb-4 flex items-center text-[15px]">
              <Activity className="w-5 h-5 mr-2 text-blue-600" />
              Future Analytics Features
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { label: "Total Patient Volume", icon: Users },
                { label: "Consultation Trends", icon: TrendingUp },
                { label: "Average Wait Times", icon: Clock },
                { label: "Patient Demographics", icon: PieChart },
                { label: "Forfeiture Rates", icon: AlertCircle },
              ].map((feature, idx) => (
                <div key={idx} className="flex items-center bg-white p-3 rounded-xl border border-gray-100 shadow-sm">
                  <div className="bg-blue-50 p-2 rounded-lg mr-3">
                     <feature.icon className="w-4 h-4 text-blue-600" />
                  </div>
                  <span className="text-sm font-semibold text-gray-700">{feature.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
