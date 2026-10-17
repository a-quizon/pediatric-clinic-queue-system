/**
 * Shared empty-state: short explanation plus a next step.
 */
export default function EmptyState({
  title = "Nothing here yet",
  description,
  nextStep,
  actionLabel,
  onAction,
  className = "",
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center px-4 py-10 ${className}`}
      role="status"
    >
      <p className="text-base font-semibold text-[var(--pq-ink)]">{title}</p>
      {description ? (
        <p className="mt-1 text-sm pq-muted max-w-md">{description}</p>
      ) : null}
      {nextStep ? (
        <p className="mt-2 text-sm text-[var(--pq-ink)] max-w-md">{nextStep}</p>
      ) : null}
      {actionLabel && typeof onAction === "function" ? (
        <button type="button" className="pq-btn pq-btn-secondary mt-4" onClick={onAction}>
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}
