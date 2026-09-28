const MULTI_DATE_CAP = 2;

/**
 * Atomic multi-date booking cap (H2).
 * Node: parentBookingCaps/{parentId} = { dates: { "YYYY-MM-DD": scheduleId }, updatedAt }
 */
const STALE_CAP_MS = 2 * 60 * 1000;

/**
 * Drops dates with no active reservation (a cancel/forfeit whose release was
 * missed). Only applied when the cap node has been idle long enough that no
 * other claim for this parent can still be in flight.
 */
function pruneStaleDates(dates, current, activeDates, clinicDate, now) {
  if (!activeDates) return dates;
  if (now - Number(current?.updatedAt || 0) <= STALE_CAP_MS) return dates;
  const next = {};
  Object.entries(dates).forEach(([date, scheduleId]) => {
    if (date === clinicDate || activeDates.has(date)) next[date] = scheduleId;
  });
  return next;
}

async function claimParentDateCap(
  db,
  parentId,
  clinicDate,
  scheduleId,
  { cap = MULTI_DATE_CAP, onOverCap, activeDates = null } = {}
) {
  const capRef = db.ref(`parentBookingCaps/${parentId}`);
  const result = await capRef.transaction((current) => {
    const dates = pruneStaleDates(
      { ...(current && current.dates ? current.dates : {}) },
      current,
      activeDates,
      clinicDate,
      Date.now()
    );
    if (dates[clinicDate]) {
      return { dates, updatedAt: Date.now() };
    }
    if (Object.keys(dates).length >= cap) {
      return;
    }
    dates[clinicDate] = scheduleId;
    return { dates, updatedAt: Date.now() };
  });
  if (!result.committed) {
    if (typeof onOverCap === "function") onOverCap();
    return null;
  }
  return capRef;
}

async function releaseParentDateCap(db, parentId, clinicDate) {
  if (!parentId || !clinicDate) return;
  const capRef = db.ref(`parentBookingCaps/${parentId}`);
  await capRef.transaction((current) => {
    if (!current || !current.dates) return current;
    if (!Object.prototype.hasOwnProperty.call(current.dates, clinicDate)) return current;
    const dates = { ...current.dates };
    delete dates[clinicDate];
    if (Object.keys(dates).length === 0) return null;
    return { dates, updatedAt: Date.now() };
  });
}

module.exports = {
  MULTI_DATE_CAP,
  claimParentDateCap,
  releaseParentDateCap,
};
