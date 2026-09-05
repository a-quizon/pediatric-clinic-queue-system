/**
 * Queue SMS copy + dispatch claims (Cloud Functions mirror).
 */

const admin = require("firebase-admin");
const { sendSms, normalizePhoneE164 } = require("./smsService");

const SMS_NOTIFICATION_EVENTS = new Set(["SLOT_RESERVED", "QUEUE_STARTED", "NEARING_TURN"]);

function db() {
  return admin.database();
}

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

async function getParentPhone(parentId) {
  if (!parentId) return "";
  const snap = await db().ref(`users/${parentId}`).once("value");
  if (!snap.exists()) return "";
  const user = snap.val() || {};
  return normalizePhoneE164(user.phone || user.phoneNumber || "");
}

async function resolveDoctorName(doctorId) {
  if (!doctorId) return "your doctor";
  const snap = await db().ref(`users/${doctorId}`).once("value");
  if (!snap.exists()) return "your doctor";
  const doc = snap.val() || {};
  const title = doc.professionalTitle || "Dr.";
  const name = doc.name || "Doctor";
  if (String(name).toLowerCase().startsWith("dr")) return name;
  return `${title} ${name}`.replace(/\s+/g, " ").trim();
}

async function buildSmsMessage(eventId, context = {}) {
  if (eventId === "QUEUE_STARTED") {
    const branch = context.branchName || context.branchId || "the clinic";
    const dateLabel = formatClinicDate(context.clinicDate);
    return (
      `Hello! The queue at ${branch} for ${dateLabel} has officially started. ` +
      `Please monitor your place in line and be ready when we notify you that your turn is near.`
    );
  }

  if (eventId === "NEARING_TURN") {
    const queueNumber = context.queueNumber != null ? context.queueNumber : "your";
    return (
      `Hello! There are now only 3 patients ahead of you` +
      (queueNumber !== "your" ? ` (Queue #${queueNumber})` : "") +
      `. Please make your way to the clinic and be ready for your turn. Thank you.`
    );
  }

  if (eventId === "SLOT_RESERVED") {
    const dateLabel = formatClinicDate(context.clinicDate);
    const open = formatTime(context.openingTime);
    const close = formatTime(context.closingTime);
    const timeRange = open && close ? `${open} – ${close}` : open || "clinic hours";
    const doctorName = context.doctorName || (await resolveDoctorName(context.doctorId));
    const branch = context.branchName || context.branchId || "clinic";
    const queueNumber = context.queueNumber != null ? context.queueNumber : "—";
    return (
      `Your clinic reservation is confirmed.\n` +
      `Date: ${dateLabel}\n` +
      `Time: ${timeRange}\n` +
      `Queue Number: ${queueNumber}\n` +
      `Doctor: ${doctorName}\n` +
      `Branch: ${branch}\n` +
      `Please keep this message for your visit. Thank you.`
    );
  }

  return context.customMessage || null;
}

async function claimSmsDispatch(parentId, notificationId) {
  if (!parentId || !notificationId) return true;
  const flagRef = db().ref(`notifications/${parentId}/${notificationId}/smsDispatchedAt`);
  const result = await flagRef.transaction((current) => {
    if (current) return;
    return Date.now();
  });
  return Boolean(result.committed && result.snapshot.exists());
}

async function deliverSmsForNotification(eventId, context = {}, notificationId) {
  if (!SMS_NOTIFICATION_EVENTS.has(eventId)) {
    return { success: false, skipped: true, reason: "not_sms_event" };
  }

  const safeId = notificationId ? sanitizeKey(notificationId) : null;
  if (safeId && context.parentId) {
    const claimed = await claimSmsDispatch(context.parentId, safeId);
    if (!claimed) return { success: true, skipped: true, reason: "already_dispatched" };
  }

  const phone = context.phone || (await getParentPhone(context.parentId));
  if (!phone) return { success: false, skipped: true, reason: "no_phone" };

  const message = await buildSmsMessage(eventId, context);
  if (!message) return { success: false, skipped: true, reason: "no_message" };

  return sendSms(phone, message);
}

async function enrichSmsContext(eventId, context = {}) {
  const enriched = { ...context };
  const scheduleId = context.scheduleId || context.entityId;
  if (!scheduleId) return enriched;

  if (!enriched.clinicDate || !enriched.openingTime || !enriched.doctorId) {
    const snap = await db().ref(`schedules/${scheduleId}`).once("value");
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

  if (context.reservationId && enriched.queueNumber == null) {
    const resSnap = await db().ref(`reservations/${context.reservationId}`).once("value");
    if (resSnap.exists()) {
      const reservation = resSnap.val() || {};
      enriched.queueNumber =
        reservation.queueNumber ?? reservation.originalQueueNumber ?? reservation.queuePosition;
    }
  }

  return enriched;
}

function computeAheadOfYouForSms(reservation, allReservations = []) {
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
  deliverSmsForNotification,
  enrichSmsContext,
  computeAheadOfYouForSms,
};
