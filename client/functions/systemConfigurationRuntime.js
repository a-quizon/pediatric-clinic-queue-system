const { databaseFor } = require("./rtdbRouter");

const STAFF_ROLES = new Set(["doctor", "secretary"]);

const MIN_PENALTY_MOVE_BACK = 0;
const MAX_PENALTY_MOVE_BACK = 10;
const DEFAULT_PENALTY_MOVE_BACK = 2;

const MIN_PENALTY_TIMER_MINUTES = 5;
const MAX_PENALTY_TIMER_MINUTES = 30;
const DEFAULT_PENALTY_TIMER_MINUTES = 15;

const MIN_PENALTY_GRACE_MINUTES = 0;
const MAX_PENALTY_GRACE_MINUTES = 5;
const DEFAULT_PENALTY_GRACE_MINUTES = 2;

const MIN_SLOT_CAPACITY = 1;
const MAX_SLOT_CAPACITY = 200;
const DEFAULT_SLOT_CAPACITY = 30;

const MIN_NEARING_TURN_AHEAD = 1;
const MAX_NEARING_TURN_AHEAD = 10;
const DEFAULT_NEARING_TURN_AHEAD = 3;
const MAX_SMS_TEMPLATE_LENGTH = 320;

const SMS_TEMPLATE_PLACEHOLDERS = [
  "count",
  "queueNumber",
  "queuePosition",
  "minutes",
  "branch",
  "date",
  "timeRange",
  "doctor",
  "reason",
];

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
  templateSlotReservedActiveQueue:
    "You reserved a slot on an active Queue. Queue Number: {queueNumber}. Queue Position: {queuePosition}. Please monitor your queue.",
  templatePenalized:
    "You were marked late and moved back in line (Queue #{queueNumber}, position {queuePosition}). Please validate your QR at {branch} within {minutes} minutes or this reservation will be forfeited.",
  templateForfeited:
    "Your reservation (Queue #{queueNumber}) at {branch} on {date} was forfeited because you did not check in on time. You may still book a new slot on the same schedule if slots are available.",
  templateClinicCancelled:
    "The clinic at {branch} is closed on {date} ({reason}). Your reservation was cancelled. It does not count as a no-show. Book another open day when you are ready.",
};

const LEGACY_GLOBAL_KEYS = new Set(["queue", "sms"]);

function coded(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function isUsableBranchId(branchId) {
  return typeof branchId === "string" && branchId.trim() !== "" && !LEGACY_GLOBAL_KEYS.has(branchId);
}

function validateBoundedInteger(value, { min, max, emptyLabel, noun }) {
  if (value === null || value === undefined || value === "") {
    return { valid: false, error: `${emptyLabel} cannot be empty` };
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    return { valid: false, error: `${noun} must be a whole number` };
  }
  if (parsed < min) {
    return { valid: false, error: `${noun} must be at least ${min}` };
  }
  if (parsed > max) {
    return { valid: false, error: `${noun} cannot exceed ${max}` };
  }
  return { valid: true, value: parsed };
}

function validatePenaltyMoveBack(value) {
  return validateBoundedInteger(value, {
    min: MIN_PENALTY_MOVE_BACK,
    max: MAX_PENALTY_MOVE_BACK,
    emptyLabel: "Value",
    noun: "Value",
  });
}

function validatePenaltyTimerMinutes(value) {
  return validateBoundedInteger(value, {
    min: MIN_PENALTY_TIMER_MINUTES,
    max: MAX_PENALTY_TIMER_MINUTES,
    emptyLabel: "Penalty timer",
    noun: "Penalty timer",
  });
}

function validatePenaltyGraceMinutes(value) {
  return validateBoundedInteger(value, {
    min: MIN_PENALTY_GRACE_MINUTES,
    max: MAX_PENALTY_GRACE_MINUTES,
    emptyLabel: "Penalty grace period",
    noun: "Penalty grace period",
  });
}

function validateSlotCapacity(value) {
  return validateBoundedInteger(value, {
    min: MIN_SLOT_CAPACITY,
    max: MAX_SLOT_CAPACITY,
    emptyLabel: "Slot capacity",
    noun: "Slot capacity",
  });
}

function validateNearingTurnAheadCount(value) {
  return validateBoundedInteger(value, {
    min: MIN_NEARING_TURN_AHEAD,
    max: MAX_NEARING_TURN_AHEAD,
    emptyLabel: "Patients-ahead value",
    noun: "Patients-ahead",
  });
}

function findUnknownPlaceholders(template) {
  const matches = String(template || "").matchAll(/\{([a-zA-Z]+)\}/g);
  const unknown = [];
  for (const match of matches) {
    if (!SMS_TEMPLATE_PLACEHOLDERS.includes(match[1]) && !unknown.includes(match[1])) {
      unknown.push(match[1]);
    }
  }
  return unknown;
}

function validateSmsTemplate(value, label = "Message") {
  if (value === null || value === undefined) {
    return { valid: false, error: `${label} cannot be empty` };
  }
  const trimmed = String(value).trim();
  if (!trimmed) {
    return { valid: false, error: `${label} cannot be empty` };
  }
  if (trimmed.length > MAX_SMS_TEMPLATE_LENGTH) {
    return {
      valid: false,
      error: `${label} cannot exceed ${MAX_SMS_TEMPLATE_LENGTH} characters`,
    };
  }
  const unknown = findUnknownPlaceholders(trimmed);
  if (unknown.length > 0) {
    return {
      valid: false,
      error: `${label} has unknown placeholder(s): {${unknown.join("}, {")}}`,
    };
  }
  return { valid: true, value: trimmed };
}

function validateSmsConfiguration(input = {}) {
  const ahead = validateNearingTurnAheadCount(input.nearingTurnAheadCount);
  if (!ahead.valid) return ahead;

  const slot = validateSmsTemplate(input.templateSlotReserved, "Reservation Confirmed message");
  if (!slot.valid) return slot;

  const started = validateSmsTemplate(input.templateQueueStarted, "Queue Started message");
  if (!started.valid) return started;

  const near = validateSmsTemplate(input.templateNearingTurn, "Near Turn message");
  if (!near.valid) return near;

  const activeSlot = validateSmsTemplate(
    input.templateSlotReservedActiveQueue,
    "Active Queue Reservation message"
  );
  if (!activeSlot.valid) return activeSlot;

  const penalized = validateSmsTemplate(input.templatePenalized, "Penalty message");
  if (!penalized.valid) return penalized;

  const forfeited = validateSmsTemplate(input.templateForfeited, "Forfeiture message");
  if (!forfeited.valid) return forfeited;

  const clinicCancelled = validateSmsTemplate(input.templateClinicCancelled, "Clinic closed message");
  if (!clinicCancelled.valid) return clinicCancelled;

  return {
    valid: true,
    value: {
      nearingTurnAheadCount: ahead.value,
      templateSlotReserved: slot.value,
      templateQueueStarted: started.value,
      templateNearingTurn: near.value,
      templateSlotReservedActiveQueue: activeSlot.value,
      templatePenalized: penalized.value,
      templateForfeited: forfeited.value,
      templateClinicCancelled: clinicCancelled.value,
    },
  };
}

function parseQueueRules(data) {
  const move = validatePenaltyMoveBack(data?.penaltyMoveBack ?? DEFAULT_PENALTY_MOVE_BACK);
  const timer = validatePenaltyTimerMinutes(data?.penaltyTimerMinutes ?? DEFAULT_PENALTY_TIMER_MINUTES);
  const grace = validatePenaltyGraceMinutes(data?.penaltyGraceMinutes ?? DEFAULT_PENALTY_GRACE_MINUTES);
  const capacity = validateSlotCapacity(data?.defaultSlotCapacity ?? DEFAULT_SLOT_CAPACITY);
  return {
    penaltyMoveBack: move.valid ? move.value : DEFAULT_PENALTY_MOVE_BACK,
    penaltyTimerMinutes: timer.valid ? timer.value : DEFAULT_PENALTY_TIMER_MINUTES,
    penaltyGraceMinutes: grace.valid ? grace.value : DEFAULT_PENALTY_GRACE_MINUTES,
    defaultSlotCapacity: capacity.valid ? capacity.value : DEFAULT_SLOT_CAPACITY,
  };
}

function parseSmsConfig(data) {
  const ahead = validateNearingTurnAheadCount(data?.nearingTurnAheadCount ?? DEFAULT_NEARING_TURN_AHEAD);
  const slot = validateSmsTemplate(
    data?.templateSlotReserved ?? DEFAULT_SMS_TEMPLATES.templateSlotReserved,
    "Reservation Confirmed message"
  );
  const started = validateSmsTemplate(
    data?.templateQueueStarted ?? DEFAULT_SMS_TEMPLATES.templateQueueStarted,
    "Queue Started message"
  );
  const near = validateSmsTemplate(
    data?.templateNearingTurn ?? DEFAULT_SMS_TEMPLATES.templateNearingTurn,
    "Near Turn message"
  );
  const activeSlot = validateSmsTemplate(
    data?.templateSlotReservedActiveQueue ?? DEFAULT_SMS_TEMPLATES.templateSlotReservedActiveQueue,
    "Active Queue Reservation message"
  );
  const penalized = validateSmsTemplate(
    data?.templatePenalized ?? DEFAULT_SMS_TEMPLATES.templatePenalized,
    "Penalty message"
  );
  const forfeited = validateSmsTemplate(
    data?.templateForfeited ?? DEFAULT_SMS_TEMPLATES.templateForfeited,
    "Forfeiture message"
  );
  const clinicCancelled = validateSmsTemplate(
    data?.templateClinicCancelled ?? DEFAULT_SMS_TEMPLATES.templateClinicCancelled,
    "Clinic closed message"
  );

  return {
    nearingTurnAheadCount: ahead.valid ? ahead.value : DEFAULT_NEARING_TURN_AHEAD,
    templateSlotReserved: slot.valid ? slot.value : DEFAULT_SMS_TEMPLATES.templateSlotReserved,
    templateQueueStarted: started.valid ? started.value : DEFAULT_SMS_TEMPLATES.templateQueueStarted,
    templateNearingTurn: near.valid ? near.value : DEFAULT_SMS_TEMPLATES.templateNearingTurn,
    templateSlotReservedActiveQueue: activeSlot.valid
      ? activeSlot.value
      : DEFAULT_SMS_TEMPLATES.templateSlotReservedActiveQueue,
    templatePenalized: penalized.valid ? penalized.value : DEFAULT_SMS_TEMPLATES.templatePenalized,
    templateForfeited: forfeited.valid ? forfeited.value : DEFAULT_SMS_TEMPLATES.templateForfeited,
    templateClinicCancelled: clinicCancelled.valid
      ? clinicCancelled.value
      : DEFAULT_SMS_TEMPLATES.templateClinicCancelled,
  };
}

function validateQueueRulesInput(input = {}) {
  const move = validatePenaltyMoveBack(input.penaltyMoveBack);
  if (!move.valid) return move;
  const timer = validatePenaltyTimerMinutes(input.penaltyTimerMinutes);
  if (!timer.valid) return timer;
  const grace = validatePenaltyGraceMinutes(input.penaltyGraceMinutes);
  if (!grace.valid) return grace;
  const capacity = validateSlotCapacity(input.defaultSlotCapacity);
  if (!capacity.valid) return capacity;
  return {
    valid: true,
    value: {
      penaltyMoveBack: move.value,
      penaltyTimerMinutes: timer.value,
      penaltyGraceMinutes: grace.value,
      defaultSlotCapacity: capacity.value,
    },
  };
}

async function assertStaffCaller(db, callerUid, branchId) {
  if (!callerUid) throw coded("unauthenticated", "You must be signed in.");
  if (!isUsableBranchId(branchId)) {
    throw coded("invalid-argument", "Branch is required.");
  }

  const userSnap = await db.ref(`users/${callerUid}`).once("value");
  if (!userSnap.exists()) throw coded("permission-denied", "Account is not active.");
  const user = userSnap.val() || {};
  if (user.isDeleted === true || (user.status && user.status !== "active")) {
    throw coded("permission-denied", "Account is not active.");
  }
  if (!STAFF_ROLES.has(user.role)) {
    throw coded("permission-denied", "Only a doctor or secretary can update branch rules.");
  }

  const branchSnap = await db.ref(`branchConfigurations/${branchId}`).once("value");
  if (!branchSnap.exists()) throw coded("not-found", "Branch not found.");

  if (user.role === "secretary" && user.assignedBranchId !== branchId) {
    throw coded("permission-denied", "You can only update rules for your assigned branch.");
  }

  return {
    uid: callerUid,
    name: user.name || user.displayName || "Unknown User",
    role: user.role,
    branchName: branchSnap.val()?.name || branchId,
  };
}

async function writeConfigAudit(db, entry) {
  const auditRef = db.ref("auditLogs").push();
  await auditRef.set({
    timestamp: Date.now(),
    ...entry,
  });
  return auditRef.key;
}

function queueRulesEqual(a, b) {
  return (
    a.penaltyMoveBack === b.penaltyMoveBack &&
    a.penaltyTimerMinutes === b.penaltyTimerMinutes &&
    a.penaltyGraceMinutes === b.penaltyGraceMinutes &&
    a.defaultSlotCapacity === b.defaultSlotCapacity
  );
}

function smsRulesEqual(a, b) {
  return (
    a.nearingTurnAheadCount === b.nearingTurnAheadCount &&
    a.templateSlotReserved === b.templateSlotReserved &&
    a.templateQueueStarted === b.templateQueueStarted &&
    a.templateNearingTurn === b.templateNearingTurn &&
    a.templateSlotReservedActiveQueue === b.templateSlotReservedActiveQueue &&
    a.templatePenalized === b.templatePenalized &&
    a.templateForfeited === b.templateForfeited &&
    a.templateClinicCancelled === b.templateClinicCancelled
  );
}

function describeQueueChanges(before, after) {
  const changes = [];
  if (before.penaltyMoveBack !== after.penaltyMoveBack) {
    changes.push(`penalty move-back ${before.penaltyMoveBack} → ${after.penaltyMoveBack}`);
  }
  if (before.penaltyTimerMinutes !== after.penaltyTimerMinutes) {
    changes.push(`penalty timer ${before.penaltyTimerMinutes} → ${after.penaltyTimerMinutes} min`);
  }
  if (before.penaltyGraceMinutes !== after.penaltyGraceMinutes) {
    changes.push(`penalty grace ${before.penaltyGraceMinutes} → ${after.penaltyGraceMinutes} min`);
  }
  if (before.defaultSlotCapacity !== after.defaultSlotCapacity) {
    changes.push(`default slots ${before.defaultSlotCapacity} → ${after.defaultSlotCapacity}`);
  }
  return changes;
}

function describeSmsChanges(before, after) {
  const changes = [];
  if (before.nearingTurnAheadCount !== after.nearingTurnAheadCount) {
    changes.push(`near-turn ahead ${before.nearingTurnAheadCount} → ${after.nearingTurnAheadCount}`);
  }
  if (before.templateSlotReserved !== after.templateSlotReserved) {
    changes.push("reservation SMS template");
  }
  if (before.templateQueueStarted !== after.templateQueueStarted) {
    changes.push("queue-started SMS template");
  }
  if (before.templateNearingTurn !== after.templateNearingTurn) {
    changes.push("near-turn SMS template");
  }
  if (before.templateSlotReservedActiveQueue !== after.templateSlotReservedActiveQueue) {
    changes.push("active-queue reservation SMS template");
  }
  if (before.templatePenalized !== after.templatePenalized) {
    changes.push("penalty SMS template");
  }
  if (before.templateForfeited !== after.templateForfeited) {
    changes.push("forfeiture SMS template");
  }
  if (before.templateClinicCancelled !== after.templateClinicCancelled) {
    changes.push("clinic-closed SMS template");
  }
  return changes;
}

/**
 * Server-authoritative queue rules update for doctor/secretary. Writes audit only after a successful change.
 */
async function updateQueueRules({ admin, callerUid, branchId, queueRules }) {
  const db = databaseFor(admin);
  const actor = await assertStaffCaller(db, callerUid, branchId);

  const validation = validateQueueRulesInput(queueRules || {});
  if (!validation.valid) {
    throw coded("invalid-argument", validation.error);
  }
  const next = validation.value;

  const configRef = db.ref(`systemConfiguration/${branchId}`);
  const snap = await configRef.once("value");
  const existing = snap.exists() ? snap.val() : null;
  const before = parseQueueRules(existing);

  if (queueRulesEqual(before, next)) {
    return { unchanged: true, branchId, queueRules: before };
  }

  const now = Date.now();
  const updates = {
    penaltyMoveBack: next.penaltyMoveBack,
    penaltyTimerMinutes: next.penaltyTimerMinutes,
    penaltyGraceMinutes: next.penaltyGraceMinutes,
    defaultSlotCapacity: next.defaultSlotCapacity,
    updatedAt: now,
  };

  // Seed SMS defaults when creating a missing branch config node.
  if (!existing?.sms) {
    updates.sms = {
      ...parseSmsConfig(null),
      updatedAt: now,
    };
  }

  await configRef.update(updates);

  const changes = describeQueueChanges(before, next);
  await writeConfigAudit(db, {
    action: "QUEUE_RULES_UPDATED",
    category: "system_management",
    actorUid: actor.uid,
    actorName: actor.name,
    actorRole: actor.role,
    description: `Updated queue rules for ${actor.branchName} (${changes.join(", ")})`,
    targetType: "systemConfiguration",
    targetId: branchId,
    branchId,
    metadata: { before, after: next, changes },
  });

  return { unchanged: false, branchId, queueRules: next, changes };
}

/**
 * Server-authoritative SMS rules update for doctor/secretary. Writes audit only after a successful change.
 */
async function updateSmsRules({ admin, callerUid, branchId, sms }) {
  const db = databaseFor(admin);
  const actor = await assertStaffCaller(db, callerUid, branchId);

  const validation = validateSmsConfiguration(sms || {});
  if (!validation.valid) {
    throw coded("invalid-argument", validation.error);
  }
  const next = validation.value;

  const configRef = db.ref(`systemConfiguration/${branchId}`);
  const snap = await configRef.once("value");
  const existing = snap.exists() ? snap.val() : null;
  const before = parseSmsConfig(existing?.sms);

  if (smsRulesEqual(before, next)) {
    return { unchanged: true, branchId, sms: before };
  }

  const now = Date.now();
  const updates = {
    [`sms/nearingTurnAheadCount`]: next.nearingTurnAheadCount,
    [`sms/templateSlotReserved`]: next.templateSlotReserved,
    [`sms/templateQueueStarted`]: next.templateQueueStarted,
    [`sms/templateNearingTurn`]: next.templateNearingTurn,
    [`sms/templateSlotReservedActiveQueue`]: next.templateSlotReservedActiveQueue,
    [`sms/templatePenalized`]: next.templatePenalized,
    [`sms/templateForfeited`]: next.templateForfeited,
    [`sms/templateClinicCancelled`]: next.templateClinicCancelled,
    [`sms/updatedAt`]: now,
    updatedAt: now,
  };

  // Seed queue defaults when creating a missing branch config node.
  if (!existing) {
    const queueDefaults = parseQueueRules(null);
    updates.penaltyMoveBack = queueDefaults.penaltyMoveBack;
    updates.penaltyTimerMinutes = queueDefaults.penaltyTimerMinutes;
    updates.penaltyGraceMinutes = queueDefaults.penaltyGraceMinutes;
    updates.defaultSlotCapacity = queueDefaults.defaultSlotCapacity;
  }

  await configRef.update(updates);

  const changes = describeSmsChanges(before, next);
  await writeConfigAudit(db, {
    action: "SMS_RULES_UPDATED",
    category: "system_management",
    actorUid: actor.uid,
    actorName: actor.name,
    actorRole: actor.role,
    description: `Updated SMS rules for ${actor.branchName} (${changes.join(", ")})`,
    targetType: "systemConfiguration",
    targetId: branchId,
    branchId,
    metadata: { before, after: next, changes },
  });

  return { unchanged: false, branchId, sms: next, changes };
}

module.exports = {
  updateQueueRules,
  updateSmsRules,
  validateQueueRulesInput,
  validateSmsConfiguration,
  parseQueueRules,
  parseSmsConfig,
};
