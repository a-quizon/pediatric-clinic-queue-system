/**
 * One-time backfill for users/{parentId}/nearTurnSms from existing records.
 *
 * Evidence, strongest first:
 *   1. notifications/{parentId}/{id} with type NEARING_TURN and smsDispatchedAt
 *   2. reservations/{id}/nearTurnSmsSent === true (opt-in: this per-ticket claim
 *      was taken before the SMS was attempted, so it can include failed sends
 *      or parents without a phone number)
 */

const { hasNearTurnSmsBeenSent } = require("./nearTurnSmsGuard");

function planNearTurnSmsBackfill(
  { users = {}, notifications = {}, reservations = {} } = {},
  { includeReservationFlags = false, now = Date.now() } = {}
) {
  const plan = new Map();
  const consider = (parentId, entry) => {
    const user = users[parentId];
    if (!user || user.role !== "parent") return;
    if (hasNearTurnSmsBeenSent(user.nearTurnSms)) return;
    const existing = plan.get(parentId);
    if (!existing || entry.sentAt < existing.sentAt) plan.set(parentId, entry);
  };

  for (const [parentId, byId] of Object.entries(notifications || {})) {
    for (const [notificationId, notification] of Object.entries(byId || {})) {
      if (notification?.type !== "NEARING_TURN") continue;
      const dispatchedAt = Number(notification.smsDispatchedAt);
      if (!(dispatchedAt > 0)) continue;
      consider(parentId, {
        sentAt: dispatchedAt,
        reservationId: notification.reservationId || null,
        source: `notifications/${parentId}/${notificationId}`,
      });
    }
  }

  if (includeReservationFlags) {
    for (const [reservationId, reservation] of Object.entries(reservations || {})) {
      if (reservation?.nearTurnSmsSent !== true || !reservation.parentId) continue;
      consider(reservation.parentId, {
        sentAt: Number(reservation.updatedAt || reservation.createdAt) || now,
        reservationId,
        source: `reservations/${reservationId}`,
      });
    }
  }

  return [...plan.entries()].map(([parentId, entry]) => ({ parentId, ...entry }));
}

async function applyNearTurnSmsBackfill(db, plan = []) {
  let written = 0;
  for (const entry of plan) {
    const result = await db.ref(`users/${entry.parentId}/nearTurnSms`).transaction((current) => {
      if (hasNearTurnSmsBeenSent(current)) return;
      return { sentAt: entry.sentAt, reservationId: entry.reservationId || null, backfilled: true };
    });
    if (result.committed) written += 1;
  }
  return written;
}

module.exports = {
  planNearTurnSmsBackfill,
  applyNearTurnSmsBackfill,
};
