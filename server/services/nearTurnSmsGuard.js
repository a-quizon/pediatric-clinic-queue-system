/**
 * Near Turn SMS is sent at most once per parent account, ever.
 *
 * State lives on `users/{parentId}/nearTurnSms`:
 *   { sentAt, reservationId }            — delivered; never cleared
 *   { pendingToken, pendingAt, ... }     — a sender holds the claim right now
 *
 * The claim is a transaction, so concurrent triggers can't both send. `sentAt`
 * is written only after the provider accepts the SMS; a failed send releases
 * the claim so a later reservation can still deliver the first warning.
 * Cancel / forfeit / penalty / new reservations never touch this node.
 */

const NEAR_TURN_SMS_PENDING_TTL_MS = 2 * 60 * 1000;

function nearTurnSmsRef(db, parentId) {
  return db.ref(`users/${parentId}/nearTurnSms`);
}

function hasNearTurnSmsBeenSent(state) {
  return Boolean(state && Number(state.sentAt) > 0);
}

function hasFreshPendingClaim(state, now) {
  return Boolean(
    state &&
      state.pendingToken &&
      now - Number(state.pendingAt || 0) < NEAR_TURN_SMS_PENDING_TTL_MS
  );
}

async function readNearTurnSmsState(db, parentId) {
  if (!parentId) return null;
  const snap = await nearTurnSmsRef(db, parentId).once("value");
  return snap.exists() ? snap.val() : null;
}

/**
 * Returns `{ claimed: true, token }` only for the caller that won the claim.
 * Otherwise `{ claimed: false, reason: "already_sent_to_account" | "send_in_progress" }`.
 */
async function claimAccountNearTurnSms(db, parentId, { reservationId = null, now = Date.now() } = {}) {
  if (!parentId) return { claimed: false, reason: "no_parent" };
  const token = `${now}_${Math.random().toString(36).slice(2, 10)}`;
  let abortReason = null;

  const result = await nearTurnSmsRef(db, parentId).transaction((current) => {
    if (hasNearTurnSmsBeenSent(current)) {
      abortReason = "already_sent_to_account";
      return;
    }
    if (hasFreshPendingClaim(current, now)) {
      abortReason = "send_in_progress";
      return;
    }
    abortReason = null;
    return { pendingToken: token, pendingAt: now, reservationId };
  });

  const won = Boolean(result.committed && result.snapshot.val()?.pendingToken === token);
  if (won) return { claimed: true, token };
  return { claimed: false, reason: abortReason || "already_sent_to_account" };
}

async function confirmAccountNearTurnSms(db, parentId, { reservationId = null, now = Date.now() } = {}) {
  await nearTurnSmsRef(db, parentId).transaction((current) => {
    if (hasNearTurnSmsBeenSent(current)) return current;
    return { sentAt: now, reservationId: reservationId || current?.reservationId || null };
  });
}

async function releaseAccountNearTurnSms(db, parentId, token) {
  await nearTurnSmsRef(db, parentId).transaction((current) => {
    if (!current || hasNearTurnSmsBeenSent(current) || current.pendingToken !== token) return;
    return null;
  });
}

/**
 * Single entry point for the Near Turn SMS. `send(phone, message)` must resolve
 * to the smsService result shape (`{ success, ... }`).
 */
async function sendNearTurnSmsOnce({
  db,
  parentId,
  reservationId = null,
  phone,
  message,
  send,
  logPrefix = "[sms]",
  now = () => Date.now(),
}) {
  const claim = await claimAccountNearTurnSms(db, parentId, { reservationId, now: now() });
  if (!claim.claimed) {
    console.log(`${logPrefix} Near Turn SMS skipped: already sent to account #${parentId} (${claim.reason})`);
    return { success: true, skipped: true, reason: claim.reason };
  }

  let sendResult;
  try {
    sendResult = await send(phone, message);
  } catch (err) {
    sendResult = { success: false, reason: "network_error", error: err.message };
  }

  try {
    if (sendResult?.success) {
      await confirmAccountNearTurnSms(db, parentId, { reservationId, now: now() });
    } else {
      await releaseAccountNearTurnSms(db, parentId, claim.token);
      console.error(`${logPrefix} Near Turn SMS claim released after send failure account #${parentId}`);
    }
  } catch (err) {
    console.error(`${logPrefix} failed to update Near Turn SMS account state #${parentId}:`, err.message);
  }

  return sendResult;
}

module.exports = {
  NEAR_TURN_SMS_PENDING_TTL_MS,
  hasNearTurnSmsBeenSent,
  readNearTurnSmsState,
  claimAccountNearTurnSms,
  confirmAccountNearTurnSms,
  releaseAccountNearTurnSms,
  sendNearTurnSmsOnce,
};
