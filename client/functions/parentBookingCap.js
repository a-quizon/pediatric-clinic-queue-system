const MULTI_DATE_CAP = 2;

/**
 * Atomic multi-date booking cap (H2).
 * Node: parentBookingCaps/{parentId} = { dates: { "YYYY-MM-DD": scheduleId }, updatedAt }
 */
async function claimParentDateCap(db, parentId, clinicDate, scheduleId, { cap = MULTI_DATE_CAP, onOverCap } = {}) {
  const capRef = db.ref(`parentBookingCaps/${parentId}`);
  const result = await capRef.transaction((current) => {
    const dates = { ...(current && current.dates ? current.dates : {}) };
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
