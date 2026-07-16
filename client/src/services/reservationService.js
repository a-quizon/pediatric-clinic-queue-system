import { database } from "../firebase/database";
import { ref, push, set, get, onValue, update } from "firebase/database";
import { recalculateRollingValidation } from "./rollingValidationService";
import { recalculateEntireQueue, enrichReservationsWithState } from "./queueEngine";

const generateReservationCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

export const createReservation = async (reservationData) => {
  const existingSnapshot = await get(ref(database, "reservations"));
  let nextQueueNumber = 1;
  if (existingSnapshot.exists()) {
    const allRes = Object.values(existingSnapshot.val());
    const scheduleRes = allRes.filter(r => r.scheduleId === reservationData.scheduleId);
    const maxNum = scheduleRes.reduce((max, r) => Math.max(max, Number(r.queueNumber || r.originalQueueNumber || r.queuePosition || 0)), 0);
    nextQueueNumber = maxNum + 1;
  }

  const reservationRef = push(ref(database, "reservations"));
  const now = Date.now();
  await set(reservationRef, {
    ...reservationData,
    reservationCode: generateReservationCode(),
    queueNumber: nextQueueNumber,
    originalQueueNumber: nextQueueNumber,
    queuePosition: nextQueueNumber,
    checkedIn: false,
    createdAt: now,
    reservationCreatedAt: now,
  });
  if (reservationData.scheduleId) {
    await recalculateRollingValidation(reservationData.scheduleId);
    await recalculateEntireQueue(reservationData.scheduleId);
  }
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
  const inactiveStatuses = ["cancelled", "completed", "consultation_completed", "expired", "validation_expired", "forfeited", "penalized", "late_limit_reached"];
  return reservations.some((res) => res.parentId === parentId && !inactiveStatuses.includes(res.status));
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
    !["cancelled", "completed", "consultation_completed", "expired", "validation_expired", "forfeited", "penalized", "late_limit_reached"].includes(res.status)
  );
};

export const expireReservation = async (reservationId) => {
  const resRef = ref(database, `reservations/${reservationId}`);
  const snap = await get(resRef);
  if (!snap.exists()) return;
  const val = snap.val();
  
  // Only expire if currently whose validation window is open or awaiting arrival ('reserved', 'waiting', 'validation_open')
  if (val.status === "reserved" || val.status === "waiting" || val.status === "validation_open") {
    const now = Date.now();
    await update(resRef, {
      status: "expired",
      expiredAt: now,
      // FUTURE-PROOFING: In Phase 2, when Validation Expired occurs, increment lateCount here:
      // lateCount: (val.lateCount || 0) + 1
    });
    if (val.scheduleId) {
      await recalculateRollingValidation(val.scheduleId);
      await recalculateEntireQueue(val.scheduleId);
    }
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

// list of active reservation statuses na nag-ooccupy pa ng slot at nasa queue
export const ACTIVE_RESERVATION_STATUSES = ["reserved", "checked_in", "waiting", "in_consultation", "with_doctor", "validation_open", "waiting_for_window"];

export const calculateDynamicQueuePositions = (reservations) => {
  const groupedBySchedule = {};
  reservations.forEach(r => {
    if (!groupedBySchedule[r.scheduleId]) groupedBySchedule[r.scheduleId] = [];
    groupedBySchedule[r.scheduleId].push(r);
  });
  
  let processedReservations = [];
  const activeStatuses = ACTIVE_RESERVATION_STATUSES;
  
  Object.values(groupedBySchedule).forEach(scheduleReservations => {
    // 1. Assign/preserve permanent Queue Number based on creation order
    const sortedByCreation = [...scheduleReservations].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    const withPermanentNumber = sortedByCreation.map((r, i) => {
      const permanentNum = r.queueNumber || r.originalQueueNumber || (i + 1);
      return {
        ...r,
        queueNumber: permanentNum,
        originalQueueNumber: permanentNum,
        queuePosition: permanentNum // permanent Queue Number displayed across all modules
      };
    });

    // 2. Determine dynamic Queue Order for active pipeline
    const active = withPermanentNumber
      .filter(r => activeStatuses.includes(r.status))
      .sort((a, b) => {
        const timeA = a.sortTimestamp || a.createdAt || 0;
        const timeB = b.sortTimestamp || b.createdAt || 0;
        return timeA - timeB;
      });
    const inactive = withPermanentNumber.filter(r => !activeStatuses.includes(r.status));
    
    const rankedActive = active.map((r, index) => ({
      ...r,
      queueOrder: index + 1
    }));
    
    processedReservations = [...processedReservations, ...rankedActive, ...inactive];
  });

  return enrichReservationsWithState(processedReservations);
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
  const snap = await get(ref(database, `reservations/${reservationId}`));
  const scheduleId = snap.exists() ? snap.val().scheduleId : null;
  await update(ref(database, `reservations/${reservationId}`), {
    status: "cancelled",
    cancelledAt: Date.now()
  });
  if (scheduleId) {
    await recalculateRollingValidation(scheduleId);
    await recalculateEntireQueue(scheduleId);
  }
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
  const snap = await get(ref(database, `reservations/${reservationId}`));
  const scheduleId = snap.exists() ? snap.val().scheduleId : null;
  await update(ref(database, `reservations/${reservationId}`), {
    checkedIn: true,
    checkedInAt: Date.now(),
    checkedInBy: secretaryUid,
    status: "checked_in"
  });
  if (scheduleId) {
    await recalculateRollingValidation(scheduleId);
    await recalculateEntireQueue(scheduleId);
  }
};

export const startConsultation = async (reservationId) => {
  const snap = await get(ref(database, `reservations/${reservationId}`));
  const scheduleId = snap.exists() ? snap.val().scheduleId : null;
  await update(ref(database, `reservations/${reservationId}`), {
    status: "in_consultation",
    consultationStartedAt: Date.now()
  });
  if (scheduleId) {
    await recalculateRollingValidation(scheduleId);
    await recalculateEntireQueue(scheduleId);
  }
};

export const sendToDoctor = async (reservationId) => {
  const snap = await get(ref(database, `reservations/${reservationId}`));
  const scheduleId = snap.exists() ? snap.val().scheduleId : null;
  await update(ref(database, `reservations/${reservationId}`), {
    status: "with_doctor",
    sentToDoctorAt: Date.now(),
    consultationStartedAt: Date.now()
  });
  if (scheduleId) {
    await recalculateRollingValidation(scheduleId);
    await recalculateEntireQueue(scheduleId);
  }
};

export const completeConsultation = async (reservationId, doctorNotes) => {
  const snap = await get(ref(database, `reservations/${reservationId}`));
  const scheduleId = snap.exists() ? snap.val().scheduleId : null;
  await update(ref(database, `reservations/${reservationId}`), {
    status: "consultation_completed",
    consultationCompletedAt: Date.now(),
    doctorNotes: doctorNotes || ""
  });
  if (scheduleId) {
    await recalculateRollingValidation(scheduleId);
    await recalculateEntireQueue(scheduleId);
  }
};

export const updatePatientInfo = async (reservationId, patientInfo) => {
  await update(ref(database, `reservations/${reservationId}`), {
    ...patientInfo,
    patientInfoCompleted: true
  });
};

export const penalizeReservation = async (reservationId, schedule, allScheduleReservations = []) => {
  const snap = await get(ref(database, `reservations/${reservationId}`));
  if (!snap.exists()) return;
  const val = snap.val();
  
  const currentPenaltyCount = (val.penaltyCount || 0) + 1;
  const lateLimit = Number(schedule?.lateLimit) || 3;

  if (currentPenaltyCount >= lateLimit) {
    // Exceeded Late Limit: Remove reservation from today's queue into history permanently as forfeited
    await update(ref(database, `reservations/${reservationId}`), {
      status: "forfeited",
      forfeitureReason: "Exceeded the clinic's late arrival limit.",
      penaltyCount: currentPenaltyCount,
      forfeitedAt: Date.now(),
      penalizedAt: Date.now()
    });
  } else {
    // Move behind the next two waiting patients
    const activePipeline = allScheduleReservations
      .filter(r => r.scheduleId === val.scheduleId && ["reserved", "checked_in", "waiting", "validation_open", "waiting_for_window"].includes(r.status))
      .sort((a, b) => {
        const timeA = a.sortTimestamp || a.createdAt || 0;
        const timeB = b.sortTimestamp || b.createdAt || 0;
        return timeA - timeB;
      });

    const index = activePipeline.findIndex(r => r.id === reservationId);
    let newSortTimestamp = Date.now();

    if (index >= 0 && activePipeline.length > 1) {
      const targetBehindIndex = Math.min(activePipeline.length - 1, index + 2);
      const targetBehind = activePipeline[targetBehindIndex];
      const nextAfterTarget = activePipeline[targetBehindIndex + 1];

      const targetTime = targetBehind.sortTimestamp || targetBehind.createdAt || 0;
      if (nextAfterTarget) {
        const nextTime = nextAfterTarget.sortTimestamp || nextAfterTarget.createdAt || 0;
        newSortTimestamp = (targetTime + nextTime) / 2;
      } else {
        newSortTimestamp = targetTime + 60000;
      }
    }

    await update(ref(database, `reservations/${reservationId}`), {
      penaltyCount: currentPenaltyCount,
      sortTimestamp: newSortTimestamp,
      lastPenalizedAt: Date.now()
    });
  }
  await recalculateEntireQueue(val.scheduleId);
};

export const requestCheckInReminder = async (reservationId) => {
  if (!reservationId) return;
  await update(ref(database, `reservations/${reservationId}`), {
    checkInRequestedAt: Date.now(),
  });
};
