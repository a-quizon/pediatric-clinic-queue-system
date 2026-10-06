import { useState, useEffect } from "react";
import { subscribeToAllReservations } from "../../services/reservationService";
import { getBranchConfigurations } from "../../services/branchConfigurationService";
import StaffScheduleCalendar from "./StaffScheduleCalendar";
import { useAuth } from "../../hooks/useAuth";
import { useTourSample } from "../../hooks/useTourPreview";
import { scheduleMatchesAssignedBranch } from "../../utils/stringUtils";
import { TourSampleSchedulePublish } from "../onboarding/SecretaryTourSampleViews";
import { getDb } from "../../firebase/database";
import { ref, query, orderByChild, startAt, endAt, get } from "firebase/database";
import { manilaMonthMeta, shiftMonth, manilaDateString } from "../../utils/manilaDate";

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
  const [isLoading, setIsLoading] = useState(false);
  const [monthCache, setMonthCache] = useState({});
  const [currentCursor, setCurrentCursor] = useState(() => {
    const [year, month] = manilaDateString().split("-").map(Number);
    return { year, monthIndex: month - 1 };
  });

  const lockBranch = user?.role === "secretary";

  useEffect(() => {
    const unsub = subscribeToAllReservations((data) => {
      setReservations(data);
    });
    getBranchConfigurations().then(setBranches);
    return () => unsub();
  }, []);

  const loadMonthSchedules = async (year, monthIndex, force = false) => {
    const key = `${year}-${monthIndex}`;
    if (!force && monthCache[key]) return;

    setIsLoading(true);
    try {
      const monthMeta = manilaMonthMeta(year, monthIndex);
      const nextMonth = shiftMonth(year, monthIndex, 1);
      const nextMeta = manilaMonthMeta(nextMonth.year, nextMonth.monthIndex);

      const q = query(
        ref(getDb(), "schedules"),
        orderByChild("clinicDate"),
        startAt(monthMeta.first),
        endAt(nextMeta.last)
      );

      const snapshot = await get(q);
      const data = snapshot.exists() ? snapshot.val() : {};

      setMonthCache(prev => ({ ...prev, [key]: true, [`${nextMonth.year}-${nextMonth.monthIndex}`]: true }));

      setSchedules(prev => {
        const existingMap = new Map(prev.map(s => [s.id, s]));
        Object.entries(data).forEach(([id, value]) => {
          existingMap.set(id, { id, ...value });
        });
        let arr = Array.from(existingMap.values());
        if (lockBranch && user) {
          arr = arr.filter((s) => scheduleMatchesAssignedBranch(s, user));
        }
        return arr;
      });
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadMonthSchedules(currentCursor.year, currentCursor.monthIndex);
  }, [currentCursor.year, currentCursor.monthIndex, lockBranch, user?.assignedBranch, user?.assignedBranchId]);

  const handleRefresh = async () => {
    await loadMonthSchedules(currentCursor.year, currentCursor.monthIndex, true);
  };

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
        onChanged={handleRefresh}
        queuePath={queuePath}
        isLoading={isLoading}
        onMonthChange={setCurrentCursor}
      />
    </div>
  );
}
