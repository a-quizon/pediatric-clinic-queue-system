import { database } from "../firebase/database";
import { ref, push, set, get, update, query, orderByChild, equalTo, serverTimestamp, runTransaction } from "firebase/database";
import { subscribeOnValue } from "../firebase/rtdbSubscribe";
import { recalculateRollingValidation } from "./rollingValidationService";
import { recalculateEntireQueue, enrichReservationsWithState } from "./queueEngine";
import { logAuditEvent, AUDIT_ACTIONS, AUDIT_CATEGORIES } from "./auditService";
import { getScheduleById } from "./scheduleService";
import { buildPatientInfoPayload } from "../utils/reservationPatients";
import {
  getQueueConfiguration,
  resolveScheduleBranchId,
} from "./systemConfigurationService";
import {
  PENALTY_TIMER_FORFEIT_REASON,
  canExpirePenaltyTimer,
} from "../utils/penaltyTimer";

const generateReservationCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

export const createReservation = async (reservationData) => {
  const q = query(
    ref(database, "reservations"),
    orderByChild("scheduleId"),
    equalTo(reservationData.scheduleId)
  );
  const existingSnapshot = await get(q);
  let nextQueueNumber = 1;
  if (existingSnapshot.exists()) {
    const scheduleRes = Object.values(existingSnapshot.val());
    const maxNum = scheduleRes.reduce((max, r) => Math.max(max, Number(r.queueNumber || r.originalQueueNumber || r.queuePosition || 0)), 0);
    nextQueueNumber = maxNum + 1;
  }

  const reservationRef = push(ref(database, "reservations"));
  const now = serverTimestamp();
  await set(reservationRef, {
    ...reservationData,
    reservationCode: generateReservationCode(),
    queueNumber: nextQueueNumber,
    originalQueueNumber: nextQueueNumber,
    queuePosition: nextQueueNumber,
    checkedIn: reservationData.checkedIn ?? false,
    createdAt: now,
    reservationCreatedAt: now,
  });
  if (reservationData.scheduleId) {
    await recalculateRollingValidation(reservationData.scheduleId);
    await recalculateEntireQueue(reservationData.scheduleId);
  }
  return reservationRef.key;
};

const MAX_WALK_IN_CHILDREN = 10;

/**
 * Secretary-created walk-in: no parent account, immediately checked in.
 * Uses the same reservation/queue record as parent bookings.
 */
export const createWalkInReservation = async ({
  scheduleId,
  children,
  concern,
  secretaryUid,
  parentName = "",
  parentPhone = "",
}) => {
  if (!scheduleId) throw new Error("Schedule is required.");
  if (!secretaryUid) throw new Error("Secretary identity is required.");

  const schedule = await getScheduleById(scheduleId);
  if (!schedule) throw new Error("Schedule not found.");
  if (schedule.status !== "published") {
    throw new Error("Schedule is not available for booking.");
  }

  const queueStatus = schedule.queueStatus;
  if (queueStatus === "closed" || queueStatus === "ended" || queueStatus === "completed") {
    throw new Error("This clinic queue has closed to new reservations.");
  }

  const existing = await getReservationsBySchedule(scheduleId);
  const activeCount = existing.filter((r) => ACTIVE_RESERVATION_STATUSES.includes(r.status)).length;
  if (activeCount >= Number(schedule.slotCapacity || 0)) {
    throw new Error("This schedule is already full.");
  }

  const normalizedChildren = (children || []).map((child) => ({
    childName: String(child.childName || "").trim(),
    age: String(child.age ?? "").trim(),
    sex: child.sex === "Male" || child.sex === "Female" ? child.sex : "",
    childId: null,
  }));

  if (normalizedChildren.length === 0) {
    throw new Error("At least one child is required.");
  }
  if (normalizedChildren.length > MAX_WALK_IN_CHILDREN) {
    throw new Error(`A maximum of ${MAX_WALK_IN_CHILDREN} children is allowed.`);
  }
  if (normalizedChildren.some((c) => !c.childName)) {
    throw new Error("Each child must have a name.");
  }
  if (
    normalizedChildren.some((c) => {
      if (!/^\d+$/.test(c.age)) return true;
      const ageNum = parseInt(c.age, 10);
      return ageNum < 1 || ageNum > 25;
    })
  ) {
    throw new Error("Each child must have a valid age (1–25).");
  }
  if (normalizedChildren.some((c) => !c.sex)) {
    throw new Error("Each child must have a sex selected.");
  }

  const patientPayload = buildPatientInfoPayload(normalizedChildren, concern);
  const checkedInAt = Date.now();
  const trimmedParentName = String(parentName || "").trim();
  const trimmedParentPhone = String(parentPhone || "").trim();

  return createReservation({
    scheduleId,
    status: "checked_in",
    source: "walk_in",
    createdBy: secretaryUid,
    ...patientPayload,
    ...(trimmedParentName ? { parentName: trimmedParentName } : {}),
    ...(trimmedParentPhone ? { parentPhone: trimmedParentPhone } : {}),
    patientInfoCompleted: true,
    checkedIn: true,
    checkedInAt,
    checkedInBy: secretaryUid,
  });
};

export const getReservationsBySchedule = async (scheduleId) => {
  const q = query(
    ref(database, "reservations"),
    orderByChild("scheduleId"),
    equalTo(scheduleId)
  );
  const snapshot = await get(q);
  if (!snapshot.exists()) return [];

  const data = snapshot.val();
  const reservations = Object.entries(data).map(([id, value]) => ({ id, ...value }));
  return calculateDynamicQueuePositions(reservations);
};

export const checkExistingReservation = async (scheduleId, parentId) => {
  const reservations = await getReservationsBySchedule(scheduleId);
  const inactiveStatuses = ["cancelled", "completed", "consultation_completed", "expired", "validation_expired", "forfeited", "penalized", "late_limit_reached"];
  return reservations.some((res) => res.parentId === parentId && !inactiveStatuses.includes(res.status));
};

export const checkExistingReservationOnDate = async (parentId, clinicDate) => {
  const q = query(
    ref(database, "reservations"),
    orderByChild("parentId"),
    equalTo(parentId)
  );
  const resSnapshot = await get(q);
  
  if (!resSnapshot.exists()) return false;

  const parentReservations = Object.values(resSnapshot.val());

  // Filter for active reservations first to minimize schedule fetches
  const inactiveStatuses = ["cancelled", "completed", "consultation_completed", "expired", "validation_expired", "forfeited", "penalized", "late_limit_reached"];
  const activeReservations = parentReservations.filter(res => !inactiveStatuses.includes(res.status));
  
  if (activeReservations.length === 0) return false;

  // Extract unique schedule IDs from active reservations
  const uniqueScheduleIds = [...new Set(activeReservations.map(res => res.scheduleId))];

  // Fetch only the relevant schedules
  const schedulePromises = uniqueScheduleIds.map(id => getScheduleById(id));
  const schedules = await Promise.all(schedulePromises);

  // Check if any active reservation belongs to a schedule on the target clinicDate
  return schedules.some(schedule => schedule && schedule.clinicDate === clinicDate);
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
  const q = query(
    ref(database, "reservations"),
    orderByChild("parentId"),
    equalTo(parentId)
  );
  const resSnapshot = await get(q);
  
  if (!resSnapshot.exists()) return false;

  const parentReservations = Object.values(resSnapshot.val());

  // Filter for completed statuses
  const completedReservations = parentReservations.filter(res => 
    res.status === "completed" || res.status === "consultation_completed"
  );
  
  if (completedReservations.length === 0) return false;

  // Extract unique schedule IDs
  const uniqueScheduleIds = [...new Set(completedReservations.map(res => res.scheduleId))];

  // Fetch only the relevant schedules
  const schedulePromises = uniqueScheduleIds.map(id => getScheduleById(id));
  const schedules = await Promise.all(schedulePromises);

  // Check if any completed consultation belongs to a matching schedule
  return schedules.some(schedule => {
    if (!schedule) return false;
    if (schedule.clinicDate !== clinicDate) return false;
    if (doctorId && schedule.doctorId && schedule.doctorId !== doctorId) return false;
    return true;
  });
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
    const sortedByCreation = [...scheduleReservations].sort((a, b) => {
      const timeA = a.sortTimestamp || a.createdAt || 0;
      const timeB = b.sortTimestamp || b.createdAt || 0;
      return timeA - timeB;
    });
    const withPermanentNumber = sortedByCreation.map((r, i) => {
      const permanentNum = r.queueNumber || r.originalQueueNumber || (i + 1);
      return {
        ...r,
        queueNumber: permanentNum,
        originalQueueNumber: permanentNum
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

export const subscribeToParentReservations = (parentId, callback) => {
  if (typeof callback !== "function") return () => {};
  if (!parentId) {
    callback([]);
    return () => {};
  }
  const q = query(
    ref(database, "reservations"),
    orderByChild("parentId"),
    equalTo(parentId)
  );
  return subscribeOnValue(q, (snapshot) => {
    if (!snapshot.exists()) {
      callback([]);
      return;
    }

    const data = snapshot.val();
    const reservations = Object.entries(data).map(([id, value]) => ({ id, ...value }));
    callback(calculateDynamicQueuePositions(reservations));
  });
};

export const subscribeToScheduleReservations = (scheduleId, callback) => {
  if (typeof callback !== "function") return () => {};
  if (!scheduleId) {
    callback([]);
    return () => {};
  }
  const q = query(
    ref(database, "reservations"),
    orderByChild("scheduleId"),
    equalTo(scheduleId)
  );
  return subscribeOnValue(q, (snapshot) => {
    if (!snapshot.exists()) {
      callback([]);
      return;
    }

    const data = snapshot.val();
    const reservations = Object.entries(data).map(([id, value]) => ({ id, ...value }));
    callback(calculateDynamicQueuePositions(reservations));
  });
};

export const subscribeToAllReservations = (callback) => {
  if (typeof callback !== "function") return () => {};
  const reservationsRef = ref(database, "reservations");
  return subscribeOnValue(reservationsRef, (snapshot) => {
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
  const q = query(
    ref(database, "reservations"),
    orderByChild("reservationCode"),
    equalTo(code)
  );
  const snapshot = await get(q);
  if (!snapshot.exists()) return null;

  const data = snapshot.val();
  // If multiple records match (collision), we pick the first one, matching legacy Array.find behavior
  const rawReservation = Object.entries(data).map(([id, value]) => ({ id, ...value }))[0];
  
  if (!rawReservation || !rawReservation.scheduleId) return null;
  
  const scheduleReservations = await getReservationsBySchedule(rawReservation.scheduleId);
  return scheduleReservations.find(res => res.id === rawReservation.id) || null;
};

export const checkInReservation = async (reservationId, secretaryUid) => {
  const snap = await get(ref(database, `reservations/${reservationId}`));
  const scheduleId = snap.exists() ? snap.val().scheduleId : null;
  await update(ref(database, `reservations/${reservationId}`), {
    checkedIn: true,
    checkedInAt: Date.now(),
    checkedInBy: secretaryUid,
    status: "checked_in",
    penaltyTimerExpiresAt: null,
    penaltyTimerStartedAt: null,
    becameCurrentTurnAt: null,
    penaltyTimerClearedAt: Date.now(),
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

const applyForfeitFields = (current, { forfeitureReason, penaltyCount, now }) => ({
  ...current,
  status: "forfeited",
  forfeitureReason,
  penaltyCount: penaltyCount ?? current.penaltyCount ?? 0,
  forfeitedAt: now,
  penalizedAt: now,
  queueState: "FORFEITED",
  penaltyTimerExpiresAt: null,
  penaltyTimerStartedAt: null,
  becameCurrentTurnAt: null,
});

export const penalizeReservation = async (reservationId, schedule, allScheduleReservations = [], penaltyMoveBack) => {
  const snap = await get(ref(database, `reservations/${reservationId}`));
  if (!snap.exists()) return;
  const val = snap.val();

  const currentPenaltyCount = (val.penaltyCount || 0) + 1;
  const branchId = await resolveScheduleBranchId(schedule);
  const queueConfig = await getQueueConfiguration(branchId);
  const moveBack = Number.isInteger(penaltyMoveBack) ? penaltyMoveBack : queueConfig.penaltyMoveBack;
  const timerMinutes = queueConfig.penaltyTimerMinutes;
  const now = Date.now();
  const forfeitOnZeroMoveBack = moveBack === 0;

  if (forfeitOnZeroMoveBack) {
    await update(ref(database, `reservations/${reservationId}`), applyForfeitFields(val, {
      forfeitureReason: "Setting the Penalty Move-Back count to 0 results in an automatic forfeit for the parent.",
      penaltyCount: currentPenaltyCount,
      now,
    }));

    logAuditEvent({
      action: AUDIT_ACTIONS.PATIENT_FORFEITED,
      category: AUDIT_CATEGORIES.QUEUE_INTERVENTION,
      description: `Forfeited Queue #${val.queueNumber} because Penalty Move-Back is 0`,
      targetType: "reservation",
      targetId: reservationId,
      branchId: schedule?.branch
    });
  } else {
    const activePipeline = allScheduleReservations
      .filter(r => r.scheduleId === val.scheduleId && ["reserved", "checked_in", "waiting", "validation_open", "waiting_for_window"].includes(r.status))
      .sort((a, b) => {
        const timeA = a.sortTimestamp || a.createdAt || 0;
        const timeB = b.sortTimestamp || b.createdAt || 0;
        return timeA - timeB;
      });

    const index = activePipeline.findIndex(r => r.id === reservationId);
    let newSortTimestamp = now;

    if (index >= 0 && activePipeline.length > 1) {
      const targetBehindIndex = Math.min(activePipeline.length - 1, index + moveBack);
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

    const pipelineAfterMove = activePipeline.map((r) =>
      r.id === reservationId ? { ...r, sortTimestamp: newSortTimestamp } : r
    ).sort((a, b) => {
      const timeA = a.sortTimestamp || a.createdAt || 0;
      const timeB = b.sortTimestamp || b.createdAt || 0;
      return timeA - timeB;
    });
    const newOrderIndex = pipelineAfterMove.findIndex((r) => r.id === reservationId);
    const newQueuePosition = newOrderIndex >= 0 ? newOrderIndex + 1 : (val.queueOrder || val.queuePosition || 1);

    const existingExpiry = Number(val.penaltyTimerExpiresAt) || 0;
    const keepFirstExpiry = existingExpiry > now;
    const penaltyTimerStartedAt = keepFirstExpiry ? (val.penaltyTimerStartedAt || now) : now;
    const penaltyTimerExpiresAt = keepFirstExpiry
      ? existingExpiry
      : now + timerMinutes * 60 * 1000;

    await update(ref(database, `reservations/${reservationId}`), {
      penaltyCount: currentPenaltyCount,
      sortTimestamp: newSortTimestamp,
      lastPenalizedAt: now,
      queueOrder: newQueuePosition,
      queuePosition: newQueuePosition,
      penaltyTimerStartedAt,
      penaltyTimerExpiresAt,
      becameCurrentTurnAt: null,
    });

    logAuditEvent({
      action: AUDIT_ACTIONS.PATIENT_PENALIZED,
      category: AUDIT_CATEGORIES.QUEUE_INTERVENTION,
      description: `Penalized Queue #${val.queueNumber} and started/kept late timer (expires ${new Date(penaltyTimerExpiresAt).toLocaleTimeString()})`,
      targetType: "reservation",
      targetId: reservationId,
      branchId: schedule?.branch
    });
  }
  await recalculateEntireQueue(val.scheduleId);
};

/**
 * Auto-forfeit a reservation whose penalty timer has expired. Idempotent via transaction.
 * @returns {Promise<boolean>} true when this caller applied the forfeit
 */
export const forfeitReservationIfTimerExpired = async (reservationId) => {
  if (!reservationId) return false;
  const resRef = ref(database, `reservations/${reservationId}`);
  const now = Date.now();

  const result = await runTransaction(resRef, (current) => {
    if (!current) return;
    if (!canExpirePenaltyTimer(current)) return;
    const expiresAt = Number(current.penaltyTimerExpiresAt) || 0;
    if (!expiresAt || expiresAt > Date.now()) return;
    return applyForfeitFields(current, {
      forfeitureReason: PENALTY_TIMER_FORFEIT_REASON,
      penaltyCount: current.penaltyCount,
      now,
    });
  });

  if (!result.committed || !result.snapshot.exists()) return false;
  const after = result.snapshot.val();
  if (after.status !== "forfeited") return false;

  if (after.scheduleId) {
    await recalculateEntireQueue(after.scheduleId);
  }

  logAuditEvent({
    action: AUDIT_ACTIONS.PATIENT_FORFEITED,
    category: AUDIT_CATEGORIES.QUEUE_INTERVENTION,
    description: `Forfeited Queue #${after.queueNumber} because the late penalty timer expired`,
    targetType: "reservation",
    targetId: reservationId,
    branchId: after.branchId || after.branch || null,
  });

  return true;
};

export const requestCheckInReminder = async (reservationId) => {
  if (!reservationId) return;
  await update(ref(database, `reservations/${reservationId}`), {
    checkInRequestedAt: Date.now(),
  });
};

export const closeActiveReservationsForParent = async (parentId, { terminalStatus, reason }) => {
  if (!parentId) return;
  if (terminalStatus !== "cancelled" && terminalStatus !== "forfeited") {
    throw new Error("terminalStatus must be cancelled or forfeited.");
  }

  const q = query(
    ref(database, "reservations"),
    orderByChild("parentId"),
    equalTo(parentId)
  );
  const snapshot = await get(q);
  if (!snapshot.exists()) return;

  const now = Date.now();
  const rootUpdates = {};
  const scheduleIds = new Set();

  Object.entries(snapshot.val()).forEach(([id, val]) => {
    if (!ACTIVE_RESERVATION_STATUSES.includes(val?.status)) return;
    rootUpdates[`reservations/${id}/status`] = terminalStatus;
    if (terminalStatus === "cancelled") {
      rootUpdates[`reservations/${id}/cancelledAt`] = now;
      if (reason) rootUpdates[`reservations/${id}/cancellationReason`] = reason;
    } else {
      rootUpdates[`reservations/${id}/forfeitedAt`] = now;
      rootUpdates[`reservations/${id}/queueState`] = "FORFEITED";
      if (reason) rootUpdates[`reservations/${id}/forfeitureReason`] = reason;
    }
    if (val.scheduleId) scheduleIds.add(val.scheduleId);
  });

  if (Object.keys(rootUpdates).length > 0) {
    await update(ref(database), rootUpdates);
  }

  for (const scheduleId of scheduleIds) {
    await recalculateRollingValidation(scheduleId);
    await recalculateEntireQueue(scheduleId);
  }
};
