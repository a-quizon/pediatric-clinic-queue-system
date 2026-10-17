import { Wifi, WifiOff } from "lucide-react";
import { connectionTone } from "../../utils/rtdbConnectionState";
import { useRtdbConnection } from "../../hooks/useRtdbConnection";

/**
 * Compact Online / Reconnecting / Offline chip for live clinic screens.
 * @param {{ showIcon?: boolean, className?: string }} props
 */
export default function ConnectionStatusPill({ showIcon = true, className = "" }) {
  const { label } = useRtdbConnection();
  const tone = connectionTone(label);
  const toneClass =
    tone === "ok"
      ? "pq-chip pq-chip-ok"
      : tone === "bad"
        ? "pq-chip pq-chip-alert"
        : tone === "warn"
          ? "pq-chip pq-chip-wait"
          : "pq-chip";

  return (
    <span
      className={`${toneClass} inline-flex items-center gap-1.5 shrink-0 ${className}`.trim()}
      role="status"
      aria-live="polite"
      title={
        label === "Online"
          ? "Connected — queue data is current"
          : label === "Reconnecting"
            ? "Reconnecting — wait before changing the queue"
            : "Offline — queue may be out of date"
      }
    >
      {showIcon ? (
        label === "Online" ? (
          <Wifi className="w-3.5 h-3.5" aria-hidden="true" />
        ) : (
          <WifiOff className="w-3.5 h-3.5" aria-hidden="true" />
        )
      ) : null}
      {label}
    </span>
  );
}
