import { CalendarDays } from "lucide-react";
import { REPORT_PRESETS } from "../../utils/reportDateRange";
import ChipGroup from "./ChipGroup";

/**
 * Preset chips + inclusive From/To (Asia/Manila calendar days) + Clear.
 * Only the date range keeps an icon; other filter controls are text-only.
 */
export default function ReportDateRangeFilter({ filters, idPrefix = "report", children }) {
  const { preset, range, rangeError, setPreset, setRange, reset, isFiltered } = filters;
  const fromId = `${idPrefix}-from`;
  const toId = `${idPrefix}-to`;
  const errorId = `${idPrefix}-range-error`;

  return (
    <div className="pq-filter-bar p-4 sm:p-5 space-y-4">
      <ChipGroup
        label="Date range"
        icon={CalendarDays}
        options={REPORT_PRESETS.map((p) => ({ value: p.id, label: p.label }))}
        value={preset}
        onChange={setPreset}
      />

      <div className="flex flex-col sm:flex-row sm:items-end gap-3">
        <div className="grid grid-cols-2 gap-3 flex-1 sm:max-w-md">
          <div>
            <label htmlFor={fromId} className="pq-label">From</label>
            <input
              id={fromId}
              type="date"
              className="pq-input"
              value={range.from}
              max={range.to || undefined}
              onChange={(e) => setRange({ from: e.target.value })}
              aria-invalid={Boolean(rangeError)}
              aria-describedby={rangeError ? errorId : undefined}
            />
          </div>
          <div>
            <label htmlFor={toId} className="pq-label">To</label>
            <input
              id={toId}
              type="date"
              className="pq-input"
              value={range.to}
              min={range.from || undefined}
              onChange={(e) => setRange({ to: e.target.value })}
              aria-invalid={Boolean(rangeError)}
              aria-describedby={rangeError ? errorId : undefined}
            />
          </div>
        </div>
        <button
          type="button"
          onClick={reset}
          disabled={!isFiltered}
          className="pq-btn-ghost min-h-[44px] text-sm self-start sm:self-auto"
        >
          Clear filters
        </button>
      </div>

      {rangeError ? (
        <p id={errorId} role="alert" className="pq-error-text text-sm">
          {rangeError}
        </p>
      ) : null}

      {children}
    </div>
  );
}
