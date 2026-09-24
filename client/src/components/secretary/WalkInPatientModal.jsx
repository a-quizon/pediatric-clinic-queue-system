import { useState, useEffect, useRef } from "react";
import { X, AlertCircle, Phone, ChevronDown, ChevronUp } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import {
  subscribeToScheduleReservations,
  createWalkInReservation,
  ACTIVE_RESERVATION_STATUSES,
} from "../../services/reservationService";
import { getChildAgeError } from "../parent/ChildProfileForm";
import { formatBranchLabel } from "../../utils/stringUtils";
import { formatToE164 } from "../../utils/phoneUtils";
import MessageModal from "../common/MessageModal";
import ModalScrim from "../common/ModalScrim";
import { useHistoryOverlay } from "../../hooks/useHistoryOverlay";

const MAX_CHILDREN = 10;

const emptyChild = () => ({ childName: "", age: "", sex: "" });

const initialFormState = () => ({
  childCountInput: "1",
  children: [emptyChild()],
  parentName: "",
  parentPhoneLocal: "",
  parentPhoneError: "",
  showPhoneIn: false,
  showMoreChildren: false,
  concern: "",
  concernError: "",
  childCountError: "",
});

const formatTime = (time) => {
  if (!time) return "";
  const [hours, minutes] = time.split(":");
  const h = parseInt(hours, 10);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${minutes} ${ampm}`;
};

const isQueueAcceptingWalkIns = (schedule) => {
  const qs = schedule?.queueStatus;
  return (
    schedule?.status === "published" &&
    !schedule?.dayClosed &&
    (qs === "active" || qs === "paused")
  );
};

/** Resize children[] to match a validated count; keep existing entries for groups that remain. */
const resizeChildren = (prev, count) => {
  if (count === prev.length) return prev;
  if (count > prev.length) {
    return [...prev, ...Array.from({ length: count - prev.length }, emptyChild)];
  }
  return prev.slice(0, count);
};

const parseChildCount = (raw) => {
  if (raw === "" || raw == null) return null;
  if (!/^\d+$/.test(String(raw).trim())) return null;
  const n = parseInt(raw, 10);
  if (!Number.isInteger(n) || n < 1 || n > MAX_CHILDREN) return null;
  return n;
};

/**
 * Desk walk-in form bound to the live Manage Queue / Doctor queue schedule.
 * @param {{ isOpen: boolean, onClose: () => void, schedule: object | null }} props
 */
export default function WalkInPatientModal({ isOpen, onClose, schedule = null }) {
  const { user } = useAuth();
  const nameInputRef = useRef(null);
  const submitLockRef = useRef(false);

  const [activeCount, setActiveCount] = useState(0);
  const [form, setForm] = useState(initialFormState);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [messageModal, setMessageModal] = useState({
    isOpen: false,
    type: "info",
    title: "",
    message: "",
  });

  const {
    childCountInput,
    children,
    parentName,
    parentPhoneLocal,
    parentPhoneError,
    showPhoneIn,
    showMoreChildren,
    concern,
    concernError,
    childCountError,
  } = form;

  const patchForm = (partial) => setForm((prev) => ({ ...prev, ...partial }));

  const handleClose = () => {
    if (isSubmitting) return;
    onClose();
  };

  useHistoryOverlay(isOpen, handleClose);

  useEffect(() => {
    if (!isOpen || !schedule?.id) return undefined;

    const unsub = subscribeToScheduleReservations(schedule.id, (data) => {
      const count = data.filter((r) => ACTIVE_RESERVATION_STATUSES.includes(r.status)).length;
      setActiveCount(count);
    });

    return () => unsub();
  }, [isOpen, schedule?.id]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && !isSubmitting && !messageModal.isOpen) {
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isSubmitting, messageModal.isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const t = window.setTimeout(() => {
      nameInputRef.current?.focus();
    }, 50);
    return () => window.clearTimeout(t);
  }, [isOpen]);

  const applyChildCountToFields = (raw) => {
    const n = parseChildCount(raw);
    if (n == null) {
      patchForm({ childCountError: `Enter a whole number from 1 to ${MAX_CHILDREN}.` });
      return false;
    }
    setForm((prev) => ({
      ...prev,
      childCountError: "",
      childCountInput: String(n),
      children: resizeChildren(prev.children, n),
    }));
    return true;
  };

  const handleChildCountChange = (e) => {
    const raw = e.target.value.replace(/[^0-9]/g, "");
    setForm((prev) => {
      const n = parseChildCount(raw);
      return {
        ...prev,
        childCountInput: raw,
        childCountError: "",
        children: n != null ? resizeChildren(prev.children, n) : prev.children,
      };
    });
  };

  const handleChildCountBlur = () => {
    if (childCountInput === "") {
      patchForm({ childCountError: `Enter a whole number from 1 to ${MAX_CHILDREN}.` });
      return;
    }
    applyChildCountToFields(childCountInput);
  };

  const updateChild = (index, partial) => {
    setForm((prev) => ({
      ...prev,
      children: prev.children.map((child, i) => (i === index ? { ...child, ...partial } : child)),
    }));
  };

  const handleAgeChange = (index, rawVal) => {
    updateChild(index, { age: rawVal.replace(/[^0-9]/g, "") });
  };

  const capacity = Number(schedule?.slotCapacity || 0);
  const remaining = Math.max(capacity - activeCount, 0);
  const isFull = capacity > 0 && activeCount >= capacity;
  const accepting = isQueueAcceptingWalkIns(schedule);
  const blockReason = !schedule
    ? "No live queue is selected."
    : schedule.dayClosed
      ? "This clinic day is closed."
      : !accepting
        ? "Walk-ins can only be added while the queue is active or paused."
        : isFull
          ? "This day is full. A slot opens when someone cancels or finishes."
          : "";

  const parsedCount = parseChildCount(childCountInput);
  const childCountValid = parsedCount != null;
  const fieldsMatchCount = childCountValid && children.length === parsedCount;

  const childrenValid =
    fieldsMatchCount &&
    children.every((c) => {
      const nameOk = Boolean(c.childName?.trim());
      const age = c.age?.trim() || "";
      const sexOk = Boolean(c.sex);
      return nameOk && /^\d+$/.test(age) && !getChildAgeError(age) && sexOk;
    });

  const concernValid = Boolean(concern.trim());
  const parentPhoneValid = parentPhoneLocal === "" || parentPhoneLocal.length === 10;

  const canSubmit =
    accepting &&
    !isFull &&
    childCountValid &&
    fieldsMatchCount &&
    childrenValid &&
    concernValid &&
    parentPhoneValid &&
    !isSubmitting;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user?.uid || !schedule?.id || isSubmitting || submitLockRef.current) return;

    const n = parseChildCount(childCountInput);
    if (n == null) {
      patchForm({ childCountError: `Enter a whole number from 1 to ${MAX_CHILDREN}.` });
      return;
    }

    if (!concern.trim()) {
      patchForm({ concernError: "A visit concern is required.", childCountError: "", childCountInput: String(n) });
      return;
    }

    if (!accepting || isFull) return;

    const finalChildren = resizeChildren(children, n);
    patchForm({
      children: finalChildren,
      childCountInput: String(n),
      childCountError: "",
      concernError: "",
    });

    const allValid = finalChildren.every((c) => {
      const nameOk = Boolean(c.childName?.trim());
      const age = c.age?.trim() || "";
      const sexOk = Boolean(c.sex);
      return nameOk && /^\d+$/.test(age) && !getChildAgeError(age) && sexOk;
    });
    if (!allValid) return;

    if (parentPhoneLocal && parentPhoneLocal.length !== 10) {
      patchForm({ parentPhoneError: "Enter a valid 10-digit mobile number, or leave this blank." });
      return;
    }
    patchForm({ parentPhoneError: "" });

    submitLockRef.current = true;
    setIsSubmitting(true);
    try {
      const result = await createWalkInReservation({
        scheduleId: schedule.id,
        children: finalChildren,
        concern,
        secretaryUid: user.uid,
        parentName,
        parentPhone: parentPhoneLocal ? formatToE164(parentPhoneLocal) : "",
      });
      const ticket = result?.queueNumber != null ? `#${result.queueNumber}` : "a ticket";
      setMessageModal({
        isOpen: true,
        type: "success",
        title: "Walk-in Checked In",
        message: `Queue number ${ticket} — tell them their number. They are checked in and waiting in line.`,
      });
      setForm(initialFormState());
    } catch (err) {
      console.error("Walk-in reservation failed", err);
      setMessageModal({
        isOpen: true,
        type: "error",
        title: "Walk-in Failed",
        message: err?.message || "Could not create the walk-in reservation. Please try again.",
      });
    } finally {
      submitLockRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handleMessageClose = () => {
    const wasSuccess = messageModal.type === "success";
    setMessageModal((prev) => ({ ...prev, isOpen: false }));
    if (wasSuccess) onClose();
  };

  const scheduleSummary = schedule
    ? `${formatBranchLabel(schedule.branch)} · ${formatTime(schedule.openingTime)} – ${formatTime(schedule.closingTime)}`
    : "";

  if (!isOpen) return null;

  return (
    <>
      <ModalScrim className="z-50" onClick={(e) => e.target === e.currentTarget && !isSubmitting && handleClose()}>
        <div
          className="pq-modal w-full max-w-lg flex flex-col max-h-[90vh] overflow-hidden"
          role="dialog"
          aria-modal="true"
          aria-labelledby="walkin-title"
          data-tour="walkin-form"
        >
          <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid var(--pq-glass-line)" }}>
            <h2 id="walkin-title" className="text-lg font-extrabold tracking-tight">
              Add Walk-in
            </h2>
            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              className="pq-icon-btn"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
            <div className="px-6 py-5 space-y-5 overflow-y-auto flex-1">
              {schedule && (
                <div className="pq-row min-h-0 flex-col items-stretch gap-1.5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-extrabold tracking-tight truncate">{scheduleSummary}</p>
                    <p className="text-xs pq-muted">
                      {schedule.queueStatus === "paused" ? "Paused — joins the live line" : "Active — joins the live line"}
                    </p>
                  </div>
                  <span className={`pq-chip shrink-0 ${isFull ? "pq-chip-alert" : "pq-chip-info"}`}>
                    {remaining}/{capacity} slots left
                  </span>
                </div>
              )}

              {blockReason ? (
                <p className="pq-error-text flex items-start gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" aria-hidden="true" />
                  {blockReason}
                </p>
              ) : null}

              <section className="space-y-3">
                <div
                  className="space-y-3"
                  style={{
                    display: "block",
                    minHeight: 0,
                    padding: "1rem",
                    borderRadius: "0.9rem",
                    background: "color-mix(in srgb, #ffffff 55%, transparent)",
                    border: "1px solid var(--pq-glass-line)",
                  }}
                >
                  <div className="min-w-0">
                    <label htmlFor="walkin-child-0-name" className="pq-label">
                      Child name <span style={{ color: "var(--pq-alert)" }}>*</span>
                    </label>
                    <input
                      ref={nameInputRef}
                      id="walkin-child-0-name"
                      type="text"
                      value={children[0]?.childName || ""}
                      onChange={(e) => updateChild(0, { childName: e.target.value })}
                      placeholder="Full name"
                      autoComplete="off"
                      className="pq-input"
                      disabled={Boolean(blockReason)}
                    />
                  </div>
                  <div className="grid gap-3" style={{ gridTemplateColumns: "5.75rem minmax(0, 1fr)" }}>
                    <div className="min-w-0">
                      <label htmlFor="walkin-child-0-age" className="pq-label">
                        Age <span style={{ color: "var(--pq-alert)" }}>*</span>
                      </label>
                      <input
                        id="walkin-child-0-age"
                        type="text"
                        inputMode="numeric"
                        value={children[0]?.age || ""}
                        onChange={(e) => handleAgeChange(0, e.target.value)}
                        onKeyDown={(e) => {
                          if (["e", "E", "+", "-", "."].includes(e.key)) e.preventDefault();
                        }}
                        placeholder="Yrs"
                        className={`pq-input ${getChildAgeError(children[0]?.age || "") ? "pq-input-error" : ""}`}
                        disabled={Boolean(blockReason)}
                      />
                      {getChildAgeError(children[0]?.age || "") && (
                        <p className="mt-1 pq-error-text">{getChildAgeError(children[0]?.age || "")}</p>
                      )}
                    </div>
                    <div className="min-w-0">
                      <label htmlFor="walkin-child-0-sex" className="pq-label">
                        Sex <span style={{ color: "var(--pq-alert)" }}>*</span>
                      </label>
                      <select
                        id="walkin-child-0-sex"
                        value={children[0]?.sex || ""}
                        onChange={(e) => updateChild(0, { sex: e.target.value })}
                        className="pq-input cursor-pointer min-w-0"
                        disabled={Boolean(blockReason)}
                      >
                        <option value="">Select</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div>
                  <label htmlFor="walkin-concern" className="pq-label">
                    Concern / reason <span style={{ color: "var(--pq-alert)" }}>*</span>
                  </label>
                  <textarea
                    id="walkin-concern"
                    value={concern}
                    onChange={(e) => patchForm({ concern: e.target.value, concernError: "" })}
                    placeholder="Brief reason for the visit"
                    rows={2}
                    className={`pq-input resize-none ${concernError ? "pq-input-error" : ""}`}
                    disabled={Boolean(blockReason)}
                    required
                  />
                  {concernError && (
                    <p className="mt-1.5 pq-error-text flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" aria-hidden="true" />
                      {concernError}
                    </p>
                  )}
                </div>
              </section>

              <div className="space-y-2">
                <button
                  type="button"
                  className="pq-btn-ghost w-full justify-between"
                  onClick={() => patchForm({ showPhoneIn: !showPhoneIn })}
                  aria-expanded={showPhoneIn}
                >
                  <span>Phone-in details (optional)</span>
                  {showPhoneIn ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                {showPhoneIn && (
                  <div className="space-y-3 pt-1">
                    <p className="text-xs pq-muted">
                      For phone bookings so the clinic can text reservation details. Leave blank for in-person walk-ins.
                    </p>
                    <div>
                      <label htmlFor="walkin-parent-name" className="pq-label">
                        Parent&apos;s name
                      </label>
                      <input
                        id="walkin-parent-name"
                        type="text"
                        value={parentName}
                        onChange={(e) => patchForm({ parentName: e.target.value })}
                        placeholder="Optional"
                        autoComplete="name"
                        className="pq-input"
                      />
                    </div>
                    <div>
                      <label htmlFor="walkin-parent-phone" className="pq-label">
                        Parent&apos;s phone
                      </label>
                      <div className="relative">
                        <div className="pq-field-icon gap-2">
                          <Phone className="h-5 w-5" aria-hidden="true" />
                          <span className="pq-muted font-medium">+63</span>
                        </div>
                        <input
                          id="walkin-parent-phone"
                          type="tel"
                          inputMode="numeric"
                          maxLength={10}
                          value={parentPhoneLocal}
                          onChange={(e) => {
                            const sanitized = e.target.value.replace(/\D/g, "").slice(0, 10);
                            patchForm({ parentPhoneLocal: sanitized, parentPhoneError: "" });
                          }}
                          autoComplete="tel-national"
                          className={`pq-input pl-20 ${parentPhoneError ? "pq-input-error" : ""}`}
                          placeholder="9123456789"
                        />
                      </div>
                      {parentPhoneError && (
                        <p className="mt-1.5 pq-error-text flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5" aria-hidden="true" />
                          {parentPhoneError}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <button
                  type="button"
                  className="pq-btn-ghost w-full justify-between"
                  onClick={() => {
                    if (showMoreChildren) {
                      setForm((prev) => ({
                        ...prev,
                        showMoreChildren: false,
                        childCountInput: "1",
                        children: resizeChildren(prev.children, 1),
                        childCountError: "",
                      }));
                    } else {
                      patchForm({ showMoreChildren: true });
                    }
                  }}
                  aria-expanded={showMoreChildren}
                >
                  <span>More children (same ticket)</span>
                  {showMoreChildren ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                {showMoreChildren && (
                  <div className="space-y-3 pt-1">
                    <div>
                      <label htmlFor="walkin-child-count" className="pq-label">
                        How many children?
                      </label>
                      <input
                        id="walkin-child-count"
                        type="text"
                        inputMode="numeric"
                        autoComplete="off"
                        value={childCountInput}
                        onChange={handleChildCountChange}
                        onBlur={handleChildCountBlur}
                        placeholder={`1–${MAX_CHILDREN}`}
                        className={`pq-input ${childCountError ? "pq-input-error" : ""}`}
                      />
                      {childCountError && (
                        <p className="mt-1.5 pq-error-text flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5" aria-hidden="true" />
                          {childCountError}
                        </p>
                      )}
                      <p className="mt-1 text-xs pq-muted">Still one slot and one queue number.</p>
                    </div>
                    {fieldsMatchCount &&
                      children.slice(1).map((child, offset) => {
                        const index = offset + 1;
                        const ageError = getChildAgeError(child.age || "");
                        return (
                          <div
                            key={index}
                            className="space-y-3"
                            style={{
                              display: "block",
                              minHeight: 0,
                              padding: "1rem",
                              borderRadius: "0.9rem",
                              background: "color-mix(in srgb, #ffffff 55%, transparent)",
                              border: "1px solid var(--pq-glass-line)",
                            }}
                          >
                            <p className="pq-stat-label">Child {index + 1}</p>
                            <div className="min-w-0">
                              <label htmlFor={`walkin-child-${index}-name`} className="pq-label">
                                Child name <span style={{ color: "var(--pq-alert)" }}>*</span>
                              </label>
                              <input
                                id={`walkin-child-${index}-name`}
                                type="text"
                                value={child.childName}
                                onChange={(e) => updateChild(index, { childName: e.target.value })}
                                placeholder="Full name"
                                className="pq-input"
                              />
                            </div>
                            <div className="grid gap-3" style={{ gridTemplateColumns: "5.75rem minmax(0, 1fr)" }}>
                              <div className="min-w-0">
                                <label htmlFor={`walkin-child-${index}-age`} className="pq-label">
                                  Age <span style={{ color: "var(--pq-alert)" }}>*</span>
                                </label>
                                <input
                                  id={`walkin-child-${index}-age`}
                                  type="text"
                                  inputMode="numeric"
                                  value={child.age}
                                  onChange={(e) => handleAgeChange(index, e.target.value)}
                                  onKeyDown={(e) => {
                                    if (["e", "E", "+", "-", "."].includes(e.key)) e.preventDefault();
                                  }}
                                  placeholder="Yrs"
                                  className={`pq-input ${ageError ? "pq-input-error" : ""}`}
                                />
                                {ageError && <p className="mt-1 pq-error-text">{ageError}</p>}
                              </div>
                              <div className="min-w-0">
                                <label htmlFor={`walkin-child-${index}-sex`} className="pq-label">
                                  Sex <span style={{ color: "var(--pq-alert)" }}>*</span>
                                </label>
                                <select
                                  id={`walkin-child-${index}-sex`}
                                  value={child.sex || ""}
                                  onChange={(e) => updateChild(index, { sex: e.target.value })}
                                  className="pq-input cursor-pointer min-w-0"
                                >
                                  <option value="">Select</option>
                                  <option value="Male">Male</option>
                                  <option value="Female">Female</option>
                                </select>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            </div>

            <div className="px-6 py-4 flex gap-3" style={{ borderTop: "1px solid var(--pq-glass-line)" }}>
              <button type="button" onClick={handleClose} disabled={isSubmitting} className="pq-btn-secondary flex-1">
                Cancel
              </button>
              <button type="submit" disabled={!canSubmit} className="pq-btn-primary flex-1">
                {isSubmitting ? "Checking in..." : "Check In Walk-in"}
              </button>
            </div>
          </form>
        </div>
      </ModalScrim>

      <MessageModal
        isOpen={messageModal.isOpen}
        type={messageModal.type}
        title={messageModal.title}
        message={messageModal.message}
        onClose={handleMessageClose}
      />
    </>
  );
}
