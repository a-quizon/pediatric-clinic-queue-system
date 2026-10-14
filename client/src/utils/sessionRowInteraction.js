/** Enter or Space activate a focused row (WAI-ARIA button pattern). */
export function isRowActivationKey(event) {
  return event?.key === "Enter" || event?.key === " " || event?.key === "Spacebar";
}

/**
 * Props for a clickable Session History table row. Returns {} when no handler is given,
 * so a row without `onOpenSession` is plain, non-interactive text.
 */
export function sessionRowProps(sessionId, onOpenSession, label) {
  if (typeof onOpenSession !== "function") return {};
  return {
    role: "button",
    tabIndex: 0,
    className: "pq-table-row-action",
    "aria-label": label,
    onClick: () => onOpenSession(sessionId),
    onKeyDown: (event) => {
      if (!isRowActivationKey(event)) return;
      event.preventDefault?.();
      onOpenSession(sessionId);
    },
  };
}
