import { database } from "../firebase/database";
import { ref, push, set, get, update, remove, onValue, serverTimestamp } from "firebase/database";
import { getReservationsBySchedule } from "./reservationService";
import { recalculateRollingValidation } from "./rollingValidationService";
import { validateScheduleClosingTime } from "./branchConfigurationService";
import { logAuditEvent, AUDIT_ACTIONS, AUDIT_CATEGORIES } from "./auditService";

export { validateScheduleClosingTime };

// check muna if hindi pa past closing time ng branch for today before creating
export const createSchedule = async ( scheduleData ) => {
  const timeValidation = await validateScheduleClosingTime(scheduleData.branch, scheduleData.clinicDate);
  if (!timeValidation.valid) {
    throw new Error(timeValidation.message);
  }

  const scheduleRef = push(ref(database, "schedules"));

  await set(scheduleRef, {
    ...scheduleData,
    lateLimit: Number(scheduleData.lateLimit) || 3
  });

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

// check closing time before updating draft schedule or publishing
export const updateSchedule = async ( scheduleId, updatedData ) => {
  const snapshot = await get(ref(database, `schedules/${scheduleId}`));
  if (snapshot.exists()) {
    const currentSchedule = snapshot.val();
    if (currentSchedule.status === "published") {
      delete updatedData.branch;
      delete updatedData.clinicDate;
    } else {
      const branch = updatedData.branch || currentSchedule.branch;
      const clinicDate = updatedData.clinicDate || currentSchedule.clinicDate;
      const timeValidation = await validateScheduleClosingTime(branch, clinicDate);
      if (!timeValidation.valid) {
        throw new Error(timeValidation.message);
      }
    }
  }
  await update(ref(database,`schedules/${scheduleId}`), updatedData);
};

export const deleteSchedule = async (scheduleId) => {
  await remove(ref(database,`schedules/${scheduleId}`));
};

export const publishSchedule = async ( scheduleId ) => {
  let currentSchedule = null;
  const snapshot = await get(ref(database, `schedules/${scheduleId}`));
  if (snapshot.exists()) {
    currentSchedule = snapshot.val();
    const timeValidation = await validateScheduleClosingTime(currentSchedule.branch, currentSchedule.clinicDate);
    if (!timeValidation.valid) {
      throw new Error(timeValidation.message);
    }
  }
  await update( ref(database, `schedules/${scheduleId}`), {
    status: "published", 
    queueStatus: "not_started", // Default queue status when published
    queueStartedAt: null,
    isReady: false,
    publishedAt: Date.now(),
  });

  if (currentSchedule) {
    logAuditEvent({
      action: AUDIT_ACTIONS.SCHEDULE_PUBLISHED,
      category: AUDIT_CATEGORIES.SCHEDULE_MANAGEMENT,
      description: `Published schedule for ${currentSchedule.branch} on ${currentSchedule.clinicDate}`,
      targetType: "schedule",
      targetId: scheduleId,
      branchId: currentSchedule.branch
    });
  }
};

export const moveToReady = async ( scheduleId ) => {
  await update( ref(database, `schedules/${scheduleId}`), {
    isReady: true,
    movedToReadyAt: Date.now(),
  });
};

export const updateQueueStatus = async (scheduleId, queueStatus) => {
  const updates = {
    queueStatus,
    [`queueStatusUpdatedAt`]: Date.now()
  };
  
  const snap = await get(ref(database, `schedules/${scheduleId}`));
  let isFirstStart = false;
  let scheduleData = null;

  if (snap.exists()) {
    scheduleData = snap.val();
    if (queueStatus === "active" && !scheduleData.queueStartedAt) {
      updates.queueStartedAt = serverTimestamp();
      isFirstStart = true;
    }
  }

  await update(ref(database, `schedules/${scheduleId}`), updates);
  
  if (queueStatus === "active") {
    await recalculateRollingValidation(scheduleId);
  }

  // Audit Logs
  if (scheduleData) {
    let action = null;
    let description = "";

    if (queueStatus === "active") {
      action = isFirstStart ? AUDIT_ACTIONS.QUEUE_STARTED : AUDIT_ACTIONS.QUEUE_RESUMED;
      description = isFirstStart ? "Started the clinic queue" : "Resumed the clinic queue";
    } else if (queueStatus === "paused") {
      action = AUDIT_ACTIONS.QUEUE_PAUSED;
      description = "Paused the clinic queue";
    } else if (queueStatus === "closed") {
      action = AUDIT_ACTIONS.QUEUE_CLOSED;
      description = "Closed the clinic queue";
    }

    if (action) {
      logAuditEvent({
        action,
        category: AUDIT_CATEGORIES.QUEUE_OPERATIONS,
        description,
        targetType: "schedule",
        targetId: scheduleId,
        branchId: scheduleData.branch
      });
    }
  }
};

export const completeSchedule = async ( scheduleId ) => {
  const now = Date.now();
  await update( ref(database, `schedules/${scheduleId}`), {
    status: "completed", 
    queueStatus: "completed",
    completedAt: now,
    scheduleCompletedAt: now
  });

  const reservations = await getReservationsBySchedule(scheduleId);
  const updates = {};
  const finalStatuses = ["cancelled", "completed", "consultation_completed", "forfeited", "penalized", "late_limit_reached", "expired", "validation_expired"];
  reservations.forEach(res => {
    if (!finalStatuses.includes(res.status)) {
      updates[`reservations/${res.id}/status`] = "completed";
      updates[`reservations/${res.id}/completedAt`] = now;
    }
  });

  if (Object.keys(updates).length > 0) {
    await update(ref(database), updates);
  }

  // Audit Log
  const snap = await get(ref(database, `schedules/${scheduleId}`));
  const branch = snap.exists() ? snap.val().branch : null;

  logAuditEvent({
    action: AUDIT_ACTIONS.SCHEDULE_COMPLETED,
    category: AUDIT_CATEGORIES.SCHEDULE_MANAGEMENT,
    description: `Completed schedule`,
    targetType: "schedule",
    targetId: scheduleId,
    branchId: branch
  });
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

export const subscribeToAllSchedules = (callback) => {
  const schedulesRef = ref(database, "schedules");
  return onValue(schedulesRef, (snapshot) => {
    if (!snapshot.exists()) {
      callback({});
      return;
    }
    callback(snapshot.val());
  });
};