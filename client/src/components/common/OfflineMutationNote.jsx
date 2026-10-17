import { useRtdbConnection } from "../../hooks/useRtdbConnection";

/** Short notice when staff cannot mutate because the RTDB link is not Online. */
export default function OfflineMutationNote({ className = "" }) {
  const { canMutateRealtime, label } = useRtdbConnection();
  if (canMutateRealtime) return null;
  return (
    <p className={`text-xs font-semibold pq-muted ${className}`.trim()} role="status">
      {label === "Reconnecting"
        ? "Reconnecting… Wait until Online before changing the queue."
        : "Offline. Reconnect to change the queue."}
    </p>
  );
}
