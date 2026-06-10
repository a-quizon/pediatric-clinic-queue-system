import { Users, Play, Pause, Square, Activity, ArrowRight, Settings } from "lucide-react";

export default function Queue() {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 ease-out pb-6">
      {/* Header */}
      <div className="bg-white rounded-3xl p-6 md:p-8 shadow-[0_4px_24px_rgba(0,0,0,0.02)] border border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-5">
          <div className="bg-emerald-50 p-4 rounded-2xl shadow-sm border border-emerald-100/50">
            <Users className="w-8 h-8 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Queue Management</h1>
            <p className="text-slate-500 font-medium mt-1">
              Monitor and control patient flow in real-time.
            </p>
          </div>
        </div>
        <div className="hidden md:flex items-center justify-center w-12 h-12 bg-slate-50 text-slate-400 rounded-xl border border-slate-100 hover:bg-slate-100 transition-colors cursor-pointer">
           <Settings className="w-5 h-5" />
        </div>
      </div>

      {/* Coming Soon Card */}
      <div className="bg-white rounded-3xl shadow-[0_4px_24px_rgba(0,0,0,0.02)] border border-slate-100 overflow-hidden relative">
        {/* Decorative Background */}
        <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-slate-50 to-white"></div>
        <div className="absolute top-10 left-10 w-32 h-32 bg-emerald-100 rounded-full blur-3xl opacity-50"></div>
        <div className="absolute top-10 right-10 w-32 h-32 bg-blue-100 rounded-full blur-3xl opacity-50"></div>
        
        <div className="relative p-8 md:p-12 text-center">
          <div className="mx-auto w-24 h-24 bg-white shadow-xl shadow-slate-200/50 rounded-full flex items-center justify-center mb-6 border border-slate-50">
            <span className="text-4xl filter drop-shadow-md">🚧</span>
          </div>
          
          <h2 className="text-2xl font-bold text-slate-800 mb-3">Feature Under Development</h2>
          <p className="text-slate-500 mb-10 max-w-lg mx-auto leading-relaxed">
            This module is currently being developed to provide a seamless queuing experience. It will be available in a future update.
          </p>

          <div className="bg-slate-50 rounded-2xl p-6 md:p-8 text-left border border-slate-100 max-w-2xl mx-auto shadow-inner">
            <h3 className="font-bold text-slate-800 mb-6 flex items-center text-lg">
              <Activity className="w-6 h-6 mr-3 text-emerald-500 bg-emerald-100 rounded-lg p-1" />
              Future Features:
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { label: "Start Queue", icon: Play },
                { label: "Pause Queue", icon: Pause },
                { label: "Resume Queue", icon: Play },
                { label: "End Queue", icon: Square },
                { label: "Monitor Queue Status", icon: Users },
              ].map((feature, idx) => (
                <div key={idx} className="flex items-center bg-white p-4 rounded-xl border border-slate-100 shadow-sm group hover:border-emerald-200 transition-colors">
                  <div className="bg-slate-50 p-2 rounded-lg mr-3 group-hover:bg-emerald-50 transition-colors">
                     <feature.icon className="w-5 h-5 text-slate-400 group-hover:text-emerald-500 transition-colors" />
                  </div>
                  <span className="font-medium text-slate-700">{feature.label}</span>
                </div>
              ))}
            </div>
            
            <div className="mt-8 text-center md:text-right">
              <button disabled className="inline-flex items-center px-6 py-3 bg-slate-200 text-slate-400 font-semibold rounded-xl cursor-not-allowed">
                Learn More <ArrowRight className="w-4 h-4 ml-2" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
