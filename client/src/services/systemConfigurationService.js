import { database } from "../firebase/database";
import { ref, get, update, onValue } from "firebase/database";
import { logAuditEvent, AUDIT_ACTIONS, AUDIT_CATEGORIES } from "./auditService";

const MAX_PENALTY_MOVE_BACK = 10;
const MIN_PENALTY_MOVE_BACK = 0;
const DEFAULT_PENALTY_MOVE_BACK = 2;

export const MIN_NEARING_TURN_AHEAD = 1;
export const MAX_NEARING_TURN_AHEAD = 10;
export const DEFAULT_NEARING_TURN_AHEAD = 3;
export const MAX_SMS_TEMPLATE_LENGTH = 320;

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
    "Hello! The queue at {branch} for {date} has officially started. " +
    "Please monitor your place in line and be ready when we notify you that your turn is near.",
  templateNearingTurn:
    "Only {count} patients ahead (Queue #{queueNumber}). Please head to the clinic now.",
};

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
 * Parses the configuration object to ensure safe fallbacks.
 */
const parseQueueConfig = (data) => {
  if (!data || data.penaltyMoveBack === undefined) {
    return { penaltyMoveBack: DEFAULT_PENALTY_MOVE_BACK };
  }

  const validation = validatePenaltyMoveBack(data.penaltyMoveBack);
  return {
    penaltyMoveBack: validation.valid ? validation.value : DEFAULT_PENALTY_MOVE_BACK,
  };
};

/**
 * Fetches the entire queue configuration once.
 */
export const getQueueConfiguration = async () => {
  try {
    const snap = await get(ref(database, "systemConfiguration/queue"));
    return parseQueueConfig(snap.val());
  } catch (error) {
    console.error("Failed to fetch queue configuration:", error);
    return parseQueueConfig(null);
  }
};

/**
 * Helper to fetch just the penalty move back value.
 */
export const getPenaltyMoveBack = async () => {
  const config = await getQueueConfiguration();
  return config.penaltyMoveBack;
};

/**
 * Subscribes to the queue configuration for real-time updates.
 */
export const subscribeToQueueConfiguration = (callback) => {
  const configRef = ref(database, "systemConfiguration/queue");
  return onValue(
    configRef,
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
export const updatePenaltyMoveBack = async (newValue) => {
  const validation = validatePenaltyMoveBack(newValue);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const newSafeValue = validation.value;

  const currentConfig = await getQueueConfiguration();
  const currentValue = currentConfig.penaltyMoveBack;

  if (currentValue === newSafeValue) {
    return;
  }

  const configRef = ref(database, "systemConfiguration/queue");
  await update(configRef, {
    penaltyMoveBack: newSafeValue,
  });

  logAuditEvent({
    action: AUDIT_ACTIONS.SYSTEM_CONFIGURATION_CHANGED,
    category: AUDIT_CATEGORIES.SYSTEM_MANAGEMENT,
    description: `Changed Queue Penalty Move-Back from ${currentValue} to ${newSafeValue}`,
    targetType: "systemConfiguration",
  });
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

/**
 * Fetches SMS notification configuration (global clinic settings).
 */
export const getSmsConfiguration = async () => {
  try {
    const snap = await get(ref(database, "systemConfiguration/sms"));
    return parseSmsConfig(snap.val());
  } catch (error) {
    console.error("Failed to fetch SMS configuration:", error);
    return parseSmsConfig(null);
  }
};

/**
 * Subscribes to SMS configuration for real-time updates.
 */
export const subscribeToSmsConfiguration = (callback) => {
  const configRef = ref(database, "systemConfiguration/sms");
  return onValue(
    configRef,
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
export const updateSmsConfiguration = async (input) => {
  const validation = validateSmsConfiguration(input);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const next = validation.value;
  const current = await getSmsConfiguration();

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

  await update(ref(database, "systemConfiguration/sms"), payload);

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
