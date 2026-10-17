import { getDb } from "../firebase/database";
import { auth } from "../firebase/auth";
import { getPushApiBase } from "./pushService";
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
import {
  assertCanCancelReservation,
  assertCanCheckIn,
  assertCanCompleteConsultation,
  assertCanSendToDoctor,
  assertCanStartConsultation,
  assertCanUpdatePatientInfo,
  applyCheckInStatusTransition,
} from "../utils/reservationTransitions";
import { finalizeParentClaim } from "../utils/parentClaimFinalize";
import { ACTIVE_RESERVATION_STATUSES } from "../utils/reservationStatuses";
import { slotsTaken } from "../utils/scheduleCalendar";
import { assertCanMutateRealtime } from "../utils/rtdbConnectionState";

export { finalizeParentClaim } from "../utils/parentClaimFinalize";

const requireReservation = async (reservationId) => {
  const snap = await get(ref(getDb(), `reservations/${reservationId}`));
  if (!snap.exists()) {
    throw new Error("Reservation not found.");
  }
  return { id: reservationId, ...snap.val() };
};

const resolveActor = async () => {
  const user = auth.currentUser;
  if (!user) {
    return { actorUid: null, actorRole: null };
  }
  try {
    const profileSnap = await get(ref(getDb(), `users/${user.uid}`));
    const role = profileSnap.exists() ? profileSnap.val()?.role || null : null;
    return { actorUid: user.uid, actorRole: role };
  } catch {
    return { actorUid: user.uid, actorRole: null };
  }
};

const recalculateQueueBestEffort = async (scheduleId) => {
  if (!scheduleId) return;
  try {
    await recalculateRollingValidation(scheduleId);
    await recalculateEntireQueue(scheduleId);
  } catch (error) {
    // Parents may lack write access to other tickets; Cloud Functions recalculate via Admin SDK (C2/C4).
    console.warn("Client queue recalculation deferred to server:", error?.message || error);
  }
};

const generateReservationCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

const callClaimReservation = async (payload) => {
  const user = auth.currentUser;
  if (!user) {
    throw new Error("You must be signed in.");
  }
  const token = await user.getIdToken();
  let response;
  try {
    response = await fetch(`${getPushApiBase()}/api/reservations/claim`, {
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
    const wrapped = new Error(body.message || "Could not reserve a slot.");
    wrapped.cause = body;
    throw wrapped;
  }
  if (!body?.reservationId) {
    throw new Error("The clinic server did not confirm this reservation. Please try again.");
  }
  return body;
};

/**
 * Frees a terminal reservation's slot right away. Best-effort: the reservation
 * write already happened, and the server trigger plus claim-time pruning are
 * backstops, so failures are only logged.
 */
const requestSlotRelease = async (reservationId) => {
  const user = auth.currentUser;
  if (!user || !reservationId) return;
  try {
    const token = await user.getIdToken();
    const response = await fetch(`${getPushApiBase()}/api/reservations/release`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ reservationId }),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      console.warn("Slot release deferred to server:", body.message || response.status);
    }
  } catch (error) {
    console.warn("Slot release deferred to server:", error?.message || error);
  }
};

export const claimParentReservation = async (scheduleId) => {
  assertCanMutateRealtime();
  const data = await callClaimReservation({ mode: "parent", scheduleId });
  // Best-effort: parent RTDB rules block multi-ticket queue rewrite; Admin CF recalculates.
  return finalizeParentClaim(scheduleId, data, async (id) => {
    await recalculateRollingValidation(id);
    await recalculateEntireQueue(id);
  });
};

export const createReservation = async (reservationData) => {
  const q = query(
    ref(getDb(), "reservations"),
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

  const reservationRef = push(ref(getDb(), "reservations"));
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
 * Staff-created walk-in: no parent account, immediately checked in.
 * Uses the same reservation/queue record as parent bookings.
 * @returns {{ reservationId: string, queueNumber: number }}
 */
export const createWalkInReservation = async ({
  scheduleId,
  children,
  concern,
  secretaryUid,
  parentName = "",
  parentPhone = "",
}) => {
  assertCanMutateRealtime();
  if (!scheduleId) throw new Error("Schedule is required.");
  if (!secretaryUid) throw new Error("Staff identity is required.");

  const schedule = await getScheduleById(scheduleId);
  if (!schedule) throw new Error("Schedule not found.");
  if (schedule.status !== "published") {
    throw new Error("Schedule is not available for booking.");
  }

  const queueStatus = schedule.queueStatus;
  if (queueStatus === "closed" || queueStatus === "ended" || queueStatus === "completed") {
    throw new Error("This clinic queue has closed to new reservations.");
  }

  const trimmedConcern = String(concern || "").trim();

  const existing = await getReservationsBySchedule(scheduleId);
  if (slotsTaken({ id: scheduleId }, existing) >= Number(schedule.slotCapacity || 0)) {
    throw new Error("This schedule is already full.");
  }

  const { getBirthdateError } = await import("../utils/pediatricAge");
  const normalizedChildren = (children || []).map((child) => ({
    childName: String(child.childName || "").trim(),
    birthdate: String(child.birthdate ?? "").trim(),
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
  if (normalizedChildren.some((c) => getBirthdateError(c.birthdate))) {
    throw new Error("Each child must have a valid birthdate.");
  }
  if (normalizedChildren.some((c) => !c.sex)) {
    throw new Error("Each child must have a sex selected.");
  }

  const patientPayload = buildPatientInfoPayload(normalizedChildren, trimmedConcern);
  const trimmedParentName = String(parentName || "").trim();
  const trimmedParentPhone = String(parentPhone || "").trim();
  const data = await callClaimReservation({
    mode: "walk_in",
    scheduleId,
    children: patientPayload.children,
    concern: patientPayload.concern,
    parentName: trimmedParentName,
    parentPhone: trimmedParentPhone,
  });
  // Queue order is recalculated by onReservationWrite (Admin SDK). Avoid a second
  // client-side multi-path update that races secretary check-in transactions.

  const reservationId = data.reservationId;
  const queueNumber = Number(data.queueNumber) || null;
  const childLabel = normalizedChildren.map((c) => c.childName).filter(Boolean).join(", ") || "patient";
  logAuditEvent({
    action: AUDIT_ACTIONS.WALK_IN_CREATED,
    category: AUDIT_CATEGORIES.QUEUE_INTERVENTION,
    description: queueNumber
      ? `Created walk-in Queue #${queueNumber} (${childLabel})`
      : `Created walk-in for ${childLabel}`,
    targetType: "reservation",
    targetId: reservationId,
    branchId: schedule?.branchId || schedule?.branch || null,
  });

  return { reservationId, queueNumber };
};

export const getReservationsBySchedule = async (scheduleId) => {
  const q = query(
    ref(getDb(), "reservations"),
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
  const inactiveStatuses = ["cancelled", "cancelled_by_clinic", "completed", "consultation_completed", "expired", "validation_expired", "forfeited", "penalized", "late_limit_reached"];
  return reservations.some((res) => res.parentId === parentId && !inactiveStatuses.includes(res.status));
};

export const checkExistingReservationOnDate = async (parentId, clinicDate) => {
  const q = query(
    ref(getDb(), "reservations"),
    orderByChild("parentId"),
    equalTo(parentId)
  );
  const resSnapshot = await get(q);
  
  if (!resSnapshot.exists()) return false;

  const parentReservations = Object.values(resSnapshot.val());

  // Filter for active reservations first to minimize schedule fetches
  const inactiveStatuses = ["cancelled", "cancelled_by_clinic", "completed", "consultation_completed", "expired", "validation_expired", "forfeited", "penalized", "late_limit_reached"];
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
  const resRef = ref(getDb(), `reservations/${reservationId}`);
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
    await requestSlotRelease(reservationId);
    if (val.scheduleId) {
      await recalculateRollingValidation(val.scheduleId);
      await recalculateEntireQueue(val.scheduleId);
    }
  }
};

export const checkCompletedConsultationOnDate = async (parentId, clinicDate, doctorId = null) => {
  const q = query(
    ref(getDb(), "reservations"),
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
export { ACTIVE_RESERVATION_STATUSES };

/** Max active upcoming reservations a parent may hold across different clinic dates. */
export const MAX_ACTIVE_UPCOMING_RESERVATIONS = 2;

export const MULTI_DATE_CAP_MESSAGE =
  "You already have 2 upcoming reservations. Cancel one or wait until a visit is finished before booking another.";

/**
 * Unique clinic dates where this parent still holds an active reservation.
 * Pass schedulesById for legacy rows that lack clinicDate on the reservation.
 */
export const getActiveUpcomingDates = (reservations = [], schedulesById = {}) => {
  const dates = new Set();
  (reservations || []).forEach((reservation) => {
    if (!ACTIVE_RESERVATION_STATUSES.includes(reservation.status)) return;
    const fromReservation = reservation.clinicDate;
    const fromSchedule = schedulesById[reservation.scheduleId]?.clinicDate;
    const date = fromReservation || fromSchedule;
    if (date) dates.add(date);
  });
  return dates;
};

export const wouldExceedMultiDateCap = (reservations, schedulesById, targetClinicDate) => {
  const dates = getActiveUpcomingDates(reservations, schedulesById);
  if (dates.has(targetClinicDate)) return false;
  return dates.size >= MAX_ACTIVE_UPCOMING_RESERVATIONS;
};

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

export const subscribeToParentReservations = (parentId, callback, onError) => {
  if (typeof callback !== "function") return () => {};
  if (!parentId) {
    callback([]);
    return () => {};
  }
  const q = query(
    ref(getDb(), "reservations"),
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
  }, onError);
};

export const subscribeToScheduleReservations = (scheduleId, callback, onError) => {
  if (typeof callback !== "function") return () => {};
  if (!scheduleId) {
    callback([]);
    return () => {};
  }
  const q = query(
    ref(getDb(), "reservations"),
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
  }, onError);
};

export const subscribeToAllReservations = (callback) => {
  if (typeof callback !== "function") return () => {};
  const reservationsRef = ref(getDb(), "reservations");
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
  assertCanMutateRealtime();
  const reservation = await requireReservation(reservationId);
  const actor = await resolveActor();
  const gate = assertCanCancelReservation(reservation, actor);
  if (!gate.ok) throw new Error(gate.message);

  await update(ref(getDb(), `reservations/${reservationId}`), {
    status: "cancelled",
    cancelledAt: Date.now(),
  });
  await requestSlotRelease(reservationId);
  await recalculateQueueBestEffort(reservation.scheduleId);
};

export const validateReservationByCode = async (code) => {
  const q = query(
    ref(getDb(), "reservations"),
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

/**
 * Server-side code lookup (rate-limited for manual entry). Prefer this for secretary check-in.
 * @param {string} code
 * @param {{ source?: "manual"|"qr" }} [options]
 * @returns {Promise<object|null>} reservation or null when not found
 */
export const validateReservationByCodeOnServer = async (code, options = {}) => {
  const user = auth.currentUser;
  if (!user) {
    throw new Error("You must be signed in.");
  }
  const token = await user.getIdToken();
  let response;
  try {
    response = await fetch(`${getPushApiBase()}/api/reservations/validate-code`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        code,
        source: options.source === "qr" ? "qr" : "manual",
      }),
    });
  } catch (error) {
    const wrapped = new Error("Unable to reach the clinic server. Please try again.");
    wrapped.cause = error;
    throw wrapped;
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const wrapped = new Error(body.message || "Could not validate the reservation code.");
    wrapped.code = body.error || "internal";
    wrapped.lockedUntil = body.lockedUntil ?? null;
    wrapped.retryAfterSeconds = body.retryAfterSeconds ?? null;
    wrapped.cause = body;
    throw wrapped;
  }
  const reservation = body.reservation || null;
  if (!reservation?.id || !reservation.scheduleId) return null;
  const scheduleReservations = await getReservationsBySchedule(reservation.scheduleId);
  return scheduleReservations.find((res) => res.id === reservation.id) || reservation;
};

const TEMPORARY_RESERVATION_UPDATE_MESSAGE =
  "Temporary error updating this reservation. Please try again.";

/**
 * Atomically apply a reservation field patch when the current status still allows it.
 * Returning undefined from the updater aborts (no write / no queued offline replay).
 * Updater may set `abortMessage.current` so callers get a specific error instead of failMessage.
 */
const commitReservationIf = async (reservationId, updater, failMessage) => {
  const resRef = ref(getDb(), `reservations/${reservationId}`);
  // Prime the local cache so the first transaction callback is less likely to see null
  // while the node still exists on the server (RTDB transaction pitfall).
  const primed = await get(resRef);
  if (!primed.exists()) {
    throw new Error("Reservation not found.");
  }

  const primedVal = primed.val();
  const abortMessage = { current: null };
  const result = await runTransaction(resRef, (current) => {
    // RTDB often invokes the handler with null even when the node exists. Use the
    // primed snapshot for that pass; a stale write conflicts and retries with server data.
    const base = current != null ? current : primedVal;
    if (base == null) {
      abortMessage.current = "Reservation not found.";
      return;
    }
    return updater(base, abortMessage);
  });
  if (!result.committed || !result.snapshot.exists()) {
    const message =
      abortMessage.current || failMessage || TEMPORARY_RESERVATION_UPDATE_MESSAGE;
    console.error("[commitReservationIf] aborted", { reservationId, message });
    throw new Error(message);
  }
  return { id: reservationId, ...result.snapshot.val() };
};

/**
 * Check in by reservation id only.
 * Uses a child-field `update()` (not a whole-node or status-path transaction) so
 * concurrent queue recalculation cannot abort check-in, and RTDB's null-first
 * transaction callback cannot false-fail as "Reservation not found."
 * QR scan and manual code entry both call this after code→id lookup.
 */
export const checkInReservation = async (reservationId, secretaryUid) => {
  assertCanMutateRealtime();
  if (!reservationId) {
    throw new Error("Reservation not found.");
  }

  const resRef = ref(getDb(), `reservations/${reservationId}`);

  let existing;
  try {
    const snap = await get(resRef);
    if (!snap.exists()) {
      throw new Error("Reservation not found.");
    }
    existing = snap.val();
  } catch (error) {
    if (error?.message === "Reservation not found.") throw error;
    console.error("[checkInReservation] read failed", { reservationId, error });
    throw new Error(TEMPORARY_RESERVATION_UPDATE_MESSAGE);
  }

  const gate = assertCanCheckIn(existing);
  if (!gate.ok) {
    throw new Error(gate.message);
  }

  // Re-validate status immediately before write (covers a concurrent check-in).
  const transition = applyCheckInStatusTransition(existing.status);
  if (!transition.ok) {
    throw new Error(transition.message);
  }

  const now = Date.now();
  try {
    // Patch only check-in fields — does not replace the node, so queueOrder /
    // aheadOfYou / queueState writes from recalculateEntireQueue do not conflict.
    await update(resRef, {
      status: transition.nextStatus,
      checkedIn: true,
      checkedInAt: now,
      checkedInBy: secretaryUid,
      penaltyTimerExpiresAt: null,
      penaltyTimerStartedAt: null,
      becameCurrentTurnAt: null,
      penaltyTimerClearedAt: now,
    });
  } catch (error) {
    console.error("[checkInReservation] update failed", { reservationId, error });
    throw new Error(TEMPORARY_RESERVATION_UPDATE_MESSAGE);
  }

  // Idempotent confirm: if a parallel writer won, surface the true state.
  try {
    const confirm = await get(resRef);
    if (confirm.exists()) {
      const latest = confirm.val();
      if (latest.status === "checked_in" || latest.checkedIn) {
        const reservation = {
          id: reservationId,
          ...latest,
          status: "checked_in",
          checkedIn: true,
        };
        await recalculateQueueBestEffort(reservation.scheduleId);
        return reservation;
      }
    }
  } catch (error) {
    console.warn("[checkInReservation] confirm read failed", error?.message || error);
  }

  const reservation = { id: reservationId, ...existing, status: "checked_in", checkedIn: true };
  await recalculateQueueBestEffort(reservation.scheduleId);
  return reservation;
};

export const startConsultation = async (reservationId) => {
  assertCanMutateRealtime();
  const now = Date.now();
  const reservation = await commitReservationIf(
    reservationId,
    (current, abortMessage) => {
      const gate = assertCanStartConsultation(current);
      if (!gate.ok) {
        if (abortMessage) abortMessage.current = gate.message;
        return;
      }
      return {
        ...current,
        status: "in_consultation",
        consultationStartedAt: now,
      };
    },
    "Consultation can only start for a checked-in patient."
  );
  await recalculateQueueBestEffort(reservation.scheduleId);
};

export const sendToDoctor = async (reservationId) => {
  assertCanMutateRealtime();
  const now = Date.now();
  const reservation = await commitReservationIf(
    reservationId,
    (current, abortMessage) => {
      const gate = assertCanSendToDoctor(current);
      if (!gate.ok) {
        if (abortMessage) abortMessage.current = gate.message;
        return;
      }
      return {
        ...current,
        status: "with_doctor",
        sentToDoctorAt: now,
        consultationStartedAt: now,
      };
    },
    "Patient must be checked in before being sent to the doctor."
  );
  await recalculateQueueBestEffort(reservation.scheduleId);
};

export const completeConsultation = async (reservationId, doctorNotes) => {
  assertCanMutateRealtime();
  const now = Date.now();
  const reservation = await commitReservationIf(
    reservationId,
    (current, abortMessage) => {
      const gate = assertCanCompleteConsultation(current);
      if (!gate.ok) {
        if (abortMessage) abortMessage.current = gate.message;
        return;
      }
      return {
        ...current,
        status: "consultation_completed",
        consultationCompletedAt: now,
        doctorNotes: doctorNotes || "",
      };
    },
    "Only an active consultation can be completed."
  );
  await recalculateQueueBestEffort(reservation.scheduleId);
};

export const updatePatientInfo = async (reservationId, patientInfo) => {
  const reservation = await requireReservation(reservationId);
  const actor = await resolveActor();
  const gate = assertCanUpdatePatientInfo(reservation, actor);
  if (!gate.ok) throw new Error(gate.message);

  await update(ref(getDb(), `reservations/${reservationId}`), {
    ...patientInfo,
    patientInfoCompleted: true,
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

const PENALIZE_ALLOWED_STATUSES = new Set([
  "reserved",
  "waiting",
  "validation_open",
  "waiting_for_window",
]);

export const penalizeReservation = async (reservationId, schedule, allScheduleReservations = [], penaltyMoveBack) => {
  assertCanMutateRealtime();
  const branchId = await resolveScheduleBranchId(schedule);
  const queueConfig = await getQueueConfiguration(branchId);
  const moveBack = Number.isInteger(penaltyMoveBack) ? penaltyMoveBack : queueConfig.penaltyMoveBack;
  const timerMinutes = queueConfig.penaltyTimerMinutes;
  const now = Date.now();
  const forfeitOnZeroMoveBack = moveBack === 0;

  const scheduleIdHint = schedule?.id || null;
  const activePipeline = (allScheduleReservations || [])
    .filter(
      (r) =>
        (!scheduleIdHint || r.scheduleId === scheduleIdHint) &&
        ["reserved", "checked_in", "waiting", "validation_open", "waiting_for_window"].includes(r.status)
    )
    .sort((a, b) => {
      const timeA = a.sortTimestamp || a.createdAt || 0;
      const timeB = b.sortTimestamp || b.createdAt || 0;
      return timeA - timeB;
    });

  const index = activePipeline.findIndex((r) => r.id === reservationId);
  let newSortTimestamp = now;
  if (index >= 0 && activePipeline.length > 1 && !forfeitOnZeroMoveBack) {
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

  const pipelineAfterMove = activePipeline
    .map((r) => (r.id === reservationId ? { ...r, sortTimestamp: newSortTimestamp } : r))
    .sort((a, b) => {
      const timeA = a.sortTimestamp || a.createdAt || 0;
      const timeB = b.sortTimestamp || b.createdAt || 0;
      return timeA - timeB;
    });
  const newOrderIndex = pipelineAfterMove.findIndex((r) => r.id === reservationId);
  const plannedQueuePosition = newOrderIndex >= 0 ? newOrderIndex + 1 : null;

  const after = await commitReservationIf(
    reservationId,
    (current, abortMessage) => {
      if (!current || !PENALIZE_ALLOWED_STATUSES.has(current.status)) {
        if (abortMessage) {
          abortMessage.current = "This patient can no longer be penalized (status may have changed).";
        }
        return;
      }
      const nextCount = (current.penaltyCount || 0) + 1;
      if (forfeitOnZeroMoveBack) {
        return applyForfeitFields(current, {
          forfeitureReason:
            "Setting the Penalty Move-Back count to 0 results in an automatic forfeit for the parent.",
          penaltyCount: nextCount,
          now,
        });
      }
      const existingExpiry = Number(current.penaltyTimerExpiresAt) || 0;
      const keepFirstExpiry = existingExpiry > now;
      const penaltyTimerStartedAt = keepFirstExpiry ? current.penaltyTimerStartedAt || now : now;
      const penaltyTimerExpiresAt = keepFirstExpiry
        ? existingExpiry
        : now + timerMinutes * 60 * 1000;
      return {
        ...current,
        penaltyCount: nextCount,
        sortTimestamp: newSortTimestamp,
        lastPenalizedAt: now,
        queueOrder: plannedQueuePosition ?? current.queueOrder ?? current.queuePosition ?? 1,
        queuePosition: plannedQueuePosition ?? current.queueOrder ?? current.queuePosition ?? 1,
        penaltyTimerStartedAt,
        penaltyTimerExpiresAt,
        becameCurrentTurnAt: null,
      };
    },
    "This patient can no longer be penalized (status may have changed)."
  );

  if (after.status === "forfeited") {
    await requestSlotRelease(reservationId);
    logAuditEvent({
      action: AUDIT_ACTIONS.PATIENT_FORFEITED,
      category: AUDIT_CATEGORIES.QUEUE_INTERVENTION,
      description: `Forfeited Queue #${after.queueNumber} because Penalty Move-Back is 0`,
      targetType: "reservation",
      targetId: reservationId,
      branchId: schedule?.branch,
    });
  } else {
    logAuditEvent({
      action: AUDIT_ACTIONS.PATIENT_PENALIZED,
      category: AUDIT_CATEGORIES.QUEUE_INTERVENTION,
      description: `Penalized Queue #${after.queueNumber} and started/kept late timer (expires ${new Date(after.penaltyTimerExpiresAt).toLocaleTimeString()})`,
      targetType: "reservation",
      targetId: reservationId,
      branchId: schedule?.branch,
    });
  }
  if (after.scheduleId) {
    await recalculateEntireQueue(after.scheduleId);
  }
};

/**
 * Auto-forfeit a reservation whose penalty timer has expired. Idempotent via transaction.
 * @returns {Promise<boolean>} true when this caller applied the forfeit
 */
export const forfeitReservationIfTimerExpired = async (reservationId) => {
  if (!reservationId) return false;
  const resRef = ref(getDb(), `reservations/${reservationId}`);
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

  await requestSlotRelease(reservationId);
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
  assertCanMutateRealtime();
  await update(ref(getDb(), `reservations/${reservationId}`), {
    checkInRequestedAt: Date.now(),
  });
};

export const closeActiveReservationsForParent = async (parentId, { terminalStatus, reason }) => {
  if (!parentId) return;
  if (terminalStatus !== "cancelled" && terminalStatus !== "forfeited") {
    throw new Error("terminalStatus must be cancelled or forfeited.");
  }

  const q = query(
    ref(getDb(), "reservations"),
    orderByChild("parentId"),
    equalTo(parentId)
  );
  const snapshot = await get(q);
  if (!snapshot.exists()) return;

  const now = Date.now();
  const rootUpdates = {};
  const scheduleIds = new Set();
  const closedIds = [];

  Object.entries(snapshot.val()).forEach(([id, val]) => {
    if (!ACTIVE_RESERVATION_STATUSES.includes(val?.status)) return;
    closedIds.push(id);
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
    await update(ref(getDb()), rootUpdates);
    await Promise.all(closedIds.map((id) => requestSlotRelease(id)));
  }

  for (const scheduleId of scheduleIds) {
    await recalculateRollingValidation(scheduleId);
    await recalculateEntireQueue(scheduleId);
  }
};
