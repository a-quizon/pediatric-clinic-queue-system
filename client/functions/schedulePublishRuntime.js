const { manilaDateString, manilaNowMinutes } = require("./manilaDate");
const { checkScheduleOpening, branchesMatch } = require("./scheduleOpeningRules");
const { databaseFor } = require("./rtdbRouter");

const STAFF_ROLES = new Set(["doctor", "secretary"]);
const MAX_DAYS_PER_REQUEST = 62;

function coded(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function listFrom(snap) {
  if (!snap.exists()) return [];
  return Object.entries(snap.val() || {}).map(([id, value]) => ({ id, ...value }));
}

function secretaryOwnsBranch(user, branch) {
  if (user.assignedBranchId && branch.id) return user.assignedBranchId === branch.id;
  return branchesMatch(user.assignedBranch, branch.name);
}

function resolveDoctor(user, callerUid, users) {
  if (user.role === "doctor") return { doctorId: callerUid, doctorEmail: user.email || "" };
  const doctor = users.find((item) => item.role === "doctor" && item.status === "active");
  if (doctor) return { doctorId: doctor.id, doctorEmail: doctor.email || user.email || "" };
  return { doctorId: callerUid, doctorEmail: user.email || "" };
}

function normalizeDays(days) {
  if (!Array.isArray(days) || days.length === 0) {
    throw coded("invalid-argument", "Choose at least one date to post.");
  }
  if (days.length > MAX_DAYS_PER_REQUEST) {
    throw coded("invalid-argument", `You can post at most ${MAX_DAYS_PER_REQUEST} days at once.`);
  }
  return days.map((day) => {
    const slotCapacity = Number(day?.slotCapacity);
    if (!Number.isInteger(slotCapacity) || slotCapacity < 1) {
      throw coded("invalid-argument", "Slots must be a whole number of at least 1.");
    }
    return { dateStr: String(day?.dateStr || ""), slotCapacity };
  });
}

/**
 * Server-authoritative "post a day" for doctors and secretaries. Every date is
 * checked with checkScheduleOpening (past date, today's closing time, closures,
 * duplicates). Single mode rejects; bulk mode skips invalid days.
 */
async function publishClinicDays({ admin, callerUid, payload, now = new Date() }) {
  if (!callerUid) throw coded("unauthenticated", "You must be signed in.");
  const db = databaseFor(admin);

  const usersSnap = await db.ref("users").once("value");
  const users = listFrom(usersSnap);
  const user = users.find((item) => item.id === callerUid);
  if (!user || user.isDeleted === true || (user.status && user.status !== "active")) {
    throw coded("permission-denied", "Account is not active.");
  }
  if (!STAFF_ROLES.has(user.role)) {
    throw coded("permission-denied", "Only a doctor or secretary can post clinic days.");
  }

  const mode = payload?.mode === "bulk" ? "bulk" : "single";
  const days = normalizeDays(payload?.days);
  if (mode === "single" && days.length !== 1) {
    throw coded("invalid-argument", "Post one day at a time.");
  }

  const branches = listFrom(await db.ref("branchConfigurations").once("value"));
  const branch = branches.find(
    (item) =>
      (payload?.branchId && item.id === payload.branchId) ||
      branchesMatch(item.name, payload?.branchName)
  );
  if (!branch) throw coded("not-found", "Branch not found.");
  if (user.role === "secretary" && !secretaryOwnsBranch(user, branch)) {
    throw coded("permission-denied", "You can only post days for your assigned branch.");
  }

  const schedules = listFrom(await db.ref("schedules").once("value"));
  const closures = listFrom(await db.ref("clinicClosures").once("value"));
  const today = manilaDateString(now);
  const nowMinutes = manilaNowMinutes(now);
  const doctor = resolveDoctor(user, callerUid, users);
  const publishedAt = now.getTime();

  const updates = {};
  const posted = [];
  const skipped = [];
  for (const day of days) {
    const check = checkScheduleOpening({
      dateStr: day.dateStr,
      branch,
      schedules,
      closures,
      today,
      nowMinutes,
    });
    if (!check.ok) {
      if (mode === "single") throw coded("failed-precondition", check.message);
      skipped.push({ dateStr: day.dateStr, code: check.code, skip: check.message });
      continue;
    }
    const scheduleId = db.ref("schedules").push().key;
    const record = {
      ...doctor,
      createdBy: callerUid,
      createdByRole: user.role,
      branch: branch.name,
      branchId: branch.id,
      clinicDate: day.dateStr,
      openingTime: check.hours.openingTime,
      closingTime: check.hours.closingTime,
      slotCapacity: day.slotCapacity,
      status: "published",
      queueStatus: "not_started",
      isReady: false,
      publishedAt,
    };
    updates[`schedules/${scheduleId}`] = record;
    schedules.push({ id: scheduleId, ...record });
    posted.push({ dateStr: day.dateStr, scheduleId, slotCapacity: day.slotCapacity });
  }

  if (posted.length === 0) {
    throw coded("failed-precondition", "None of these days can be posted.");
  }
  await db.ref().update(updates);

  return { branchId: branch.id, branchName: branch.name, posted, skipped };
}

module.exports = { publishClinicDays };
