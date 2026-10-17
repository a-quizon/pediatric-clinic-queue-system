import { useCallback, useEffect, useState } from "react";
import { RESEND_COOLDOWN_SECONDS } from "../utils/constants";
import {
  getRemainingSeconds,
  startCooldown,
  syncFromRetryAfter,
} from "../utils/resendCooldown";

/**
 * Persisted resend countdown for a flow + identity (phone / uid / email).
 * Survives refresh via localStorage expiry timestamps.
 */
export function useResendCooldown(flow, identity) {
  const [cooldownLeft, setCooldownLeft] = useState(0);

  useEffect(() => {
    setCooldownLeft(getRemainingSeconds(flow, identity));
  }, [flow, identity]);

  useEffect(() => {
    if (cooldownLeft <= 0) return undefined;
    const id = setInterval(() => {
      const left = getRemainingSeconds(flow, identity);
      setCooldownLeft(left);
    }, 1000);
    return () => clearInterval(id);
  }, [cooldownLeft, flow, identity]);

  const beginCooldown = useCallback(
    (seconds = RESEND_COOLDOWN_SECONDS) => {
      const left = startCooldown(flow, identity, seconds);
      setCooldownLeft(left);
      return left;
    },
    [flow, identity]
  );

  const syncCooldown = useCallback(
    (retryAfterSeconds) => {
      const left = syncFromRetryAfter(flow, identity, retryAfterSeconds);
      setCooldownLeft(left);
      return left;
    },
    [flow, identity]
  );

  return { cooldownLeft, beginCooldown, syncCooldown };
}
