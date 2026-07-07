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

export const checkExistingReservationOnDate = async (parentId, clinicDate) => {
  const [resSnapshot, schedSnapshot] = await Promise.all([
    get(ref(database, "reservations")),
    get(ref(database, "schedules"))
  ]);
  
  if (!resSnapshot.exists() || !schedSnapshot.exists()) return false;

  const reservations = resSnapshot.val();
  const schedules = schedSnapshot.val();

  // Find schedule IDs that match the target clinicDate
  const targetScheduleIds = Object.entries(schedules)
    .filter(([_, schedule]) => schedule.clinicDate === clinicDate)
    .map(([id]) => id);

  // Check if there are any active reservations belonging to those schedules
  return Object.values(reservations).some((res) => 
    res.parentId === parentId && 
    targetScheduleIds.includes(res.scheduleId) &&
    !["cancelled", "completed", "consultation_completed", "expired", "validation_expired", "forfeited", "penalized"].includes(res.status)
  );
};

export const expireReservation = async (reservationId) => {
  const resRef = ref(database, `reservations/${reservationId}`);
  const snap = await get(resRef);
  if (!snap.exists()) return;
  const val = snap.val();
  
  // Only expire if currently awaiting arrival ('reserved' or 'waiting')
  if (val.status === "reserved" || val.status === "waiting") {
    const now = Date.now();
    await update(resRef, {
      status: "expired",
      expiredAt: now,
      // FUTURE-PROOFING: In Phase 2, when Validation Expired occurs, increment lateCount here:
      // lateCount: (val.lateCount || 0) + 1
    });
  }
};

export const checkCompletedConsultationOnDate = async (parentId, clinicDate, doctorId = null) => {
  const [resSnapshot, schedSnapshot] = await Promise.all([
    get(ref(database, "reservations")),
    get(ref(database, "schedules"))
  ]);
  
  if (!resSnapshot.exists() || !schedSnapshot.exists()) return false;

  const reservations = resSnapshot.val();
  const schedules = schedSnapshot.val();

  // Find schedule IDs that match the target clinicDate (and doctorId if specified)
  const targetScheduleIds = Object.entries(schedules)
    .filter(([_, schedule]) => {
      if (schedule.clinicDate !== clinicDate) return false;
      if (doctorId && schedule.doctorId && schedule.doctorId !== doctorId) return false;
      return true;
    })
    .map(([id]) => id);

  // Check if there are any completed consultations belonging to those schedules
  return Object.values(reservations).some((res) => 
    res.parentId === parentId && 
    targetScheduleIds.includes(res.scheduleId) &&
    (res.status === "completed" || res.status === "consultation_completed")
  );
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
