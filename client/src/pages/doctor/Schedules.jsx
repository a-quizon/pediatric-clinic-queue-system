import ScheduleManagement from "../../components/schedule/ScheduleManagement";

export default function Schedules() {
  return (
    <div className="space-y-6 pb-6">
      <ScheduleManagement queuePath="/doctor/queue" />
    </div>
  );
}
