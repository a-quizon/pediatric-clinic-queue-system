import ScheduleManagement from "./ScheduleManagement";
import { CalendarDays } from "lucide-react";

export default function Schedules() {
  return (
    <div className="space-y-6 pb-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Clinic Schedules</h1>
          <p className="text-gray-500 mt-1">
            Manage your clinic availability, drafts, and active sessions.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 md:p-6">
          <ScheduleManagement />
        </div>
      </div>
    </div>
  );
}
