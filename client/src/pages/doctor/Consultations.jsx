import { Stethoscope, ClipboardList, CheckCircle, Activity, PlayCircle, Settings } from "lucide-react";

export default function Consultations() {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 ease-out pb-6">
      {/* Header */}
      <div className="bg-white rounded-3xl p-6 md:p-8 shadow-[0_4px_24px_rgba(0,0,0,0.02)] border border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-5">
          <div className="bg-indigo-50 p-4 rounded-2xl shadow-sm border border-indigo-100/50">
            <Stethoscope className="w-8 h-8 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Consultations</h1>
            <p className="text-slate-500 font-medium mt-1">
              Review patient concerns and conduct medical sessions.
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
        <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-indigo-50/50 to-white"></div>
        <div className="absolute top-10 left-10 w-32 h-32 bg-indigo-100 rounded-full blur-3xl opacity-50"></div>
        <div className="absolute top-20 right-20 w-40 h-40 bg-blue-100 rounded-full blur-3xl opacity-40"></div>
        
        <div className="relative p-8 md:p-12 text-center">
          <div className="mx-auto w-24 h-24 bg-white shadow-xl shadow-indigo-100 rounded-full flex items-center justify-center mb-6 border border-indigo-50">
            <span className="text-4xl filter drop-shadow-md">🚧</span>
          </div>
          
          <h2 className="text-2xl font-bold text-slate-800 mb-3">Feature Under Development</h2>
          <p className="text-slate-500 mb-10 max-w-lg mx-auto leading-relaxed">
            The consultation module is currently being built to help you manage patient encounters efficiently. It will be available in a future update.
          </p>

          <div className="bg-slate-50 rounded-2xl p-6 md:p-8 text-left border border-slate-100 max-w-2xl mx-auto shadow-inner">
            <h3 className="font-bold text-slate-800 mb-6 flex items-center text-lg">
              <Activity className="w-6 h-6 mr-3 text-indigo-500 bg-indigo-100 rounded-lg p-1" />
              Future Features:
            </h3>
            <div className="grid grid-cols-1 gap-4">
              {[
                { label: "View Patient Concerns & Medical History", icon: ClipboardList, color: "blue" },
                { label: "Start Live Consultation Session", icon: PlayCircle, color: "indigo" },
                { label: "Complete Consultation & Add Notes", icon: CheckCircle, color: "emerald" },
              ].map((feature, idx) => (
                <div key={idx} className="flex items-center bg-white p-5 rounded-xl border border-slate-100 shadow-sm group hover:border-indigo-200 hover:shadow-md transition-all duration-300">
                  <div className={`bg-${feature.color}-50 p-3 rounded-xl mr-4 group-hover:scale-110 transition-transform duration-300`}>
                     <feature.icon className={`w-6 h-6 text-${feature.color}-500`} />
                  </div>
                  <span className="font-medium text-slate-700 text-lg">{feature.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
