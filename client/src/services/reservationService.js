import { database } from "../firebase/database";
import { ref, push, set, get, onValue, remove } from "firebase/database";

export const createReservation = async (reservationData) => {
  const reservationRef = push(ref(database, "reservations"));
  await set(reservationRef, {
    ...reservationData,
    createdAt: Date.now(),
  });
  return reservationRef.key;
};

export const getReservationsBySchedule = async (scheduleId) => {
  const snapshot = await get(ref(database, "reservations"));
  if (!snapshot.exists()) return [];

  const data = snapshot.val();
  return Object.entries(data)
    .map(([id, value]) => ({ id, ...value }))
    .filter((res) => res.scheduleId === scheduleId);
};

export const checkExistingReservation = async (scheduleId, parentId) => {
  const reservations = await getReservationsBySchedule(scheduleId);
  return reservations.some((res) => res.parentId === parentId && res.status !== "cancelled" && res.status !== "completed");
};

export const checkExistingGlobalReservation = async (parentId) => {
  const snapshot = await get(ref(database, "reservations"));
  if (!snapshot.exists()) return false;

  const data = snapshot.val();
  return Object.values(data).some((res) => res.parentId === parentId && res.status !== "cancelled" && res.status !== "completed");
};

export const generateQueueNumber = async (scheduleId) => {
  const reservations = await getReservationsBySchedule(scheduleId);
  return reservations.length + 1;
};

export const subscribeToAllReservations = (callback) => {
  const reservationsRef = ref(database, "reservations");
  return onValue(reservationsRef, (snapshot) => {
    if (!snapshot.exists()) {
      callback([]);
      return;
    }

    const data = snapshot.val();
    const reservations = Object.entries(data).map(([id, value]) => ({ id, ...value }));
    callback(reservations);
  });
};

export const cancelReservation = async (reservationId) => {
  await remove(ref(database, `reservations/${reservationId}`));
};
