import { useState, useEffect, useRef } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import {
  Activity as ActivityIcon,
  Search,
  Shield,
  Stethoscope,
  UserCog,
  User,
  Clock,
  ArrowDownToLine,
  AlertCircle,
  ChevronDown,
  AlertTriangle,
} from "lucide-react";
import { ref, query, limitToLast } from "firebase/database";
import { database } from "../../firebase/database";
import { subscribeOnValue } from "../../firebase/rtdbSubscribe";
import { AUDIT_CATEGORIES, AUDIT_ACTIONS } from "../../services/auditService";
import {
  dismissSuspiciousAccount,
  deactivateSuspiciousAccount,
} from "../../services/suspiciousAccountService";
import { PqSpinner } from "../../components/parent/pqUi";
import ConfirmationModal from "../../components/common/ConfirmationModal";
import toast from "react-hot-toast";

const roleChip = (role) => {
  if (role === "doctor") return "pq-chip pq-chip-info";
  if (role === "secretary") return "pq-chip pq-chip-wait";
  if (role === "admin") return "pq-chip pq-chip-info";
  if (role === "system") return "pq-chip pq-chip-alert";
  return "pq-chip";
};

const SelectChevron = () => (
  <div className="pq-field-icon" style={{ left: "auto", right: "0.85rem" }} aria-hidden="true">
    <ChevronDown className="w-4 h-4" />
  </div>
);

const formatDateTime = (timestamp) => {
  if (!timestamp) return "Unknown";
  const d = new Date(timestamp);
  return new Intl.DateTimeFormat("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit", hour12: true
  }).format(d);
};

const formatLogDate = (timestamp) => {
  if (!timestamp) return "Unknown";
  return new Intl.DateTimeFormat("en-US", {
    month: "short", day: "numeric", year: "numeric"
  }).format(new Date(timestamp));
};

const formatLogTime = (timestamp) => {
  if (!timestamp) return "";
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric", minute: "2-digit", hour12: true
  }).format(new Date(timestamp));
};

const isSuspiciousLog = (log) =>
  log?.action === AUDIT_ACTIONS.ACCOUNT_FLAGGED_SUSPICIOUS ||
  log?.badge === "Suspicious";

function formatRuleLabel(ruleId) {
  if (!ruleId) return "";
  return String(ruleId)
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function EvidenceList({ evidence }) {
  if (!evidence?.length) return null;
  return (
    <ul className="mt-2 space-y-1 text-xs pq-muted">
      {evidence.map((row) => (
        <li key={row.reservationId || `${row.clinicDate}-${row.status}`}>
          <span className="font-semibold text-[var(--pq-ink)]">{row.clinicDate}</span>
          {" — "}
          {row.kind === "no_show" ? "No QR validation (no-show)" : row.kind === "attended" ? "Attended" : row.kind}
          {row.status ? ` · status: ${row.status}` : ""}
        </li>
      ))}
    </ul>
  );
}

export default function AuditLogs() {
  const [searchParams, setSearchParams] = useSearchParams();
  const redirectToOverview = searchParams.get("tab") === "reports";
  const highlightId = searchParams.get("highlight");

  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [logLimit, setLogLimit] = useState(100);
  const [hasMoreLogs, setHasMoreLogs] = useState(true);
  const [error, setError] = useState(null);

  const [categoryFilter, setCategoryFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 15;

  const [expandedId, setExpandedId] = useState(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const highlightRef = useRef(null);

  useEffect(() => {
    if (redirectToOverview) return undefined;
    const auditRef = ref(database, "auditLogs");
    const q = query(auditRef, limitToLast(logLimit));

    const unsubscribe = subscribeOnValue(q, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const logsList = Object.keys(data).map((key) => ({
          id: key,
          ...data[key]
        }));

        logsList.sort((a, b) => b.timestamp - a.timestamp);

        setLogs(logsList);
        setHasMoreLogs(logsList.length === logLimit);
        setCurrentPage(1);
      } else {
        setLogs([]);
        setHasMoreLogs(false);
        setCurrentPage(1);
      }
      setLoading(false);
      setError(null);
    }, (err) => {
      console.error("Failed to load audit logs", err);
      setError("Failed to load audit logs. Please try again later.");
      setLoading(false);
    });

    return () => unsubscribe();
  }, [logLimit, redirectToOverview]);

  useEffect(() => {
    if (!highlightId || !logs.length) return;
    const idx = logs.findIndex((l) => l.id === highlightId);
    if (idx < 0) {
      if (hasMoreLogs && logLimit < 500) {
        setLogLimit((l) => l + 100);
      }
      return;
    }
    setExpandedId(highlightId);
    const page = Math.floor(idx / ITEMS_PER_PAGE) + 1;
    setCurrentPage(page);
    requestAnimationFrame(() => {
      highlightRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }, [highlightId, logs, hasMoreLogs, logLimit]);

  if (redirectToOverview) {
    return <Navigate to="/doctor/reports?tab=overview" replace />;
  }

  const filteredLogs = logs.filter((log) => {
    const term = searchQuery.toLowerCase();
    const matchesSearch = (log.actorName && log.actorName.toLowerCase().includes(term)) ||
                          (log.description && log.description.toLowerCase().includes(term)) ||
                          (log.metadata?.parentName && String(log.metadata.parentName).toLowerCase().includes(term));
    const matchesCategory = categoryFilter === "all" || log.category === categoryFilter;
    const matchesRole = roleFilter === "all" || log.actorRole === roleFilter;

    return matchesSearch && matchesCategory && matchesRole;
  });

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / ITEMS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedLogs = filteredLogs.slice((safePage - 1) * ITEMS_PER_PAGE, safePage * ITEMS_PER_PAGE);

  const getRoleIcon = (role) => {
    switch (role) {
      case "doctor": return <Stethoscope className="w-4 h-4" aria-hidden="true" />;
      case "secretary": return <UserCog className="w-4 h-4" aria-hidden="true" />;
      case "admin": return <Shield className="w-4 h-4" aria-hidden="true" />;
      case "system": return <AlertTriangle className="w-4 h-4" aria-hidden="true" />;
      default: return <User className="w-4 h-4" aria-hidden="true" />;
    }
  };

  const formatCategory = (categoryStr) => {
    if (!categoryStr) return "System";
    return categoryStr.split("_").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
  };

  const runConfirmAction = async () => {
    if (!confirmAction) return;
    setActionBusy(true);
    try {
      if (confirmAction.type === "deactivate") {
        await deactivateSuspiciousAccount(confirmAction.parentId, {
          auditLogId: confirmAction.auditLogId,
        });
        toast.success("Account deactivated.");
      } else if (confirmAction.type === "dismiss") {
        await dismissSuspiciousAccount(confirmAction.parentId, {
          auditLogId: confirmAction.auditLogId,
        });
        toast.success("Flag marked as reviewed.");
      }
      setConfirmAction(null);
      if (highlightId) {
        const next = new URLSearchParams(searchParams);
        next.delete("highlight");
        setSearchParams(next, { replace: true });
      }
    } catch (err) {
      toast.error(err.message || "Action failed.");
    } finally {
      setActionBusy(false);
    }
  };

  const renderSuspiciousPanel = (log) => {
    if (!isSuspiciousLog(log)) return null;
    const evidence = log.metadata?.evidence || [];
    const rules = log.metadata?.rulesTriggered || [];
    const parentId = log.targetId || log.metadata?.parentId;
    const reviewed = log.reviewStatus === "dismissed" || log.reviewStatus === "deactivated";
    const recommendation =
      log.recommendation ||
      "This user is suspicious based on reservation no-shows without QR validation. Consider deactivating this account.";

    return (
      <div className="mt-3 p-3 rounded-lg" style={{ background: "color-mix(in srgb, var(--pq-alert) 8%, transparent)" }}>
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <span className="pq-chip pq-chip-alert">Suspicious</span>
          {rules.map((ruleId) => (
            <span key={ruleId} className="pq-chip text-xs">{formatRuleLabel(ruleId)}</span>
          ))}
          {log.reviewStatus && (
            <span className="pq-chip text-xs capitalize">{log.reviewStatus}</span>
          )}
        </div>
        <p className="text-sm font-medium leading-relaxed">{recommendation}</p>
        <p className="text-xs font-semibold mt-3 mb-1">Evidence (reservation dates)</p>
        <EvidenceList evidence={evidence} />
        {!reviewed && parentId && (
          <div className="flex flex-wrap gap-2 mt-3">
            <button
              type="button"
              className="pq-btn-secondary text-sm"
              disabled={actionBusy}
              onClick={() =>
                setConfirmAction({
                  type: "dismiss",
                  parentId,
                  auditLogId: log.id,
                  title: "Mark as reviewed?",
                  message:
                    "This clears the open suspicious flag as a false positive. The account can be re-flagged if new no-shows appear later.",
                })
              }
            >
              Dismiss / Mark as Reviewed
            </button>
            <button
              type="button"
              className="pq-btn-primary text-sm"
              style={{ background: "var(--pq-alert)" }}
              disabled={actionBusy}
              onClick={() =>
                setConfirmAction({
                  type: "deactivate",
                  parentId,
                  auditLogId: log.id,
                  title: "Deactivate this account?",
                  message: `Deactivate ${log.metadata?.parentName || "this parent"}? They will not be able to sign in or reserve slots until reactivated.`,
                  destructive: true,
                })
              }
            >
              Deactivate Account
            </button>
          </div>
        )}
      </div>
    );
  };

  const rowHighlightClass = (log) =>
    highlightId === log.id
      ? "ring-2 ring-[var(--pq-alert)] ring-inset"
      : "";

  return (
    <div className="space-y-4 pb-4 md:pb-8 md:h-[calc(100vh-140px)] md:flex md:flex-col">
      <div className="pq-filter-bar p-3 sm:p-4 flex flex-col md:flex-row md:items-center gap-3">
        <div className="relative flex-1">
          <div className="pq-field-icon">
            <Search className="w-5 h-5" aria-hidden="true" />
          </div>
          <label htmlFor="activity-search" className="sr-only">Search audit logs</label>
          <input
            id="activity-search"
            type="text"
            placeholder="Search audit logs..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
            className="pq-input pl-10"
          />
        </div>

        <div className="flex gap-3">
          <div className="relative flex-1 md:flex-none">
            <label htmlFor="activity-category-filter" className="sr-only">Filter by category</label>
            <select
              id="activity-category-filter"
              value={categoryFilter}
              onChange={(e) => { setCategoryFilter(e.target.value); setCurrentPage(1); }}
              className="pq-input pr-10 appearance-none cursor-pointer min-w-[12rem]"
            >
              <option value="all">All Categories</option>
              {Object.values(AUDIT_CATEGORIES).map((cat) => (
                <option key={cat} value={cat}>{formatCategory(cat)}</option>
              ))}
            </select>
            <SelectChevron />
          </div>

          <div className="relative flex-1 md:flex-none">
            <label htmlFor="activity-role-filter" className="sr-only">Filter by role</label>
            <select
              id="activity-role-filter"
              value={roleFilter}
              onChange={(e) => { setRoleFilter(e.target.value); setCurrentPage(1); }}
              className="pq-input pr-10 appearance-none cursor-pointer min-w-[9rem]"
            >
              <option value="all">All Roles</option>
              <option value="doctor">Doctor</option>
              <option value="secretary">Secretary</option>
              <option value="system">System</option>
            </select>
            <SelectChevron />
          </div>
        </div>
      </div>

      <div className="pq-glass overflow-hidden min-h-[300px] md:flex-1 md:flex md:flex-col md:min-h-0">
        {error ? (
          <div className="flex flex-col items-center justify-center p-12 text-center md:flex-1">
            <AlertCircle className="w-12 h-12 mb-3" style={{ color: "var(--pq-alert)" }} aria-hidden="true" />
            <p className="font-extrabold tracking-tight">{error}</p>
          </div>
        ) : loading && logs.length === 0 ? (
          <PqSpinner label="Loading audit logs" />
        ) : filteredLogs.length > 0 ? (
          <>
            <div className="block md:hidden overflow-y-auto pq-scroll-hide">
              {paginatedLogs.map((log) => (
                <div
                  key={log.id}
                  ref={highlightId === log.id ? highlightRef : undefined}
                  className={`p-5 flex flex-col gap-3 ${rowHighlightClass(log)}`}
                  style={{ borderTop: "1px solid var(--pq-glass-line)" }}
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      {isSuspiciousLog(log) && (
                        <span className="pq-chip pq-chip-alert">Suspicious</span>
                      )}
                      <h3 className="font-extrabold tracking-tight text-sm leading-tight">{log.description}</h3>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs pq-muted flex items-center gap-1 leading-none">
                        <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                        {formatDateTime(log.timestamp)}
                      </span>
                    </div>
                  </div>

                  <div className="pq-row" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", minHeight: 0, alignItems: "start" }}>
                    <div className="text-sm min-w-0">
                      <span className="pq-faint text-xs block mb-1">Actor</span>
                      <span className="font-semibold block truncate">{log.actorName}</span>
                      <span className={`${roleChip(log.actorRole)} capitalize mt-1`}>
                        {getRoleIcon(log.actorRole)}
                        {log.actorRole}
                      </span>
                    </div>
                    <div className="text-sm min-w-0">
                      <span className="pq-faint text-xs block mb-1">Category</span>
                      <span className="pq-chip max-w-full truncate">
                        {formatCategory(log.category)}
                      </span>
                    </div>
                  </div>

                  {isSuspiciousLog(log) && (
                    <button
                      type="button"
                      className="pq-btn-ghost text-sm self-start"
                      onClick={() => setExpandedId((id) => (id === log.id ? null : log.id))}
                    >
                      {expandedId === log.id ? "Hide details" : "View details & actions"}
                    </button>
                  )}
                  {expandedId === log.id && renderSuspiciousPanel(log)}
                </div>
              ))}
            </div>

            <div className="hidden md:block md:flex-1 md:overflow-y-auto relative pq-scroll-hide">
              <table className="pq-table">
                <thead className="pq-table-head-sticky">
                  <tr>
                    <th className="pl-6 w-px whitespace-nowrap">Date & Time</th>
                    <th className="w-px whitespace-nowrap">Actor</th>
                    <th className="w-px whitespace-nowrap">Role</th>
                    <th>Activity</th>
                    <th className="pr-6 w-px whitespace-nowrap">Category</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedLogs.map((log) => (
                    <tr
                      key={log.id}
                      ref={highlightId === log.id ? highlightRef : undefined}
                      className={rowHighlightClass(log)}
                    >
                      <td className="pl-6 w-px whitespace-nowrap align-top">
                        <p className="text-sm font-medium leading-tight">{formatLogDate(log.timestamp)}</p>
                        <p className="text-xs pq-muted mt-0.5 leading-tight">{formatLogTime(log.timestamp)}</p>
                      </td>
                      <td className="w-px max-w-[9rem] align-top">
                        <span className="font-semibold block truncate">{log.actorName}</span>
                      </td>
                      <td className="align-top">
                        <span className={`${roleChip(log.actorRole)} capitalize`}>
                          {getRoleIcon(log.actorRole)}
                          {log.actorRole}
                        </span>
                      </td>
                      <td className="text-sm font-semibold align-top">
                        <div className="flex flex-wrap items-center gap-2">
                          {isSuspiciousLog(log) && (
                            <span className="pq-chip pq-chip-alert">Suspicious</span>
                          )}
                          <span>{log.description}</span>
                        </div>
                        {isSuspiciousLog(log) && (
                          <button
                            type="button"
                            className="pq-btn-ghost text-xs mt-2 px-0"
                            onClick={() => setExpandedId((id) => (id === log.id ? null : log.id))}
                          >
                            {expandedId === log.id ? "Hide details" : "View details & actions"}
                          </button>
                        )}
                        {expandedId === log.id && renderSuspiciousPanel(log)}
                      </td>
                      <td className="pr-6 align-top">
                        <span className="pq-chip">
                          {formatCategory(log.category)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div
              className="flex flex-col sm:flex-row sm:items-center justify-between px-5 py-4 gap-4 md:flex-none z-10"
              style={{ borderTop: "1px solid var(--pq-glass-line)" }}
            >
              <div className="text-sm pq-muted font-medium text-center sm:text-left">
                Showing {(safePage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(safePage * ITEMS_PER_PAGE, filteredLogs.length)} of {filteredLogs.length} matching {filteredLogs.length === 1 ? "record" : "records"}
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={safePage === 1}
                    className="pq-btn-secondary"
                  >
                    Previous
                  </button>
                  <span className="text-sm font-medium pq-muted px-2">
                    Page {safePage} of {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={safePage === totalPages}
                    className="pq-btn-secondary"
                  >
                    Next
                  </button>
                </div>

                {hasMoreLogs && (
                  <button
                    type="button"
                    onClick={() => setLogLimit((l) => l + 100)}
                    disabled={loading}
                    className="pq-btn-secondary"
                  >
                    {loading ? (
                      <span className="pq-spinner w-4 h-4 border-2" aria-hidden="true" />
                    ) : (
                      <ArrowDownToLine className="w-4 h-4" aria-hidden="true" />
                    )}
                    Load Older Logs
                  </button>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center p-12 text-center md:flex-1">
            <ActivityIcon className="w-12 h-12 pq-faint mb-3" aria-hidden="true" />
            <p className="font-extrabold tracking-tight">No activity logs found.</p>
            {(searchQuery || categoryFilter !== "all" || roleFilter !== "all") && (
              <button
                type="button"
                onClick={() => { setSearchQuery(""); setCategoryFilter("all"); setRoleFilter("all"); setCurrentPage(1); }}
                className="pq-btn-ghost mt-4"
              >
                Clear Filters
              </button>
            )}
          </div>
        )}
      </div>

      <ConfirmationModal
        isOpen={Boolean(confirmAction)}
        onClose={() => !actionBusy && setConfirmAction(null)}
        onConfirm={runConfirmAction}
        title={confirmAction?.title || "Confirm"}
        message={confirmAction?.message || ""}
        confirmText={confirmAction?.type === "deactivate" ? "Deactivate" : "Mark Reviewed"}
        isDestructive={Boolean(confirmAction?.destructive)}
        isLoading={actionBusy}
      />
    </div>
  );
}
