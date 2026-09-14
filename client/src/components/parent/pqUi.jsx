import React from "react";

const LOGO_SRC = "/brand/plusqueue-logo.png";

export function PqBrand({ size = 40, wordmark = true, compact = false, stacked = false }) {
  return (
    <span
      className={`pq-brand ${compact ? "pq-brand-compact" : ""} ${stacked ? "pq-brand-stacked" : ""}`}
      style={{ "--pq-brand-size": `${size}px` }}
    >
      <img
        src={LOGO_SRC}
        alt=""
        width={size}
        height={size}
        className="pq-brand-mark"
      />
      {wordmark && (
        <span className="pq-brand-word">
          PlusQueue
        </span>
      )}
    </span>
  );
}

export function PqSpinner({ label = "Loading" }) {
  return (
    <div className="pq-spinner-wrap" role="status" aria-live="polite">
      <span className="pq-spinner" aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </div>
  );
}

export function PqAuthShell({ children }) {
  return (
    <div className="pq-shell pq-auth">
      <div className="pq-auth-inner">{children}</div>
    </div>
  );
}
