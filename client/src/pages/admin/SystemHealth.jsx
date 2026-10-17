import { useEffect, useMemo, useState } from "react";
import { onValue, ref } from "firebase/database";
import { Activity, Bell, Radio, Server, Wifi, WifiOff } from "lucide-react";
import { getDb } from "../../firebase/database";
import EmptyState from "../../components/common/EmptyState";
import { PqSpinner } from "../../components/parent/pqUi";
import {
  KNOWN_JOBS,
  SMS_DEVICE_HELP,
  connectionLabelFromInfoConnected,
  formatHealthTimestamp,
  smsStatusLabel,
  summarizeNotificationFailures,
} from "../../utils/systemHealth";

function StatusPill({ label, tone = "neutral" }) {
  const toneClass =
    tone === "ok"
      ? "pq-chip pq-chip-ok"
      : tone === "bad"
        ? "pq-chip pq-chip-alert"
        : tone === "warn"
          ? "pq-chip pq-chip-wait"
          : "pq-chip";
  return <span className={toneClass}>{label}</span>;
}

function connectionTone(label) {
  if (label === "Online") return "ok";
  if (label === "Reconnecting") return "warn";
  if (label === "Offline") return "bad";
  return "neutral";
}

function smsTone(label) {
  if (label === "OK") return "ok";
  if (label === "Failing") return "bad";
  if (label === "Not configured") return "warn";
  return "neutral";
}

export default function SystemHealth() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [health, setHealth] = useState(null);
  const [connected, setConnected] = useState(null);
  const [everConnected, setEverConnected] = useState(false);

  useEffect(() => {
    const healthRef = ref(getDb(), "systemHealth");
    const unsubHealth = onValue(
      healthRef,
      (snap) => {
        setHealth(snap.exists() ? snap.val() : null);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error("System Health load failed", err);
        setError("Could not load system health. Check that you are signed in as an active admin.");
        setLoading(false);
      }
    );

    const connectedRef = ref(getDb(), ".info/connected");
    const unsubConnected = onValue(connectedRef, (snap) => {
      const value = snap.val();
      setConnected(value === true);
      if (value === true) setEverConnected(true);
    });

    return () => {
      unsubHealth();
      unsubConnected();
    };
  }, []);

  const connectionLabel = connectionLabelFromInfoConnected(connected, { everConnected });
  const failureSummary = useMemo(
    () => summarizeNotificationFailures(health?.notificationFailures),
    [health]
  );
  const gateway = health?.smsGateway || null;
  const gatewayLabel = smsStatusLabel(gateway);
  const jobs = health?.jobs || {};

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <PqSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <EmptyState
        title="System Health unavailable"
        description={error}
        nextStep="Refresh the page, or confirm your admin account is active."
      />
    );
  }

  const hasFailures = failureSummary.count7d > 0;
  const hasGatewayData = Boolean(gateway?.lastSuccessAt || gateway?.lastFailureAt || gateway?.inferredStatus);
  const hasJobData = KNOWN_JOBS.some((job) => jobs[job.id]?.lastRunAt);

  return (
    <div className="space-y-6 pb-8">
      <section className="pq-card p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-[var(--pq-ink)] flex items-center gap-2">
              {connectionLabel === "Online" ? (
                <Wifi className="w-5 h-5" aria-hidden="true" />
              ) : (
                <WifiOff className="w-5 h-5" aria-hidden="true" />
              )}
              Your connection
            </h2>
            <p className="text-sm pq-muted mt-1">
              Live status of this admin browser&apos;s realtime database link.
            </p>
          </div>
          <StatusPill label={connectionLabel} tone={connectionTone(connectionLabel)} />
        </div>
      </section>

      {!hasFailures && !hasGatewayData && !hasJobData ? (
        <EmptyState
          title="All quiet so far"
          description="No notification failures, SMS gateway results, or background job runs are recorded yet."
          nextStep="After the clinic sends SMS or push, or after scheduled jobs run, status will appear here. You can also check Audit Logs for lockouts and suspicious-account alerts."
        />
      ) : null}

      <section className="pq-card p-4 sm:p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-[var(--pq-ink)] flex items-center gap-2">
              <Bell className="w-5 h-5" aria-hidden="true" />
              Notifications
            </h2>
            <p className="text-sm pq-muted mt-1">
              Recent push and SMS delivery failures recorded by the server.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3 text-sm">
          <span className="pq-chip">Last 24h: {failureSummary.count24h}</span>
          <span className="pq-chip">Last 7 days: {failureSummary.count7d}</span>
        </div>
        {failureSummary.recent.length === 0 ? (
          <EmptyState
            title="No notification failures"
            description="Push and SMS sends that fail are listed here."
            nextStep="If parents report missing alerts, confirm VAPID keys and TextBee next."
            className="py-6"
          />
        ) : (
          <ul className="divide-y divide-[var(--pq-line)]">
            {failureSummary.recent.map((row) => (
              <li key={row.id} className="py-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-[var(--pq-ink)]">{row.channel || "push"}</span>
                  {row.notificationType ? <span className="pq-chip">{row.notificationType}</span> : null}
                  <span className="pq-muted">{formatHealthTimestamp(row.at)}</span>
                </div>
                <p className="mt-1 pq-muted break-words">{row.error || "Unknown error"}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="pq-card p-4 sm:p-5 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-[var(--pq-ink)] flex items-center gap-2">
              <Radio className="w-5 h-5" aria-hidden="true" />
              SMS gateway (TextBee)
            </h2>
            <p className="text-sm pq-muted mt-1">{SMS_DEVICE_HELP}</p>
          </div>
          <StatusPill label={gatewayLabel} tone={smsTone(gatewayLabel)} />
        </div>
        <dl className="grid sm:grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="pq-muted">Last success</dt>
            <dd className="font-medium text-[var(--pq-ink)]">{formatHealthTimestamp(gateway?.lastSuccessAt)}</dd>
          </div>
          <div>
            <dt className="pq-muted">Last failure</dt>
            <dd className="font-medium text-[var(--pq-ink)]">{formatHealthTimestamp(gateway?.lastFailureAt)}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="pq-muted">Last failure reason</dt>
            <dd className="font-medium text-[var(--pq-ink)] break-words">
              {gateway?.lastFailureDetail || gateway?.lastFailureReason || "No data yet"}
            </dd>
          </div>
        </dl>
      </section>

      <section className="pq-card p-4 sm:p-5 space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-[var(--pq-ink)] flex items-center gap-2">
            <Server className="w-5 h-5" aria-hidden="true" />
            Background jobs
          </h2>
          <p className="text-sm pq-muted mt-1">
            Scheduled Cloud Functions. Slot release and check-in reminders run on demand when events happen, not on a timer.
          </p>
        </div>
        <ul className="space-y-3">
          {KNOWN_JOBS.map((job) => {
            const row = jobs[job.id] || {};
            const status = row.lastRunAt
              ? row.status === "ok"
                ? "OK"
                : row.status === "error"
                  ? "Error"
                  : "Unknown"
              : "No data yet";
            return (
              <li key={job.id} className="border border-[var(--pq-line)] rounded-lg p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4" aria-hidden="true" />
                    <span className="font-semibold text-[var(--pq-ink)]">{job.name}</span>
                  </div>
                  <StatusPill
                    label={status}
                    tone={status === "OK" ? "ok" : status === "Error" ? "bad" : "neutral"}
                  />
                </div>
                <p className="text-xs pq-muted mt-1">{job.schedule}</p>
                <dl className="mt-2 grid sm:grid-cols-2 gap-2 text-sm">
                  <div>
                    <dt className="pq-muted">Last run</dt>
                    <dd>{formatHealthTimestamp(row.lastRunAt)}</dd>
                  </div>
                  <div>
                    <dt className="pq-muted">Last success</dt>
                    <dd>{formatHealthTimestamp(row.lastSuccessAt)}</dd>
                  </div>
                  {row.lastError ? (
                    <div className="sm:col-span-2">
                      <dt className="pq-muted">Last error</dt>
                      <dd className="break-words">{row.lastError}</dd>
                    </div>
                  ) : null}
                </dl>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
