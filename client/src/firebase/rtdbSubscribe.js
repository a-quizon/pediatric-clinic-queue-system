import { onValue } from "firebase/database";

export const noopUnsub = () => {};

export function isPermissionDenied(error) {
  const code = String(error?.code || "");
  const message = String(error?.message || "");
  return (
    code.toUpperCase().includes("PERMISSION_DENIED") ||
    message.toUpperCase().includes("PERMISSION_DENIED")
  );
}

export function safeUnsub(unsub) {
  if (typeof unsub !== "function") return;
  try {
    unsub();
  } catch {
    // Listener may already be cancelled after auth drop.
  }
}

/**
 * onValue wrapper that always returns a callable unsubscribe and
 * ignores PERMISSION_DENIED (typical after logout) so cleanup cannot
 * crash the React tree or spam the console.
 */
export function subscribeOnValue(queryOrRef, onData, onError) {
  if (typeof onData !== "function") return noopUnsub;

  const unsub = onValue(
    queryOrRef,
    onData,
    (error) => {
      if (isPermissionDenied(error)) return;
      if (typeof onError === "function") {
        onError(error);
        return;
      }
      console.error("Realtime Database subscription error:", error);
    }
  );

  return () => safeUnsub(unsub);
}
