import ScheduleManagement from "./ScheduleManagement";
import { CalendarDays, Settings } from "lucide-react";

export default function Schedules() {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 ease-out pb-6">
      <div className="bg-white rounded-3xl p-6 md:p-8 shadow-[0_4px_24px_rgba(0,0,0,0.02)] border border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-5">
          <div className="bg-blue-50 p-4 rounded-2xl shadow-sm border border-blue-100/50">
            <CalendarDays className="w-8 h-8 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Clinic Schedule Management</h1>
            <p className="text-slate-500 font-medium mt-1">
              Manage clinic schedules, publishing, and session completion.
            </p>
          </div>
        </div>
        <div className="hidden md:flex items-center justify-center w-12 h-12 bg-slate-50 text-slate-400 rounded-xl border border-slate-100 hover:bg-slate-100 transition-colors cursor-pointer">
           <Settings className="w-5 h-5" />
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-[0_4px_24px_rgba(0,0,0,0.02)] border border-slate-100 overflow-hidden">
        <div className="p-2 md:p-4">
          <ScheduleManagement />
        </div>
      </div>
    </div>
  );
}
