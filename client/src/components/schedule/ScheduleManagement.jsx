import { useState, useEffect } from "react";
import { getSchedules } from "../../services/scheduleService";
import { subscribeToAllReservations } from "../../services/reservationService";
import { getBranchConfigurations } from "../../services/branchConfigurationService";
import StaffScheduleCalendar from "./StaffScheduleCalendar";
import { useAuth } from "../../hooks/useAuth";
import { useTourSample } from "../../hooks/useTourPreview";
import { scheduleMatchesAssignedBranch } from "../../utils/stringUtils";
import { TourSampleSchedulePublish } from "../onboarding/SecretaryTourSampleViews";

/**
 * Shared schedule calendar for Secretary and Doctor.
 * A secretary only sees their assigned branch.
 */
export default function ScheduleManagement({
  queuePath = "/secretary/queue",
}) {
  const { user } = useAuth();
  const showSecretaryScheduleSample = useTourSample(["schedule-publish", "schedule-form"]);
  const showDoctorScheduleSample = useTourSample(["doctor-schedule-publish", "doctor-schedule-form"]);
  const showScheduleSample = showSecretaryScheduleSample || showDoctorScheduleSample;
  const [schedules, setSchedules] = useState([]);
  const [branches, setBranches] = useState([]);
  const [reservations, setReservations] = useState([]);

  const lockBranch = user?.role === "secretary";

  useEffect(() => {
    const unsub = subscribeToAllReservations((data) => {
      setReservations(data);
    });
    getBranchConfigurations().then(setBranches);
    return () => unsub();
  }, []);

  const loadSchedules = async () => {
    try {
      const data = await getSchedules();
      if (!data) {
        setSchedules([]);
        return;
      }
      let scheduleArray = Object.entries(data).map(([id, value]) => ({
        id,
        ...value,
      }));
      if (lockBranch && user) {
        scheduleArray = scheduleArray.filter((schedule) => scheduleMatchesAssignedBranch(schedule, user));
      }
      setSchedules(scheduleArray);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    loadSchedules();
  }, [user?.assignedBranch, user?.assignedBranchId, lockBranch]);

  if (showScheduleSample) {
    return (
      <TourSampleSchedulePublish
        showForm
        lockBranch={lockBranch || showSecretaryScheduleSample}
        publishTourId={showDoctorScheduleSample ? "doctor-schedule-publish" : "schedule-publish"}
        formTourId={showDoctorScheduleSample ? "doctor-schedule-form" : "schedule-form"}
      />
    );
  }

  return (
    <div className="w-full pb-20 pt-2">
      <StaffScheduleCalendar
        branches={branches}
        schedules={schedules}
        reservations={reservations}
        lockBranch={lockBranch}
        onChanged={loadSchedules}
        queuePath={queuePath}
      />
    </div>
  );
}
