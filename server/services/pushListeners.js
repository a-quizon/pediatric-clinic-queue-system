const { getDb } = require("./firebaseAdmin");
const { handleReservationChange, handleScheduleChange } = require("./notificationEngine");

function cloneRecord(key, value) {
  if (!value || typeof value !== "object") return null;
  return { id: key, ...value };
}

async function startRealtimePushListeners() {
  const db = getDb();
  const prevReservations = {};
  const prevSchedules = {};

  const reservationsSnap = await db.ref("reservations").once("value");
  if (reservationsSnap.exists()) {
    Object.entries(reservationsSnap.val()).forEach(([id, value]) => {
      prevReservations[id] = cloneRecord(id, value);
    });
  }

  const schedulesSnap = await db.ref("schedules").once("value");
  if (schedulesSnap.exists()) {
    Object.entries(schedulesSnap.val()).forEach(([id, value]) => {
      prevSchedules[id] = cloneRecord(id, value);
    });
  }

  const reservationsRef = db.ref("reservations");
  reservationsRef.on("child_added", async (snap) => {
    if (prevReservations[snap.key]) return;
    const after = cloneRecord(snap.key, snap.val());
    prevReservations[snap.key] = after;
    try {
      // New reservations (before=null) trigger SLOT_RESERVED SMS / notifications
      await handleReservationChange(null, after);
    } catch (err) {
      console.error("[pushListeners] reservation add failed:", err);
    }
  });
  reservationsRef.on("child_changed", async (snap) => {
    const before = prevReservations[snap.key] || null;
    const after = cloneRecord(snap.key, snap.val());
    prevReservations[snap.key] = after;
    try {
      await handleReservationChange(before, after);
    } catch (err) {
      console.error("[pushListeners] reservation change failed:", err);
    }
  });
  reservationsRef.on("child_removed", (snap) => {
    delete prevReservations[snap.key];
  });

  const schedulesRef = db.ref("schedules");
  schedulesRef.on("child_added", async (snap) => {
    if (prevSchedules[snap.key]) return;
    const after = cloneRecord(snap.key, snap.val());
    prevSchedules[snap.key] = after;
    try {
      await handleScheduleChange(null, after);
    } catch (err) {
      console.error("[pushListeners] schedule add failed:", err);
    }
  });
  schedulesRef.on("child_changed", async (snap) => {
    const before = prevSchedules[snap.key] || null;
    const after = cloneRecord(snap.key, snap.val());
    prevSchedules[snap.key] = after;
    try {
      await handleScheduleChange(before, after);
    } catch (err) {
      console.error("[pushListeners] schedule change failed:", err);
    }
  });
  schedulesRef.on("child_removed", (snap) => {
    delete prevSchedules[snap.key];
  });

  console.log("[pushListeners] Realtime RTDB push dispatcher is running");
}

module.exports = { startRealtimePushListeners };
