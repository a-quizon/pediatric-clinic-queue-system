import { database } from "../firebase/database";
import { ref, push, set, get, update, remove, onValue } from "firebase/database";
import { getReservationsBySchedule } from "./reservationService";

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

export const getScheduleById = async (scheduleId) => {
  const snapshot = await get(ref(database, `schedules/${scheduleId}`));
  if (snapshot.exists()) {
    return { id: snapshot.key, ...snapshot.val() };
  }
  return null;
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
  await update( ref(database, `schedules/${scheduleId}`), {
    status: "published", 
    queueStatus: "not_started", // Default queue status when published
    isReady: false,
    publishedAt: Date.now(),
  });
};

export const moveToReady = async ( scheduleId ) => {
  await update( ref(database, `schedules/${scheduleId}`), {
    isReady: true,
    movedToReadyAt: Date.now(),
  });
};

export const updateQueueStatus = async (scheduleId, queueStatus) => {
  await update(ref(database, `schedules/${scheduleId}`), {
    queueStatus,
    [`queueStatusUpdatedAt`]: Date.now()
  });
};

export const completeSchedule = async ( scheduleId ) => {
  const now = Date.now();
  await update( ref(database, `schedules/${scheduleId}`), {
    status: "completed", 
    completedAt: now,
    scheduleCompletedAt: now
  });

  const reservations = await getReservationsBySchedule(scheduleId);
  const updates = {};
  reservations.forEach(res => {
    if (res.status !== "cancelled" && res.status !== "completed") {
      updates[`reservations/${res.id}/status`] = "completed";
      updates[`reservations/${res.id}/completedAt`] = now;
    }
  });

  if (Object.keys(updates).length > 0) {
    await update(ref(database), updates);
  }
};

export const subscribeToPublishedSchedules = ( callback ) => {
  const schedulesRef = ref( database, "schedules" );
  return onValue( schedulesRef, (snapshot) => {
      if (!snapshot.exists()) {
        callback([]);
        return;
      }

      const data = snapshot.val();

      const schedules = Object.entries(data).map(([id, value]) => ({ id, ...value,})).filter((schedule) => schedule.status === "published");
      callback(schedules);
    }
  );
};