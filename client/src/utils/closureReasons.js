export const CLOSURE_REASONS = [
  { id: "emergency", label: "Doctor emergency" },
  { id: "vacation", label: "Vacation" },
  { id: "holiday", label: "Holiday" },
  { id: "other", label: "Other" },
];

export function closureReasonLabel(reason) {
  return CLOSURE_REASONS.find((item) => item.id === reason)?.label || "Closed";
}

export function closureAnnouncement(reason, note) {
  const label = closureReasonLabel(reason);
  const extra = String(note || "").trim();
  if (extra) return `The clinic is closed (${label}). ${extra}`;
  return `The clinic is closed (${label}).`;
}
