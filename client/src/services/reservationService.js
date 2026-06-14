import { database } from "../firebase/database";
import { ref, push, set, get, onValue, update } from "firebase/database";

const generateReservationCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

export const createReservation = async (reservationData) => {
  const reservationRef = push(ref(database, "reservations"));
  const now = Date.now();
  await set(reservationRef, {
    ...reservationData,
    reservationCode: generateReservationCode(),
    checkedIn: false,
    createdAt: now,
    reservationCreatedAt: now,
  });
  return reservationRef.key;
};

export const getReservationsBySchedule = async (scheduleId) => {
  const snapshot = await get(ref(database, "reservations"));
  if (!snapshot.exists()) return [];

  const data = snapshot.val();
  const reservations = Object.entries(data)
    .map(([id, value]) => ({ id, ...value }))
    .filter((res) => res.scheduleId === scheduleId);
  return calculateDynamicQueuePositions(reservations);
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

export const calculateDynamicQueuePositions = (reservations) => {
  const groupedBySchedule = {};
  reservations.forEach(r => {
    if (!groupedBySchedule[r.scheduleId]) groupedBySchedule[r.scheduleId] = [];
    groupedBySchedule[r.scheduleId].push(r);
  });
  
  let processedReservations = [];
  const activeStatuses = ["reserved", "checked_in", "waiting"];
  
  Object.values(groupedBySchedule).forEach(scheduleReservations => {
    const active = scheduleReservations.filter(r => activeStatuses.includes(r.status)).sort((a, b) => a.createdAt - b.createdAt);
    const inactive = scheduleReservations.filter(r => !activeStatuses.includes(r.status));
    
    const rankedActive = active.map((r, index) => ({
      ...r,
      queuePosition: index + 1
    }));
    
    processedReservations = [...processedReservations, ...rankedActive, ...inactive];
  });

  return processedReservations;
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
    callback(calculateDynamicQueuePositions(reservations));
  });
};

export const cancelReservation = async (reservationId) => {
  await update(ref(database, `reservations/${reservationId}`), {
    status: "cancelled",
    cancelledAt: Date.now()
  });
};

export const validateReservationByCode = async (code) => {
  const snapshot = await get(ref(database, "reservations"));
  if (!snapshot.exists()) return null;

  const data = snapshot.val();
  const reservations = Object.entries(data).map(([id, value]) => ({ id, ...value }));
  
  const reservation = reservations.find(res => res.reservationCode === code);
  if (!reservation) return null;
  
  const scheduleReservations = reservations.filter(res => res.scheduleId === reservation.scheduleId);
  const rankedReservations = calculateDynamicQueuePositions(scheduleReservations);
  
  return rankedReservations.find(res => res.id === reservation.id);
};

export const checkInReservation = async (reservationId, secretaryUid) => {
  await update(ref(database, `reservations/${reservationId}`), {
    checkedIn: true,
    checkedInAt: Date.now(),
    checkedInBy: secretaryUid,
    status: "checked_in"
  });
};

export const startConsultation = async (reservationId) => {
  await update(ref(database, `reservations/${reservationId}`), {
    status: "in_consultation",
    consultationStartedAt: Date.now()
  });
};

export const completeConsultation = async (reservationId, doctorNotes) => {
  await update(ref(database, `reservations/${reservationId}`), {
    status: "consultation_completed",
    consultationCompletedAt: Date.now(),
    doctorNotes: doctorNotes || ""
  });
};

export const updatePatientInfo = async (reservationId, patientInfo) => {
  await update(ref(database, `reservations/${reservationId}`), {
    ...patientInfo,
    patientInfoCompleted: true
  });
};
