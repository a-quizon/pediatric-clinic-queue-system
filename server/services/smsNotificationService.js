/**
 * Queue-related SMS copy + once-per-event dispatch claims (shared by Express + Functions).
 */

const { getDb } = require("./firebaseAdmin");
const { sendSms, normalizePhoneE164 } = require("./smsService");

/** Events that send an automated SMS in addition to push / notification center. */
const SMS_NOTIFICATION_EVENTS = new Set([
  "SLOT_RESERVED",
  "QUEUE_STARTED",
  "NEARING_TURN",
]);

const MIN_NEARING_TURN_AHEAD = 1;
const MAX_NEARING_TURN_AHEAD = 10;
const DEFAULT_NEARING_TURN_AHEAD = 3;
const MAX_SMS_TEMPLATE_LENGTH = 320;

/** Previous merged Queue Started template — migrate RTDB copies back to the simple default. */
const LEGACY_MERGED_QUEUE_STARTED_TEMPLATE =
  "Hello! The queue at {branch} for {date} has officially started. " +
  "Please monitor your place in line and be ready when we notify you that your turn is near. " +
  "Here's your Reservation details:\n" +
  "Date: {date}\n" +
  "Queue Number: {queueNumber}";

const ALLOWED_PLACEHOLDERS = new Set([
  "count",
  "queueNumber",
  "branch",
  "date",
  "timeRange",
  "doctor",
]);

const DEFAULT_SMS_TEMPLATES = {
  templateSlotReserved:
    "Your clinic reservation is confirmed.\n" +
    "Date: {date}\n" +
    "Time: {timeRange}\n" +
    "Queue Number: {queueNumber}\n" +
    "Doctor: {doctor}\n" +
    "Branch: {branch}\n" +
    "Please keep this message for your visit. Thank you.",
  templateQueueStarted:
    "The queue at {branch} for {date} has started. " +
    "Please monitor your place in line and be ready when we notify you that your turn is near.",
  templateNearingTurn:
    "Only {count} patients ahead (Queue #{queueNumber}). Please head to the clinic now.",
};

function sanitizeKey(value) {
  return String(value || "").replace(/[.#$\[\]]/g, "_");
}

function formatClinicDate(clinicDate) {
  if (!clinicDate) return "your clinic date";
  try {
    return new Date(`${clinicDate}T00:00:00`).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return clinicDate;
  }
}

function formatTime(hhmm) {
  if (!hhmm || typeof hhmm !== "string") return "";
  const [hStr, mStr] = hhmm.split(":");
  const h = Number(hStr);
  const m = Number(mStr);
  if (Number.isNaN(h)) return hhmm;
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 || 12;
  const mins = Number.isNaN(m) ? "00" : String(m).padStart(2, "0");
  return `${hour12}:${mins} ${period}`;
}

function sanitizeTemplate(value, fallback) {
  const trimmed = String(value || "").trim();
  if (!trimmed || trimmed.length > MAX_SMS_TEMPLATE_LENGTH) return fallback;
  const matches = trimmed.matchAll(/\{([a-zA-Z]+)\}/g);
  for (const match of matches) {
    if (!ALLOWED_PLACEHOLDERS.has(match[1])) return fallback;
  }
  return trimmed;
}

function sanitizeAheadCount(value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return DEFAULT_NEARING_TURN_AHEAD;
  if (parsed < MIN_NEARING_TURN_AHEAD || parsed > MAX_NEARING_TURN_AHEAD) {
    return DEFAULT_NEARING_TURN_AHEAD;
  }
  return parsed;
}

function parseSmsConfig(data) {
  const storedQueueStarted = String(data?.templateQueueStarted || "").trim();
  const queueStartedSource =
    !storedQueueStarted || storedQueueStarted === LEGACY_MERGED_QUEUE_STARTED_TEMPLATE
      ? DEFAULT_SMS_TEMPLATES.templateQueueStarted
      : storedQueueStarted;

  return {
    nearingTurnAheadCount: sanitizeAheadCount(
      data?.nearingTurnAheadCount ?? DEFAULT_NEARING_TURN_AHEAD
    ),
    templateSlotReserved: sanitizeTemplate(
      data?.templateSlotReserved,
      DEFAULT_SMS_TEMPLATES.templateSlotReserved
    ),
    templateQueueStarted: sanitizeTemplate(
      queueStartedSource,
      DEFAULT_SMS_TEMPLATES.templateQueueStarted
    ),
    templateNearingTurn: sanitizeTemplate(
      data?.templateNearingTurn,
      DEFAULT_SMS_TEMPLATES.templateNearingTurn
    ),
  };
}

async function getSmsConfiguration() {
  try {
    const snap = await getDb().ref("systemConfiguration/sms").once("value");
    return parseSmsConfig(snap.exists() ? snap.val() : null);
  } catch (err) {
    console.error("[sms] failed to load systemConfiguration/sms:", err.message);
    return parseSmsConfig(null);
  }
}

function applySmsTemplate(template, vars = {}) {
  return String(template || "").replace(/\{([a-zA-Z]+)\}/g, (full, key) => {
    if (!ALLOWED_PLACEHOLDERS.has(key)) return full;
    const value = vars[key];
    if (value === null || value === undefined || value === "") return "";
    return String(value);
  });
}

function buildNearingTurnPushMessage(count = DEFAULT_NEARING_TURN_AHEAD) {
  const safeCount = sanitizeAheadCount(count);
  return `There are only ${safeCount} patients ahead of you. Please proceed to the clinic.`;
}

async function getParentPhone(parentId) {
  if (!parentId) return "";
  const snap = await getDb().ref(`users/${parentId}`).once("value");
  if (!snap.exists()) return "";
  const user = snap.val() || {};
  return normalizePhoneE164(user.phone || user.phoneNumber || "");
}

async function resolveDoctorName(doctorId) {
  if (!doctorId) return "your doctor";
  const snap = await getDb().ref(`users/${doctorId}`).once("value");
  if (!snap.exists()) return "your doctor";
  const doc = snap.val() || {};
  const title = doc.professionalTitle || "Dr.";
  const name = doc.name || "Doctor";
  if (String(name).toLowerCase().startsWith("dr")) return name;
  return `${title} ${name}`.replace(/\s+/g, " ").trim();
}

async function buildTemplateVars(eventId, context = {}, config) {
  const branch = context.branchName || context.branchId || "the clinic";
  const dateLabel = formatClinicDate(context.clinicDate);
  const open = formatTime(context.openingTime);
  const close = formatTime(context.closingTime);
  const timeRange = open && close ? `${open} – ${close}` : open || "clinic hours";
  const doctorName =
    context.doctorName || (await resolveDoctorName(context.doctorId)) || "your doctor";
  const queueNumber =
    context.queueNumber != null && context.queueNumber !== ""
      ? context.queueNumber
      : "—";
  const count =
    context.nearingTurnAheadCount != null
      ? sanitizeAheadCount(context.nearingTurnAheadCount)
      : config.nearingTurnAheadCount;

  return {
    count,
    queueNumber,
    branch: eventId === "SLOT_RESERVED" ? branch.replace(/^the /, "") || "clinic" : branch,
    date: dateLabel,
    timeRange,
    doctor: doctorName,
  };
}

async function buildSmsMessage(eventId, context = {}) {
  const config = await getSmsConfiguration();
  const vars = await buildTemplateVars(eventId, context, config);

  let template = null;
  if (eventId === "QUEUE_STARTED") {
    template = config.templateQueueStarted;
  } else if (eventId === "NEARING_TURN") {
    template = config.templateNearingTurn;
  } else if (eventId === "SLOT_RESERVED") {
    template = config.templateSlotReserved;
  } else {
    return context.customMessage || null;
  }

  const message = applySmsTemplate(template, vars).trim();
  return message || null;
}

async function claimSmsDispatch(parentId, notificationId) {
  if (!parentId || !notificationId) return true;
  const flagRef = getDb().ref(`notifications/${parentId}/${notificationId}/smsDispatchedAt`);
  const result = await flagRef.transaction((current) => {
    if (current) return;
    return Date.now();
  });
  return Boolean(result.committed && result.snapshot.exists());
}

/**
 * Send SMS for an eligible notification event. Idempotent via smsDispatchedAt.
 */
async function deliverSmsForNotification(eventId, context = {}, notificationId) {
  if (!SMS_NOTIFICATION_EVENTS.has(eventId)) {
    return { success: false, skipped: true, reason: "not_sms_event" };
  }

  const safeId = notificationId ? sanitizeKey(notificationId) : null;
  if (safeId && context.parentId) {
    const claimed = await claimSmsDispatch(context.parentId, safeId);
    if (!claimed) {
      return { success: true, skipped: true, reason: "already_dispatched" };
    }
  }

  const phone = context.phone || (await getParentPhone(context.parentId));
  if (!phone) {
    return { success: false, skipped: true, reason: "no_phone" };
  }

  const message = await buildSmsMessage(eventId, context);
  if (!message) {
    return { success: false, skipped: true, reason: "no_message" };
  }

  return sendSms(phone, message);
}

/**
 * Enrich SLOT_RESERVED / QUEUE_STARTED / NEARING_TURN context from schedule + reservation.
 */
async function enrichSmsContext(eventId, context = {}) {
  const enriched = { ...context };
  if (!context.scheduleId && !context.entityId && !context.reservationId) return enriched;

  const scheduleId = context.scheduleId || context.entityId;
  if (scheduleId && (!enriched.clinicDate || !enriched.openingTime || !enriched.doctorId)) {
    const snap = await getDb().ref(`schedules/${scheduleId}`).once("value");
    if (snap.exists()) {
      const schedule = snap.val() || {};
      enriched.clinicDate = enriched.clinicDate || schedule.clinicDate;
      enriched.openingTime = enriched.openingTime || schedule.openingTime;
      enriched.closingTime = enriched.closingTime || schedule.closingTime;
      enriched.doctorId = enriched.doctorId || schedule.doctorId;
      enriched.branchName = enriched.branchName || schedule.branch;
      enriched.branchId = enriched.branchId || schedule.branch;
    }
  }

  if (eventId === "SLOT_RESERVED" && !enriched.doctorName) {
    enriched.doctorName = await resolveDoctorName(enriched.doctorId);
  }

  if (context.reservationId && (enriched.queueNumber == null || enriched.queueNumber === "")) {
    const resSnap = await getDb().ref(`reservations/${context.reservationId}`).once("value");
    if (resSnap.exists()) {
      const reservation = resSnap.val() || {};
      enriched.queueNumber =
        reservation.queueNumber ?? reservation.originalQueueNumber ?? reservation.queuePosition;
    }
  }

  return enriched;
}

function computeAheadOfYou(reservation, allReservations = []) {
  if (!reservation) return 0;
  if (
    ["with_doctor", "in_consultation", "completed", "consultation_completed", "cancelled", "forfeited"].includes(
      reservation.status
    )
  ) {
    return 0;
  }

  const activePipeline = allReservations
    .filter(
      (item) =>
        item.scheduleId === reservation.scheduleId &&
        [
          "reserved",
          "waiting",
          "validation_open",
          "waiting_for_window",
          "checked_in",
          "with_doctor",
          "in_consultation",
        ].includes(item.status)
    )
    .sort((a, b) => (a.sortTimestamp || a.createdAt || 0) - (b.sortTimestamp || b.createdAt || 0));

  const index = activePipeline.findIndex((item) => item.id === reservation.id);
  return index > 0 ? index : 0;
}

module.exports = {
  SMS_NOTIFICATION_EVENTS,
  DEFAULT_NEARING_TURN_AHEAD,
  deliverSmsForNotification,
  enrichSmsContext,
  buildSmsMessage,
  formatClinicDate,
  formatTime,
  getSmsConfiguration,
  buildNearingTurnPushMessage,
  computeAheadOfYouForSms: computeAheadOfYou,
};
