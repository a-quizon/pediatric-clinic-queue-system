import { BarChart3, TrendingUp, Users, Clock, AlertCircle, PieChart, Activity, Settings } from "lucide-react";

export default function Reports() {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 ease-out pb-6">
      {/* Header */}
      <div className="bg-white rounded-3xl p-6 md:p-8 shadow-[0_4px_24px_rgba(0,0,0,0.02)] border border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-5">
          <div className="bg-violet-50 p-4 rounded-2xl shadow-sm border border-violet-100/50">
            <BarChart3 className="w-8 h-8 text-violet-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Reports & Analytics</h1>
            <p className="text-slate-500 font-medium mt-1">
              View clinic statistics and performance metrics.
            </p>
          </div>
        </div>
        <div className="hidden md:flex items-center justify-center px-4 py-2 bg-slate-50 text-slate-500 font-medium rounded-xl border border-slate-200 shadow-sm">
           <span className="mr-2">🚧</span> Under Construction
        </div>
      </div>

      {/* Analytics Dashboard Placeholder */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 opacity-60 pointer-events-none select-none">
        {[
          { label: "Total Patients", value: "0", icon: Users, color: "blue" },
          { label: "Completed Consults", value: "0", icon: TrendingUp, color: "emerald" },
          { label: "Avg Wait Time", value: "--:--", icon: Clock, color: "amber" },
          { label: "Forfeitures", value: "0", icon: AlertCircle, color: "red" },
        ].map((stat, idx) => (
          <div key={idx} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm relative overflow-hidden">
            <div className={`absolute -right-4 -top-4 w-16 h-16 rounded-full bg-${stat.color}-50`}></div>
            <div className="flex items-center justify-between mb-4">
              <span className="font-medium text-slate-500">{stat.label}</span>
              <stat.icon className={`w-5 h-5 text-${stat.color}-500 relative z-10`} />
            </div>
            <p className="text-3xl font-bold text-slate-800">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 opacity-60 pointer-events-none select-none">
        {/* Chart 1 Placeholder */}
        <div className="lg:col-span-2 bg-white rounded-3xl p-6 border border-slate-100 shadow-sm min-h-[300px] flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-slate-700">Patient Volume</h3>
            <Activity className="w-5 h-5 text-slate-400" />
          </div>
          <div className="flex-1 border-b-2 border-l-2 border-slate-100 relative flex items-end justify-between px-4 pb-2 pt-10">
            {/* Mock Chart Bars */}
            {[40, 70, 30, 80, 50, 90, 60].map((h, i) => (
              <div key={i} className="w-1/12 bg-violet-100 rounded-t-sm" style={{ height: `${h}%` }}></div>
            ))}
          </div>
        </div>

        {/* Chart 2 Placeholder */}
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm min-h-[300px] flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-slate-700">Demographics</h3>
            <PieChart className="w-5 h-5 text-slate-400" />
          </div>
          <div className="flex-1 flex items-center justify-center">
            <div className="w-32 h-32 rounded-full border-8 border-slate-100 border-t-violet-200 border-r-blue-200 border-b-emerald-200"></div>
          </div>
        </div>
      </div>

      {/* Development Banner Overlay */}
      <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center space-x-4 max-w-sm w-full z-50 animate-in slide-in-from-bottom-10 fade-in duration-500">
        <div className="bg-amber-500/20 p-2 rounded-xl border border-amber-500/30">
          <span className="text-xl">🚧</span>
        </div>
        <div>
          <h4 className="font-bold text-sm">Reports Coming Soon</h4>
          <p className="text-xs text-slate-300">Analytics are currently under development.</p>
        </div>
      </div>
    </div>
  );
}
