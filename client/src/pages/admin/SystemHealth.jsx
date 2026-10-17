import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { onValue, ref, get } from "firebase/database";
import { Activity, Bell, Radio, RefreshCw, Server, Wifi, WifiOff } from "lucide-react";
import toast from "react-hot-toast";
import { getDb } from "../../firebase/database";
import EmptyState from "../../components/common/EmptyState";
import ConnectionStatusPill from "../../components/common/ConnectionStatusPill";
import Pagination from "../../components/common/Pagination";
import { PqSpinner } from "../../components/parent/pqUi";
import { useRtdbConnection } from "../../hooks/useRtdbConnection";
import { usePagination } from "../../hooks/usePagination";
import {
  KNOWN_JOBS,
  SMS_DEVICE_HELP,
  formatHealthTimestamp,
  formatLastUpdatedManila,
  formatSmsFailureExplanation,
  settleWithMinDuration,
  smsServiceStatusLabel,
  summarizeNotificationFailures,
  summarizeSmsMessages,
} from "../../utils/systemHealth";

const REFRESH_MIN_MS = 500;

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
  const [loadError, setLoadError] = useState(null);
  const [refreshError, setRefreshError] = useState(null);
  const [health, setHealth] = useState(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);
  const refreshingRef = useRef(false);
  const { label: connectionLabel } = useRtdbConnection();

  useEffect(() => {
    const healthRef = ref(getDb(), "systemHealth");
    const unsubHealth = onValue(
      healthRef,
      (snap) => {
        setHealth(snap.exists() ? snap.val() : null);
        setLoading(false);
        setLoadError(null);
        setLastUpdatedAt(Date.now());
      },
      (err) => {
        console.error("System Health load failed", err);
        setLoadError(
          "Could not load system health. Check that you are signed in as an active admin."
        );
        setLoading(false);
      }
    );

    return () => {
      unsubHealth();
    };
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
  const recentNotificationFailures = failureSummary.recent || [];

  const smsPager = usePagination(recentSmsFailures);
  const notifPager = usePagination(recentNotificationFailures);
  const { resetPage: resetSmsPage } = smsPager;
  const { resetPage: resetNotifPage } = notifPager;

  const handleRefresh = useCallback(async () => {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    setRefreshing(true);
    setRefreshError(null);
    try {
      const snap = await settleWithMinDuration(
        get(ref(getDb(), "systemHealth")),
        REFRESH_MIN_MS
      );
      setHealth(snap.exists() ? snap.val() : null);
      setLastUpdatedAt(Date.now());
      setLoadError(null);
      resetSmsPage();
      resetNotifPage();
      toast.success("System Health updated");
    } catch (err) {
      console.error("System Health refresh failed", err);
      const message = "Could not refresh system health.";
      setRefreshError(message);
      toast.error(message);
    } finally {
      refreshingRef.current = false;
      setRefreshing(false);
    }
  }, [resetSmsPage, resetNotifPage]);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <PqSpinner />
      </div>
    );
  }

  if (loadError && !health) {
    return (
      <EmptyState
        title="System Health unavailable"
        description={loadError}
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
  const lastUpdatedLabel = formatLastUpdatedManila(lastUpdatedAt);
  const contentDimClass = refreshing
    ? "opacity-60 pointer-events-none transition-opacity"
    : "transition-opacity";

  return (
    <div className="space-y-6 pb-8 min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm pq-muted min-w-0" aria-live="polite">
          {lastUpdatedLabel ? (
            <>
              Last updated:{" "}
              <span className="font-semibold text-[var(--pq-ink)]">{lastUpdatedLabel}</span>
              <span className="sr-only"> Asia/Manila</span>
            </>
          ) : (
            "Last updated: —"
          )}
        </p>
        <button
          type="button"
          className="pq-btn pq-btn-secondary inline-flex items-center gap-2"
          onClick={handleRefresh}
          disabled={refreshing}
          aria-busy={refreshing}
          aria-label={refreshing ? "Refreshing system health" : "Refresh system health"}
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} aria-hidden="true" />
          {refreshing ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {refreshError ? (
        <div
          className="rounded-lg px-4 py-3 text-sm"
          style={{ background: "var(--pq-alert-wash)", color: "var(--pq-alert)" }}
          role="alert"
        >
          {refreshError} Previous data is still shown. Try Refresh again.
        </div>
      ) : null}

      <div className={contentDimClass}>
        <section className="pq-glass p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-[var(--pq-ink)] flex items-center gap-2">
                {connectionLabel === "Online" ? (
                  <Wifi className="w-5 h-5 shrink-0" aria-hidden="true" />
                ) : (
                  <WifiOff className="w-5 h-5 shrink-0" aria-hidden="true" />
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
      </div>

      {!hasFailures && !hasGatewayData && !hasJobData ? (
        <EmptyState
          title="All quiet so far"
          description="No notification failures, SMS delivery records, or background job runs are recorded yet."
          nextStep="After the clinic sends SMS or push, or after scheduled jobs run, status will appear here. You can also check Audit Logs for lockouts and suspicious-account alerts."
        />
      ) : null}

      <div className={`grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 min-w-0 ${contentDimClass}`}>
        <section className="pq-glass p-4 sm:p-5 space-y-4 min-w-0 flex flex-col">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-[var(--pq-ink)] flex items-center gap-2">
                <Radio className="w-5 h-5 shrink-0" aria-hidden="true" />
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

          <div className="min-w-0 flex flex-col flex-1">
            <h3 className="text-sm font-semibold text-[var(--pq-ink)] mb-2">Recent failed SMS</h3>
            {recentSmsFailures.length === 0 ? (
              <EmptyState
                title="No failed messages"
                description="When TextBee reports MESSAGE_FAILED (for example code 32), rows appear here."
                nextStep="Confirm the TextBee webhook is configured and the gateway phone has a default SMS app."
                className="py-6"
              />
            ) : (
              <>
                <div className="max-h-56 sm:max-h-72 lg:max-h-80 overflow-y-auto overflow-x-auto min-w-0 rounded-lg border border-[var(--pq-glass-line)]">
                  <table className="pq-table w-full text-sm text-left">
                    <thead className="pq-table-head-sticky">
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
                      {smsPager.pageItems.map((row) => (
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
                {smsPager.showPagination ? (
                  <Pagination
                    page={smsPager.page}
                    totalPages={smsPager.totalPages}
                    totalItems={smsPager.totalItems}
                    pageSize={smsPager.pageSize}
                    onPageChange={smsPager.setPage}
                    onPageSizeChange={smsPager.setPageSize}
                    itemLabel="failed messages"
                  />
                ) : null}
              </>
            )}
          </div>
        </section>

        <section className="pq-glass p-4 sm:p-5 space-y-4 min-w-0 flex flex-col">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-[var(--pq-ink)] flex items-center gap-2">
                <Bell className="w-5 h-5 shrink-0" aria-hidden="true" />
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
          {recentNotificationFailures.length === 0 ? (
            <EmptyState
              title="No notification failures"
              description="Push and SMS channel errors are listed here."
              nextStep="If parents report missing alerts, confirm VAPID keys and TextBee next."
              className="py-6"
            />
          ) : (
            <>
              <ul className="divide-y divide-[var(--pq-line)] max-h-56 sm:max-h-72 lg:max-h-80 overflow-y-auto min-w-0 rounded-lg border border-[var(--pq-glass-line)] px-3">
                {notifPager.pageItems.map((row) => (
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
              {notifPager.showPagination ? (
                <Pagination
                  page={notifPager.page}
                  totalPages={notifPager.totalPages}
                  totalItems={notifPager.totalItems}
                  pageSize={notifPager.pageSize}
                  onPageChange={notifPager.setPage}
                  onPageSizeChange={notifPager.setPageSize}
                  itemLabel="failures"
                />
              ) : null}
            </>
          )}
        </section>
      </div>

      <div className={contentDimClass}>
        <section className="pq-glass p-4 sm:p-5 space-y-4 min-w-0">
          <div>
            <h2 className="text-lg font-semibold text-[var(--pq-ink)] flex items-center gap-2">
              <Server className="w-5 h-5 shrink-0" aria-hidden="true" />
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
                    <div className="flex items-center gap-2 min-w-0">
                      <Activity className="w-4 h-4 shrink-0" aria-hidden="true" />
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
    </div>
  );
}
