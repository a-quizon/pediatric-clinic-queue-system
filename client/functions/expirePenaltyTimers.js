const admin = require("firebase-admin");
const { UNCHECKED_WAITING_STATUSES, recalculateEntireQueueAdmin } = require("./queueRuntime");

const PENALTY_TIMER_FORFEIT_REASON =
  "Did not check in before the late penalty timer expired.";

function db() {
  return admin.database();
}

function applyForfeitFields(current, now) {
  return {
    ...current,
    status: "forfeited",
    forfeitureReason: PENALTY_TIMER_FORFEIT_REASON,
    forfeitedAt: now,
    penalizedAt: now,
    queueState: "FORFEITED",
    penaltyTimerExpiresAt: null,
    penaltyTimerStartedAt: null,
    becameCurrentTurnAt: null,
  };
}

async function expirePenaltyTimers() {
  const now = Date.now();
  const snap = await db()
    .ref("reservations")
    .orderByChild("penaltyTimerExpiresAt")
    .startAt(1)
    .endAt(now)
    .once("value");

  if (!snap.exists()) {
    return { forfeited: 0 };
  }

  const scheduleIds = new Set();
  let forfeited = 0;
  const ids = [];
  snap.forEach((child) => {
    ids.push(child.key);
  });

  for (const id of ids) {
    const result = await db().ref(`reservations/${id}`).transaction((current) => {
      if (!current) return;
      if (!UNCHECKED_WAITING_STATUSES.includes(current.status)) return;
      const expiresAt = Number(current.penaltyTimerExpiresAt) || 0;
      if (!expiresAt || expiresAt > Date.now()) return;
      return applyForfeitFields(current, Date.now());
    });

    if (!result.committed || !result.snapshot.exists()) continue;
    const after = result.snapshot.val();
    if (after.status !== "forfeited") continue;
    forfeited += 1;
    if (after.scheduleId) scheduleIds.add(after.scheduleId);
  }

  for (const scheduleId of scheduleIds) {
    try {
      await recalculateEntireQueueAdmin(scheduleId);
    } catch (err) {
      console.error(`expirePenaltyTimers: recalc failed for ${scheduleId}`, err.message);
    }
  }

  return { forfeited };
}

module.exports = { expirePenaltyTimers, PENALTY_TIMER_FORFEIT_REASON };
