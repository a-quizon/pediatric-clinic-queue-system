/**
 * Module-level RTDB connection snapshot shared by useRtdbConnection and services.
 * Services refuse clinic mutations when canMutateRealtime is false so offline
 * RTDB write queues cannot silently replay conflicting queue updates.
 */

import { connectionLabelFromInfoConnected } from "./systemHealth.js";

export const OFFLINE_MUTATION_MESSAGE =
  "Reconnect to the clinic before making this change.";

// Optimistic Online until .info/connected reports otherwise so the first paint
// does not briefly disable every clinic action before the listener fires.
let snapshot = {
  connected: true,
  everConnected: false,
  label: "Online",
  canMutateRealtime: true,
};

export function getRtdbConnectionSnapshot() {
  return snapshot;
}

export function setRtdbConnectionSnapshot({ connected, everConnected }) {
  const label = connectionLabelFromInfoConnected(connected, { everConnected });
  snapshot = {
    connected,
    everConnected: Boolean(everConnected),
    label,
    canMutateRealtime: label === "Online",
  };
  return snapshot;
}

export function assertCanMutateRealtime() {
  if (!snapshot.canMutateRealtime) {
    throw new Error(OFFLINE_MUTATION_MESSAGE);
  }
}

export function connectionTone(label) {
  if (label === "Online") return "ok";
  if (label === "Reconnecting") return "warn";
  if (label === "Offline") return "bad";
  return "neutral";
}
