/**
 * Slot accounting for `schedules/{id}/booking`.
 *
 * booking = {
 *   activeSlotCount,        // always == number of holders (kept for UI + rules)
 *   nextQueueNumber,
 *   holdersTracked: true,   // distinguishes an empty holders map from a legacy counter
 *   holders: { [reservationId]: claimedAtMs },
 * }
 *
 * Every mutation runs inside a transaction on the booking node, so claims and
 * releases for the same schedule are serialized and cannot double-book.
 */

const ACTIVE_STATUSES = new Set([
  "reserved",
  "checked_in",
  "waiting",
  "in_consultation",
  "with_doctor",
  "validation_open",
  "waiting_for_window",
]);

const TERMINAL_STATUSES = new Set([
  "cancelled",
  "cancelled_by_clinic",
  "forfeited",
  "consultation_completed",
  "completed",
  "expired",
  "validation_expired",
  "penalized",
  "late_limit_reached",
]);

/** A holder with no reservation record after this long is an abandoned claim. */
const ABANDONED_HOLDER_MS = 2 * 60 * 1000;

/**
 * Splits a schedule's reservation rows into the id sets the claim transaction needs.
 * @param {Object<string, object>|null} rowsById reservations keyed by id
 */
function classifyReservations(rowsById) {
  const activeIds = new Set();
  const terminalIds = new Set();
  const knownIds = new Set();
  let maxQueue = 0;
  Object.entries(rowsById || {}).forEach(([id, row]) => {
    knownIds.add(id);
    if (ACTIVE_STATUSES.has(row?.status)) activeIds.add(id);
    else if (TERMINAL_STATUSES.has(row?.status)) terminalIds.add(id);
    maxQueue = Math.max(maxQueue, Number(row?.queueNumber || row?.originalQueueNumber || 0));
  });
  return { activeIds, terminalIds, knownIds, maxQueue };
}

function withCount(booking) {
  const holders = booking.holders || {};
  return {
    ...booking,
    holdersTracked: true,
    holders,
    activeSlotCount: Object.keys(holders).length,
  };
}

/** Current holders map, seeding legacy/missing bookings from active reservations. */
function currentHolders(current, activeIds, now) {
  if (current && current.holdersTracked) return { ...(current.holders || {}) };
  const seeded = {};
  (activeIds || new Set()).forEach((id) => {
    seeded[id] = now;
  });
  return seeded;
}

/** Drops holders that are provably no longer consuming a slot. */
function pruneHolders(holders, { terminalIds, knownIds, now }) {
  const next = {};
  Object.entries(holders || {}).forEach(([id, claimedAt]) => {
    if (terminalIds && terminalIds.has(id)) return;
    const abandoned =
      knownIds && !knownIds.has(id) && now - Number(claimedAt || 0) > ABANDONED_HOLDER_MS;
    if (abandoned) return;
    next[id] = claimedAt;
  });
  return next;
}

/**
 * Transaction updater for a claim. Returns the new booking, or undefined (abort)
 * when the schedule is full after pruning.
 */
function applyClaim(current, { reservationId, capacity, activeIds, terminalIds, knownIds, maxQueue = 0, now }) {
  const holders = pruneHolders(currentHolders(current, activeIds, now), { terminalIds, knownIds, now });
  if (holders[reservationId]) {
    return withCount({ ...(current || {}), holders });
  }
  if (Object.keys(holders).length >= capacity) return undefined;
  holders[reservationId] = now;
  const count = Object.keys(holders).length;
  const storedNext = Number(current?.nextQueueNumber || 0);
  const next = Math.max(storedNext, Number(maxQueue || 0) + 1, count);
  return withCount({ ...(current || {}), holders, nextQueueNumber: next + 1 });
}

/** Queue number assigned by a committed claim. */
function claimedQueueNumber(booking) {
  return Number(booking?.nextQueueNumber) - 1;
}

/**
 * Transaction updater for a release. Idempotent: releasing an id that is not
 * held leaves the booking unchanged. Legacy counters (no holders) are only
 * decremented when the caller has already won the one-time release flag.
 */
function applyRelease(current, reservationId, { allowLegacyDecrement = false } = {}) {
  if (!current) return current;
  if (!current.holdersTracked) {
    if (!allowLegacyDecrement) return current;
    return {
      ...current,
      activeSlotCount: Math.max(0, Number(current.activeSlotCount || 0) - 1),
      nextQueueNumber: current.nextQueueNumber || 1,
    };
  }
  const holders = { ...(current.holders || {}) };
  if (!holders[reservationId]) return current;
  delete holders[reservationId];
  return withCount({ ...current, holders });
}

module.exports = {
  ACTIVE_STATUSES,
  TERMINAL_STATUSES,
  ABANDONED_HOLDER_MS,
  classifyReservations,
  pruneHolders,
  applyClaim,
  applyRelease,
  claimedQueueNumber,
};
