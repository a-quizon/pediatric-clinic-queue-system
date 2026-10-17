import { getDb } from "../firebase/database";
import { ref, push, set, get, update, remove, query, orderByChild, equalTo, startAt } from "firebase/database";
import { subscribeOnValue } from "../firebase/rtdbSubscribe";
import { auth } from "../firebase/auth";
import { getPushApiBase } from "./pushService";
import { getReservationsBySchedule } from "./reservationService";
import { recalculateRollingValidation } from "./rollingValidationService";
import { recalculateEntireQueue } from "./queueEngine";
import { validateScheduleClosingTime } from "./branchConfigurationService";
import { logAuditEvent, AUDIT_ACTIONS, AUDIT_CATEGORIES } from "./auditService";
import { branchesMatch } from "../utils/stringUtils";
import { isLiveQueueStatus } from "../utils/penaltyTimer";
import { manilaDateString } from "../utils/manilaDate";

export { validateScheduleClosingTime };

const callScheduleApi = async (path, payload) => {
  const current = auth.currentUser;
  if (!current) throw new Error("You must be signed in.");
  const token = await current.getIdToken();
  let response;
  try {
    response = await fetch(`${getPushApiBase()}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    const wrapped = new Error("Unable to reach the clinic server. Please try again.");
    wrapped.cause = error;
    throw wrapped;
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const wrapped = new Error(body.message || "Could not update the schedule.");
    wrapped.cause = body;
    throw wrapped;
  }
  return body;
};

// check muna if hindi pa past closing time ng branch for today before creating
export const createSchedule = async ( scheduleData ) => {
  const timeValidation = await validateScheduleClosingTime(scheduleData.branch, scheduleData.clinicDate);
  if (!timeValidation.valid) {
    throw new Error(timeValidation.message);
  }

  const scheduleRef = push(ref(getDb(), "schedules"));
  const payload = { ...scheduleData };
  delete payload.lateLimit;

  await set(scheduleRef, payload);

  return scheduleRef.key;
};

export const getSchedules = async () => {
  const snapshot = await get(
    ref(getDb(), "schedules")
  );

  if (snapshot.exists()) {
    return snapshot.val();
  }

  return {};
};

export const getScheduleById = async (scheduleId) => {
  const snapshot = await get(ref(getDb(), `schedules/${scheduleId}`));
  if (snapshot.exists()) {
    return { id: snapshot.key, ...snapshot.val() };
  }
  return null;
};

export const scheduleExists = async ( branch, clinicDate ) => {
  const snapshot = await get( ref(getDb(), "schedules") );

  if (!snapshot.exists()) { return false; }

  const schedules = snapshot.val();

  return Object.values(schedules).some( (schedule) => branchesMatch(schedule.branch, branch) && schedule.clinicDate === clinicDate);
};

// check closing time before updating draft schedule or publishing
export const updateSchedule = async ( scheduleId, updatedData ) => {
  const snapshot = await get(ref(getDb(), `schedules/${scheduleId}`));
  if (snapshot.exists()) {
    const currentSchedule = snapshot.val();
    if (currentSchedule.status === "published") {
      delete updatedData.branch;
      delete updatedData.branchId;
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
  const payload = { ...updatedData };
  delete payload.lateLimit;
  await update(ref(getDb(),`schedules/${scheduleId}`), payload);
};

export const deleteSchedule = async (scheduleId) => {
  const snapshot = await get(ref(getDb(), `schedules/${scheduleId}`));
  if (snapshot.exists()) {
    const schedule = snapshot.val();
    if (schedule.dayClosed) {
      throw new Error("A closed clinic day is kept on record.");
    }
    if (schedule.status === "published" || schedule.status === "completed") {
      const reservations = await getReservationsBySchedule(scheduleId);
      if (reservations.length > 0) {
        throw new Error("This schedule has reservations and cannot be deleted.");
      }
    }
  }
  await remove(ref(getDb(), `schedules/${scheduleId}`));
};

export const publishSchedule = async (scheduleId, options = {}) => {
  let currentSchedule = null;
  const snapshot = await get(ref(getDb(), `schedules/${scheduleId}`));
  if (snapshot.exists()) {
    currentSchedule = snapshot.val();
    const timeValidation = await validateScheduleClosingTime(currentSchedule.branch, currentSchedule.clinicDate);
    if (!timeValidation.valid) {
      throw new Error(timeValidation.message);
    }
  }
  await update( ref(getDb(), `schedules/${scheduleId}`), {
    status: "published", 
    queueStatus: "not_started", // Default queue status when published
    queueStartedAt: null,
    isReady: false,
    publishedAt: Date.now(),
  });

  if (currentSchedule && options.audit !== false) {
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
  await update( ref(getDb(), `schedules/${scheduleId}`), {
    isReady: true,
    movedToReadyAt: Date.now(),
  });
};

/**
 * Pause / resume / close / start via server (audited after success).
 * Client still recalculates queue order after a live-status change.
 */
export const updateQueueStatus = async (scheduleId, queueStatus) => {
  const result = await callScheduleApi("/api/schedules/queue-status", {
    scheduleId,
    queueStatus,
  });

  if (result?.unchanged) return result;

  if (queueStatus === "active") {
    await recalculateRollingValidation(scheduleId);
  }
  // Stamp becameCurrentTurnAt on the first penalize target once the queue is live.
  if (isLiveQueueStatus(queueStatus)) {
    await recalculateEntireQueue(scheduleId);
  }
  return result;
};

/**
 * End clinic session via server (audited after success).
 */
export const completeSchedule = async (scheduleId) => {
  return callScheduleApi("/api/schedules/end-session", { scheduleId });
};

/**
 * Update published-day slot capacity via server (audited after success).
 */
export const updateSlotCapacity = async (scheduleId, slotCapacity) => {
  return callScheduleApi("/api/schedules/slot-capacity", {
    scheduleId,
    slotCapacity: Number(slotCapacity),
  });
};

export const subscribeToPublishedSchedules = ( callback ) => {
  if (typeof callback !== "function") return () => {};
  const q = query(
    ref(getDb(), "schedules"),
    orderByChild("status"),
    equalTo("published")
  );
  return subscribeOnValue(q, (snapshot) => {
      if (!snapshot.exists()) {
        callback([]);
        return;
      }

      const data = snapshot.val();

      const schedules = Object.entries(data).map(([id, value]) => ({ id, ...value,}));
      callback(schedules);
    }
  );
};

/** Published schedules dated today (Asia/Manila) or later; past dates are filtered server-side. */
export const subscribeToUpcomingPublishedSchedules = (today, callback) => {
  if (typeof callback !== "function") return () => {};
  const q = query(
    ref(getDb(), "schedules"),
    orderByChild("clinicDate"),
    startAt(today || manilaDateString())
  );
  return subscribeOnValue(q, (snapshot) => {
    if (!snapshot.exists()) {
      callback([]);
      return;
    }
    const schedules = Object.entries(snapshot.val())
      .map(([id, value]) => ({ id, ...value }))
      .filter((schedule) => schedule.status === "published");
    callback(schedules);
  });
};

export const subscribeToAllSchedules = (callback, onError) => {
  if (typeof callback !== "function") return () => {};
  const schedulesRef = ref(getDb(), "schedules");
  return subscribeOnValue(schedulesRef, (snapshot) => {
    if (!snapshot.exists()) {
      callback({});
      return;
    }
    callback(snapshot.val());
  }, onError);
};