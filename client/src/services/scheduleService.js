import { database } from "../firebase/database";
import { ref, push, set, get, update, remove } from "firebase/database";

export const createSchedule = async ( scheduleData ) => {
  const scheduleRef = push(ref(database, "schedules"));

  await set(scheduleRef, scheduleData);

  return scheduleRef.key;
};

export const getSchedules = async () => {
  const snapshot = await get(
    ref(database, "schedules")
  );

  if (snapshot.exists()) {
    return snapshot.val();
  }

  return {};
};

export const scheduleExists = async ( branch, clinicDate ) => {
  const snapshot = await get( ref(database, "schedules") );

  if (!snapshot.exists()) { return false; }

  const schedules = snapshot.val();

  return Object.values(schedules).some( (schedule) => schedule.branch === branch && schedule.clinicDate === clinicDate);
};

export const updateSchedule = async ( scheduleId, updatedData ) => {
  const snapshot = await get(ref(database, `schedules/${scheduleId}`));
  if (snapshot.exists()) {
    const currentSchedule = snapshot.val();
    if (currentSchedule.status === "published") {
      delete updatedData.branch;
      delete updatedData.clinicDate;
    }
  }
  await update(ref(database,`schedules/${scheduleId}`), updatedData);
};

export const deleteSchedule = async (scheduleId) => {
  await remove(ref(database,`schedules/${scheduleId}`));
};

export const publishSchedule = async ( scheduleId ) => {
  await update( ref(database, `schedules/${scheduleId}`), {status: "published", publishedAt: Date.now(),});
};

export const completeSchedule = async ( scheduleId ) => {
  await update( ref(database, `schedules/${scheduleId}`), {status: "completed", completedAt: Date.now(),});
};