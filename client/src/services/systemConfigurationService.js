import { database } from "../firebase/database";
import { ref, get, update, onValue } from "firebase/database";
import { logAuditEvent, AUDIT_ACTIONS, AUDIT_CATEGORIES } from "./auditService";
import { branchesMatch } from "../utils/stringUtils";

const MAX_PENALTY_MOVE_BACK = 10;
const MIN_PENALTY_MOVE_BACK = 0;
const DEFAULT_PENALTY_MOVE_BACK = 2;

export const MIN_LATE_LIMIT = 1;
export const MAX_LATE_LIMIT = 10;
export const DEFAULT_LATE_LIMIT = 3;

export const MIN_NEARING_TURN_AHEAD = 1;
export const MAX_NEARING_TURN_AHEAD = 10;
export const DEFAULT_NEARING_TURN_AHEAD = 3;
export const MAX_SMS_TEMPLATE_LENGTH = 320;

const LEGACY_GLOBAL_KEYS = new Set(["queue", "sms"]);

export const SMS_TEMPLATE_PLACEHOLDERS = [
  "count",
  "queueNumber",
  "branch",
  "date",
  "timeRange",
  "doctor",
];

export const DEFAULT_SMS_TEMPLATES = {
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
};

/** Previous merged Queue Started template — migrate RTDB copies back to the simple default. */
const LEGACY_MERGED_QUEUE_STARTED_TEMPLATE =
  "Hello! The queue at {branch} for {date} has officially started. " +
  "Please monitor your place in line and be ready when we notify you that your turn is near. " +
  "Here's your Reservation details:\n" +
  "Date: {date}\n" +
  "Queue Number: {queueNumber}";

export const isUsableBranchId = (branchId) =>
  typeof branchId === "string" && branchId.trim() !== "" && !LEGACY_GLOBAL_KEYS.has(branchId);

const branchConfigPath = (branchId) => `systemConfiguration/${branchId}`;

const noopUnsub = () => {};

/**
 * Validates the penalty move back value.
 * @param {any} value
 * @returns {{ valid: boolean, value?: number, error?: string }}
 */
export const validatePenaltyMoveBack = (value) => {
  if (value === null || value === undefined || value === "") {
    return { valid: false, error: "Value cannot be empty" };
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    return { valid: false, error: "Value must be a whole number" };
  }

  if (parsed < MIN_PENALTY_MOVE_BACK) {
    return { valid: false, error: `Value must be at least ${MIN_PENALTY_MOVE_BACK}` };
  }

  if (parsed > MAX_PENALTY_MOVE_BACK) {
    return { valid: false, error: `Value cannot exceed ${MAX_PENALTY_MOVE_BACK}` };
  }

  return { valid: true, value: parsed };
};

/**
 * Validates the per-branch late limit (max penalties before forfeit).
 */
export const validateLateLimit = (value) => {
  if (value === null || value === undefined || value === "") {
    return { valid: false, error: "Late Limit cannot be empty" };
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    return { valid: false, error: "Late Limit must be a whole number" };
  }

  if (parsed < MIN_LATE_LIMIT) {
    return { valid: false, error: `Late Limit must be at least ${MIN_LATE_LIMIT}` };
  }

  if (parsed > MAX_LATE_LIMIT) {
    return { valid: false, error: `Late Limit cannot exceed ${MAX_LATE_LIMIT}` };
  }

  return { valid: true, value: parsed };
};

const parsePenaltyMoveBack = (value) => {
  const validation = validatePenaltyMoveBack(value);
  return validation.valid ? validation.value : DEFAULT_PENALTY_MOVE_BACK;
};

const parseLateLimitValue = (value) => {
  const validation = validateLateLimit(value);
  return validation.valid ? validation.value : DEFAULT_LATE_LIMIT;
};

/**
 * Parses the configuration object to ensure safe fallbacks.
 */
const parseQueueConfig = (data) => ({
  penaltyMoveBack: parsePenaltyMoveBack(data?.penaltyMoveBack),
});

/**
 * True when an existing schedule still carries its own saved lateLimit.
 * New schedules omit the field and read live from the branch config.
 */
export const hasOwnScheduleLateLimit = (schedule) => {
  const parsed = Number(schedule?.lateLimit);
  return Number.isFinite(parsed) && parsed >= MIN_LATE_LIMIT;
};

/**
 * Validates near-turn patients-ahead count.
 * @param {any} value
 * @returns {{ valid: boolean, value?: number, error?: string }}
 */
export const validateNearingTurnAheadCount = (value) => {
  if (value === null || value === undefined || value === "") {
    return { valid: false, error: "Patients-ahead value cannot be empty" };
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    return { valid: false, error: "Patients-ahead must be a whole number" };
  }

  if (parsed < MIN_NEARING_TURN_AHEAD) {
    return { valid: false, error: `Patients-ahead must be at least ${MIN_NEARING_TURN_AHEAD}` };
  }

  if (parsed > MAX_NEARING_TURN_AHEAD) {
    return { valid: false, error: `Patients-ahead cannot exceed ${MAX_NEARING_TURN_AHEAD}` };
  }

  return { valid: true, value: parsed };
};

const findUnknownPlaceholders = (template) => {
  const matches = String(template || "").matchAll(/\{([a-zA-Z]+)\}/g);
  const unknown = [];
  for (const match of matches) {
    if (!SMS_TEMPLATE_PLACEHOLDERS.includes(match[1]) && !unknown.includes(match[1])) {
      unknown.push(match[1]);
    }
  }
  return unknown;
};

/**
 * Validates one SMS template string.
 * @param {any} value
 * @param {string} label
 * @returns {{ valid: boolean, value?: string, error?: string }}
 */
export const validateSmsTemplate = (value, label = "Message") => {
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
};

/**
 * Validates a full SMS configuration payload.
 */
export const validateSmsConfiguration = (input = {}) => {
  const ahead = validateNearingTurnAheadCount(input.nearingTurnAheadCount);
  if (!ahead.valid) return ahead;

  const slot = validateSmsTemplate(input.templateSlotReserved, "Reservation Confirmed message");
  if (!slot.valid) return slot;

  const started = validateSmsTemplate(input.templateQueueStarted, "Queue Started message");
  if (!started.valid) return started;

  const near = validateSmsTemplate(input.templateNearingTurn, "Near Turn message");
  if (!near.valid) return near;

  return {
    valid: true,
    value: {
      nearingTurnAheadCount: ahead.value,
      templateSlotReserved: slot.value,
      templateQueueStarted: started.value,
      templateNearingTurn: near.value,
    },
  };
};

const parseSmsConfig = (data) => {
  const aheadValidation = validateNearingTurnAheadCount(
    data?.nearingTurnAheadCount ?? DEFAULT_NEARING_TURN_AHEAD
  );

  const storedQueueStarted = String(
    data?.templateQueueStarted ?? DEFAULT_SMS_TEMPLATES.templateQueueStarted
  ).trim();
  const queueStartedSource =
    storedQueueStarted === LEGACY_MERGED_QUEUE_STARTED_TEMPLATE
      ? DEFAULT_SMS_TEMPLATES.templateQueueStarted
      : storedQueueStarted;

  const slot = validateSmsTemplate(
    data?.templateSlotReserved ?? DEFAULT_SMS_TEMPLATES.templateSlotReserved,
    "Reservation Confirmed message"
  );
  const started = validateSmsTemplate(queueStartedSource, "Queue Started message");
  const near = validateSmsTemplate(
    data?.templateNearingTurn ?? DEFAULT_SMS_TEMPLATES.templateNearingTurn,
    "Near Turn message"
  );

  return {
    nearingTurnAheadCount: aheadValidation.valid
      ? aheadValidation.value
      : DEFAULT_NEARING_TURN_AHEAD,
    templateSlotReserved: slot.valid
      ? slot.value
      : DEFAULT_SMS_TEMPLATES.templateSlotReserved,
    templateQueueStarted: started.valid
      ? started.value
      : DEFAULT_SMS_TEMPLATES.templateQueueStarted,
    templateNearingTurn: near.valid
      ? near.value
      : DEFAULT_SMS_TEMPLATES.templateNearingTurn,
  };
};

const parseBranchConfig = (data) => ({
  penaltyMoveBack: parsePenaltyMoveBack(data?.penaltyMoveBack),
  lateLimit: parseLateLimitValue(data?.lateLimit),
  sms: parseSmsConfig(data?.sms),
});

const isBranchConfigSeeded = (data) =>
  Boolean(
    data &&
      (data.penaltyMoveBack !== undefined ||
        data.lateLimit !== undefined ||
        (data.sms && typeof data.sms === "object"))
  );

const readLegacyGlobal = async () => {
  try {
    const [queueSnap, smsSnap] = await Promise.all([
      get(ref(database, "systemConfiguration/queue")),
      get(ref(database, "systemConfiguration/sms")),
    ]);
    return {
      queue: queueSnap.exists() ? queueSnap.val() : null,
      sms: smsSnap.exists() ? smsSnap.val() : null,
    };
  } catch (error) {
    console.warn("Could not read legacy global systemConfiguration:", error);
    return { queue: null, sms: null };
  }
};

const lookupBranchIdByName = async (name) => {
  if (!name) return null;
  try {
    const snap = await get(ref(database, "branchConfigurations"));
    if (!snap.exists()) return null;
    const match = Object.entries(snap.val()).find(
      ([id, value]) => id === name || branchesMatch(value?.name, name)
    );
    return match ? match[0] : null;
  } catch (error) {
    console.error("Failed to resolve branch id by name:", error);
    return null;
  }
};

/**
 * Stable branchConfigurations key for a schedule (prefers schedule.branchId).
 */
export const resolveScheduleBranchId = async (schedule) => {
  if (!schedule) return null;
  if (isUsableBranchId(schedule.branchId)) {
    try {
      const snap = await get(ref(database, `branchConfigurations/${schedule.branchId}`));
      if (snap.exists()) return schedule.branchId;
    } catch (error) {
      console.warn("Could not verify schedule.branchId:", error);
    }
  }
  return lookupBranchIdByName(schedule.branch);
};

/**
 * Seed a branch node from legacy global config (or defaults) when missing.
 */
export const ensureBranchSystemConfiguration = async (branchId) => {
  if (!isUsableBranchId(branchId)) {
    return parseBranchConfig(null);
  }

  const path = branchConfigPath(branchId);
  let existing = null;
  try {
    const snap = await get(ref(database, path));
    existing = snap.exists() ? snap.val() : null;
  } catch (error) {
    console.error("Failed to read branch system configuration:", error);
  }

  if (isBranchConfigSeeded(existing)) {
    return parseBranchConfig(existing);
  }

  const legacy = await readLegacyGlobal();
  const parsed = parseBranchConfig({
    penaltyMoveBack: existing?.penaltyMoveBack ?? legacy.queue?.penaltyMoveBack,
    lateLimit: existing?.lateLimit,
    sms: existing?.sms ?? legacy.sms,
  });

  try {
    await update(ref(database, path), {
      penaltyMoveBack: parsed.penaltyMoveBack,
      lateLimit: parsed.lateLimit,
      sms: {
        ...parsed.sms,
        updatedAt: Date.now(),
      },
      updatedAt: Date.now(),
    });
  } catch (error) {
    console.error("Failed to seed branch system configuration:", error);
  }

  return parsed;
};

export const getBranchSystemConfiguration = async (branchId) => {
  if (!isUsableBranchId(branchId)) {
    return parseBranchConfig(null);
  }
  return ensureBranchSystemConfiguration(branchId);
};

/**
 * Fetches queue configuration for a branch.
 */
export const getQueueConfiguration = async (branchId) => {
  const config = await getBranchSystemConfiguration(branchId);
  return { penaltyMoveBack: config.penaltyMoveBack };
};

/**
 * Helper to fetch just the penalty move back value.
 */
export const getPenaltyMoveBack = async (branchId) => {
  const config = await getQueueConfiguration(branchId);
  return config.penaltyMoveBack;
};

/**
 * Subscribes to the queue configuration for real-time updates.
 */
export const subscribeToQueueConfiguration = (branchId, callback) => {
  if (typeof callback !== "function") return noopUnsub;
  if (!isUsableBranchId(branchId)) {
    callback(parseQueueConfig(null));
    return noopUnsub;
  }

  ensureBranchSystemConfiguration(branchId).catch(() => {});

  return onValue(
    ref(database, branchConfigPath(branchId)),
    (snapshot) => {
      callback(parseQueueConfig(snapshot.val()));
    },
    (error) => {
      console.error("Queue config subscription error:", error);
      callback(parseQueueConfig(null));
    }
  );
};

/**
 * Updates the penalty move back value and logs an audit event.
 */
export const updatePenaltyMoveBack = async (branchId, newValue) => {
  if (!isUsableBranchId(branchId)) {
    throw new Error("Branch is required to update Penalty Move-Back");
  }

  const validation = validatePenaltyMoveBack(newValue);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const newSafeValue = validation.value;
  await ensureBranchSystemConfiguration(branchId);
  const currentConfig = await getQueueConfiguration(branchId);
  const currentValue = currentConfig.penaltyMoveBack;

  if (currentValue === newSafeValue) {
    return;
  }

  await update(ref(database, branchConfigPath(branchId)), {
    penaltyMoveBack: newSafeValue,
    updatedAt: Date.now(),
  });

  logAuditEvent({
    action: AUDIT_ACTIONS.SYSTEM_CONFIGURATION_CHANGED,
    category: AUDIT_CATEGORIES.SYSTEM_MANAGEMENT,
    description: `Changed Queue Penalty Move-Back from ${currentValue} to ${newSafeValue}`,
    targetType: "systemConfiguration",
    targetId: branchId,
    branchId,
  });
};

export const getLateLimit = async (branchId) => {
  const config = await getBranchSystemConfiguration(branchId);
  return config.lateLimit;
};

export const updateLateLimit = async (branchId, newValue) => {
  if (!isUsableBranchId(branchId)) {
    throw new Error("Branch is required to update Late Limit");
  }

  const validation = validateLateLimit(newValue);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const newSafeValue = validation.value;
  await ensureBranchSystemConfiguration(branchId);
  const currentValue = await getLateLimit(branchId);

  if (currentValue === newSafeValue) {
    return;
  }

  await update(ref(database, branchConfigPath(branchId)), {
    lateLimit: newSafeValue,
    updatedAt: Date.now(),
  });

  logAuditEvent({
    action: AUDIT_ACTIONS.SYSTEM_CONFIGURATION_CHANGED,
    category: AUDIT_CATEGORIES.SYSTEM_MANAGEMENT,
    description: `Changed Late Limit from ${currentValue} to ${newSafeValue}`,
    targetType: "systemConfiguration",
    targetId: branchId,
    branchId,
  });
};

/**
 * Hybrid Late Limit: saved per-schedule value for existing records, else live branch config.
 */
export const resolveLateLimitForSchedule = async (schedule) => {
  if (hasOwnScheduleLateLimit(schedule)) {
    return Number(schedule.lateLimit);
  }
  const branchId = await resolveScheduleBranchId(schedule);
  return getLateLimit(branchId);
};

/**
 * Fetches SMS notification configuration for a branch.
 */
export const getSmsConfiguration = async (branchId) => {
  const config = await getBranchSystemConfiguration(branchId);
  return config.sms;
};

/**
 * Subscribes to SMS configuration for real-time updates.
 */
export const subscribeToSmsConfiguration = (branchId, callback) => {
  if (typeof callback !== "function") return noopUnsub;
  if (!isUsableBranchId(branchId)) {
    callback(parseSmsConfig(null));
    return noopUnsub;
  }

  ensureBranchSystemConfiguration(branchId).catch(() => {});

  return onValue(
    ref(database, `${branchConfigPath(branchId)}/sms`),
    (snapshot) => {
      callback(parseSmsConfig(snapshot.val()));
    },
    (error) => {
      console.error("SMS config subscription error:", error);
      callback(parseSmsConfig(null));
    }
  );
};

/**
 * Updates SMS notification configuration and logs an audit event.
 */
export const updateSmsConfiguration = async (branchId, input) => {
  if (!isUsableBranchId(branchId)) {
    throw new Error("Branch is required to update SMS configuration");
  }

  const validation = validateSmsConfiguration(input);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const next = validation.value;
  await ensureBranchSystemConfiguration(branchId);
  const current = await getSmsConfiguration(branchId);

  const unchanged =
    current.nearingTurnAheadCount === next.nearingTurnAheadCount &&
    current.templateSlotReserved === next.templateSlotReserved &&
    current.templateQueueStarted === next.templateQueueStarted &&
    current.templateNearingTurn === next.templateNearingTurn;

  if (unchanged) {
    return current;
  }

  const payload = {
    ...next,
    updatedAt: Date.now(),
  };

  await update(ref(database, `${branchConfigPath(branchId)}/sms`), payload);
  await update(ref(database, branchConfigPath(branchId)), { updatedAt: Date.now() });

  const changes = [];
  if (current.nearingTurnAheadCount !== next.nearingTurnAheadCount) {
    changes.push(
      `near-turn ahead ${current.nearingTurnAheadCount} → ${next.nearingTurnAheadCount}`
    );
  }
  if (current.templateSlotReserved !== next.templateSlotReserved) {
    changes.push("reservation SMS template");
  }
  if (current.templateQueueStarted !== next.templateQueueStarted) {
    changes.push("queue-started SMS template");
  }
  if (current.templateNearingTurn !== next.templateNearingTurn) {
    changes.push("near-turn SMS template");
  }

  logAuditEvent({
    action: AUDIT_ACTIONS.SYSTEM_CONFIGURATION_CHANGED,
    category: AUDIT_CATEGORIES.SYSTEM_MANAGEMENT,
    description: `Changed SMS configuration (${changes.join(", ")})`,
    targetType: "systemConfiguration",
    targetId: branchId,
    branchId,
  });

  return next;
};

/**
 * Push/toast copy for NEARING_TURN — count-synced, not admin-editable.
 */
export const buildNearingTurnPushMessage = (count = DEFAULT_NEARING_TURN_AHEAD) => {
  const safeCount = Number.isInteger(count) ? count : DEFAULT_NEARING_TURN_AHEAD;
  return `There are only ${safeCount} patients ahead of you. Please proceed to the clinic.`;
};
