import { useEffect, useState } from "react";
import {
  DEFAULT_LATE_LIMIT,
  hasOwnScheduleLateLimit,
  resolveLateLimitForSchedule,
} from "../services/systemConfigurationService";

/**
 * Existing schedules keep their saved lateLimit; new ones follow the branch config live.
 */
export default function useResolvedLateLimit(schedule) {
  const [lateLimit, setLateLimit] = useState(() =>
    hasOwnScheduleLateLimit(schedule) ? Number(schedule.lateLimit) : DEFAULT_LATE_LIMIT
  );

  useEffect(() => {
    let cancelled = false;

    if (!schedule) {
      setLateLimit(DEFAULT_LATE_LIMIT);
      return undefined;
    }

    if (hasOwnScheduleLateLimit(schedule)) {
      setLateLimit(Number(schedule.lateLimit));
      return undefined;
    }

    resolveLateLimitForSchedule(schedule).then((value) => {
      if (!cancelled) setLateLimit(value);
    });

    return () => {
      cancelled = true;
    };
  }, [schedule, schedule?.id, schedule?.lateLimit, schedule?.branchId, schedule?.branch]);

  return lateLimit;
}
