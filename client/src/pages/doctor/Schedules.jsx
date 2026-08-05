import ScheduleManagement from "./ScheduleManagement";
import { CalendarDays } from "lucide-react";

export default function Schedules() {
  return (
    <div className="space-y-6 pb-6">


      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 md:p-6">
          <ScheduleManagement />
        </div>
      </div>
    </div>
  );
}
