import { useMemo, useState } from "react";
import { DEFAULT_REPORT_PRESET, editRange, selectPreset, validateRange } from "../utils/reportDateRange";
import { ALL_BRANCHES } from "../utils/reportSessions";

/** Shared report filter state: Manila date range (preset or custom From/To) + branch ("All" default). */
export function useReportFilters() {
  const [state, setState] = useState(() => selectPreset(DEFAULT_REPORT_PRESET));
  const [branch, setBranch] = useState(ALL_BRANCHES);
  const { preset, range } = state;

  const rangeError = useMemo(() => validateRange(range), [range]);

  const setPreset = (id) => setState(selectPreset(id));
  const setRange = (patch) => setState((prev) => editRange(prev.range, patch));

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
