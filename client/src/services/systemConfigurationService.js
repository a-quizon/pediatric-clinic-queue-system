import { database } from "../firebase/database";
import { ref, get, set, update, onValue } from "firebase/database";
import { logAuditEvent, AUDIT_ACTIONS, AUDIT_CATEGORIES } from "./auditService";

const MAX_PENALTY_MOVE_BACK = 10;
const MIN_PENALTY_MOVE_BACK = 0;
const DEFAULT_PENALTY_MOVE_BACK = 2;

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
    penaltyMoveBack: validation.valid ? validation.value : DEFAULT_PENALTY_MOVE_BACK
  };
};

/**
 * Fetches the entire queue configuration once.
 */
export const getQueueConfiguration = async () => {
  try {
    const snap = await get(ref(database, 'systemConfiguration/queue'));
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
  const configRef = ref(database, 'systemConfiguration/queue');
  return onValue(configRef, (snapshot) => {
    callback(parseQueueConfig(snapshot.val()));
  }, (error) => {
    console.error("Queue config subscription error:", error);
    callback(parseQueueConfig(null));
  });
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
  
  // Get current value to log the difference
  const currentConfig = await getQueueConfiguration();
  const currentValue = currentConfig.penaltyMoveBack;

  if (currentValue === newSafeValue) {
    return; // No change needed
  }

  // Update in Firebase
  const configRef = ref(database, 'systemConfiguration/queue');
  await update(configRef, {
    penaltyMoveBack: newSafeValue
  });

  // Log Audit Event AFTER successful update
  logAuditEvent({
    action: AUDIT_ACTIONS.SYSTEM_CONFIGURATION_CHANGED,
    category: AUDIT_CATEGORIES.SYSTEM_MANAGEMENT,
    description: `Changed Queue Penalty Move-Back from ${currentValue} to ${newSafeValue}`,
    targetType: "systemConfiguration"
  });
};
