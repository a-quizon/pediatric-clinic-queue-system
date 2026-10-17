import { useEffect, useMemo, useState, useCallback } from "react";
import { onValue, ref, get } from "firebase/database";
import { Activity, Bell, Radio, RefreshCw, Server, Wifi, WifiOff } from "lucide-react";
import { getDb } from "../../firebase/database";
import EmptyState from "../../components/common/EmptyState";
import ConnectionStatusPill from "../../components/common/ConnectionStatusPill";
import { PqSpinner } from "../../components/parent/pqUi";
import { useRtdbConnection } from "../../hooks/useRtdbConnection";
import {
  KNOWN_JOBS,
  SMS_DEVICE_HELP,
  formatHealthTimestamp,
  formatSmsFailureExplanation,
  smsServiceStatusLabel,
  summarizeNotificationFailures,
  summarizeSmsMessages,
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

function smsServiceTone(label) {
  if (label === "Healthy") return "ok";
  if (label === "Degraded") return "warn";
  if (label === "Down") return "bad";
  return "neutral";
}

function formatPercent(rate) {
  if (rate == null || Number.isNaN(rate)) return "—";
  return `${Math.round(Number(rate) * 100)}%`;
}

export default function SystemHealth() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [health, setHealth] = useState(null);
  const { label: connectionLabel } = useRtdbConnection();

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

    return () => {
      unsubHealth();
    };
  }, []);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const snap = await get(ref(getDb(), "systemHealth"));
      setHealth(snap.exists() ? snap.val() : null);
      setError(null);
    } catch (err) {
      console.error("System Health refresh failed", err);
      setError("Could not refresh system health.");
    } finally {
      setRefreshing(false);
    }
  }, []);

  const failureSummary = useMemo(
    () => summarizeNotificationFailures(health?.notificationFailures),
    [health]
  );
  const gateway = health?.smsGateway || null;
  const smsSummary = useMemo(() => {
    const fromMessages = summarizeSmsMessages(health?.smsMessages);
    if (gateway?.serviceStatus) {
      return {
        ...fromMessages,
        serviceStatus: gateway.serviceStatus,
        failureRate1h: gateway.failureRate1h ?? fromMessages.failureRate1h,
        failureRate24h: gateway.failureRate24h ?? fromMessages.failureRate24h,
        failures24h: gateway.failures24h ?? fromMessages.failures24h,
        stuckCount: gateway.stuckCount ?? fromMessages.stuckCount,
        lastSuccessAt: gateway.lastDeliveredOrSentAt || gateway.lastSuccessAt || fromMessages.lastSuccessAt,
        lastFailure: gateway.lastFailure || fromMessages.lastFailure,
      };
    }
    return fromMessages;
  }, [health, gateway]);
  const gatewayLabel = smsServiceStatusLabel(smsSummary.serviceStatus);
  const jobs = health?.jobs || {};
  const recentSmsFailures = smsSummary.recentFailures || [];

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
  const hasGatewayData = Boolean(
    gateway?.lastSuccessAt ||
      gateway?.lastDeliveredOrSentAt ||
      gateway?.lastFailureAt ||
      gateway?.serviceStatus ||
      gateway?.inferredStatus ||
      Object.keys(health?.smsMessages || {}).length
  );
  const hasJobData = KNOWN_JOBS.some((job) => jobs[job.id]?.lastRunAt);

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          className="pq-btn pq-btn-secondary inline-flex items-center gap-2"
          onClick={handleRefresh}
          disabled={refreshing}
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} aria-hidden="true" />
          {refreshing ? "Refreshing…" : "Refresh"}
        </button>
      </div>

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
          <ConnectionStatusPill />
        </div>
      </section>

      {!hasFailures && !hasGatewayData && !hasJobData ? (
        <EmptyState
          title="All quiet so far"
          description="No notification failures, SMS delivery records, or background job runs are recorded yet."
          nextStep="After the clinic sends SMS or push, or after scheduled jobs run, status will appear here. You can also check Audit Logs for lockouts and suspicious-account alerts."
        />
      ) : null}

      <section className="pq-card p-4 sm:p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-[var(--pq-ink)] flex items-center gap-2">
              <Radio className="w-5 h-5" aria-hidden="true" />
              SMS / Notification (TextBee)
            </h2>
            <p className="text-sm pq-muted mt-1">{SMS_DEVICE_HELP}</p>
          </div>
          <StatusPill label={gatewayLabel} tone={smsServiceTone(gatewayLabel)} />
        </div>

        <div className="flex flex-wrap gap-3 text-sm">
          <span className="pq-chip">Failures (24h): {smsSummary.failures24h ?? 0}</span>
          <span className="pq-chip">Failure rate (24h): {formatPercent(smsSummary.failureRate24h)}</span>
          <span className="pq-chip">Failure rate (1h): {formatPercent(smsSummary.failureRate1h)}</span>
          {smsSummary.stuckCount > 0 ? (
            <span className="pq-chip pq-chip-wait">
              Possibly stuck (queued &gt; 10m): {smsSummary.stuckCount}
            </span>
          ) : null}
        </div>

        <dl className="grid sm:grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="pq-muted">Last successful delivery</dt>
            <dd className="font-medium text-[var(--pq-ink)]">
              {formatHealthTimestamp(smsSummary.lastSuccessAt)}
            </dd>
            <p className="text-xs pq-muted mt-0.5">
              Counts TextBee <code>sent</code> or <code>delivered</code> (carrier delivery reports are optional).
            </p>
          </div>
          <div>
            <dt className="pq-muted">Most recent failure</dt>
            <dd className="font-medium text-[var(--pq-ink)]">
              {formatHealthTimestamp(smsSummary.lastFailure?.at || gateway?.lastFailureAt)}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="pq-muted">Latest failure detail</dt>
            <dd className="font-medium text-[var(--pq-ink)] break-words">
              {smsSummary.lastFailure
                ? formatSmsFailureExplanation(smsSummary.lastFailure)
                : gateway?.lastFailureDetail || gateway?.lastFailureReason || "No data yet"}
            </dd>
          </div>
        </dl>

        <div>
          <h3 className="text-sm font-semibold text-[var(--pq-ink)] mb-2">Recent failed SMS</h3>
          {recentSmsFailures.length === 0 ? (
            <EmptyState
              title="No SMS delivery failures recorded"
              description="When TextBee reports MESSAGE_FAILED (for example code 32), rows appear here."
              nextStep="Confirm the TextBee webhook is configured and the gateway phone has a default SMS app."
              className="py-6"
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="border-b border-[var(--pq-line)] pq-muted">
                    <th className="py-2 pr-3 font-medium">Time</th>
                    <th className="py-2 pr-3 font-medium">Recipient</th>
                    <th className="py-2 pr-3 font-medium">Type</th>
                    <th className="py-2 pr-3 font-medium">Branch</th>
                    <th className="py-2 pr-3 font-medium">Error</th>
                    <th className="py-2 font-medium">Reservation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--pq-line)]">
                  {recentSmsFailures.map((row) => (
                    <tr key={row.id}>
                      <td className="py-2 pr-3 whitespace-nowrap">
                        {formatHealthTimestamp(row.updatedAt || row.createdAt)}
                      </td>
                      <td className="py-2 pr-3">{row.maskedRecipient || "—"}</td>
                      <td className="py-2 pr-3">{row.messageType || "SMS"}</td>
                      <td className="py-2 pr-3">{row.branch || "—"}</td>
                      <td className="py-2 pr-3 max-w-xs break-words">
                        {row.errorCode ? `${row.errorCode} ` : ""}
                        {row.errorName || row.errorMessage || "failed"}
                        {String(row.errorCode) === "32" ? (
                          <span className="block text-xs pq-muted mt-0.5">
                            Gateway phone has no default SMS app (not the patient&apos;s number).
                          </span>
                        ) : null}
                      </td>
                      <td className="py-2 font-mono text-xs break-all">{row.reservationId || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <section className="pq-card p-4 sm:p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-[var(--pq-ink)] flex items-center gap-2">
              <Bell className="w-5 h-5" aria-hidden="true" />
              Other notification failures
            </h2>
            <p className="text-sm pq-muted mt-1">
              Push failures and low-level SMS HTTP errors recorded by the server.
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
            description="Push and SMS channel errors are listed here."
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
