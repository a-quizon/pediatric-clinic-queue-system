/** Accessible single-select chip row (radiogroup); scrolls horizontally on narrow screens. */
export default function ChipGroup({ label, options, value, onChange }) {
  return (
    <div>
      <span className="pq-label mb-1 block" aria-hidden="true">{label}</span>
      <div
        role="radiogroup"
        aria-label={label}
        className="flex gap-2 overflow-x-auto pb-1 pq-scroll-x pq-scroll-none"
      >
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(option.value)}
              className={`${selected ? "pq-btn-primary" : "pq-btn-secondary"} flex-shrink-0 min-h-[44px] text-sm`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
