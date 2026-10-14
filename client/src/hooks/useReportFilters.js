import { useMemo, useState } from "react";
import { DEFAULT_REPORT_PRESET, presetRange, validateRange } from "../utils/reportDateRange";
import { ALL_BRANCHES } from "../utils/reportSessions";

/** Shared report filter state: Manila date range (preset or custom From/To) + branch ("All" default). */
export function useReportFilters() {
  const [preset, setPresetState] = useState(DEFAULT_REPORT_PRESET);
  const [range, setRangeState] = useState(() => presetRange(DEFAULT_REPORT_PRESET));
  const [branch, setBranch] = useState(ALL_BRANCHES);

  const rangeError = useMemo(() => validateRange(range), [range]);

  const setPreset = (id) => {
    setPresetState(id);
    setRangeState(presetRange(id));
  };

  const setRange = (next) => {
    setPresetState("custom");
    setRangeState((prev) => ({ ...prev, ...next }));
  };

  const reset = () => {
    setPreset(DEFAULT_REPORT_PRESET);
    setBranch(ALL_BRANCHES);
  };

  return {
    preset,
    range,
    rangeError,
    activeRange: rangeError ? null : range,
    branch,
    setPreset,
    setRange,
    setBranch,
    reset,
    isFiltered: preset !== DEFAULT_REPORT_PRESET || branch !== ALL_BRANCHES,
  };
}
