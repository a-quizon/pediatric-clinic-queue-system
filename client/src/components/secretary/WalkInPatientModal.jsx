import React, { useState, useEffect, useRef } from "react";
import { X, AlertCircle } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { subscribeToPublishedSchedules } from "../../services/scheduleService";
import {
  subscribeToScheduleReservations,
  createWalkInReservation,
  ACTIVE_RESERVATION_STATUSES,
} from "../../services/reservationService";
import { getChildAgeError } from "../parent/ChildProfileForm";
import { scheduleMatchesAssignedBranch, formatBranchLabel } from "../../utils/stringUtils";
import MessageModal from "../common/MessageModal";

const MAX_CHILDREN = 10;

const emptyChild = () => ({ childName: "", age: "", sex: "" });

const formatTime = (time) => {
  if (!time) return "";
  const [hours, minutes] = time.split(":");
  const h = parseInt(hours, 10);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${minutes} ${ampm}`;
};

const getLocalDateString = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const isQueueEnded = (schedule) =>
  ["closed", "ended", "completed"].includes(schedule?.queueStatus);

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

export default function WalkInPatientModal({ isOpen, onClose }) {
  const { user } = useAuth();
  const [schedules, setSchedules] = useState([]);
  const [scheduleCapacities, setScheduleCapacities] = useState({});
  const [selectedScheduleId, setSelectedScheduleId] = useState("");
  const [childCountInput, setChildCountInput] = useState("1");
  const [children, setChildren] = useState([emptyChild()]);
  const [concern, setConcern] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [childCountError, setChildCountError] = useState("");
  const [messageModal, setMessageModal] = useState({
    isOpen: false,
    type: "info",
    title: "",
    message: "",
  });

  const activeListenersRef = useRef({});
  const assignedBranch = user?.assignedBranch;
  const assignedBranchId = user?.assignedBranchId;

  const resetForm = () => {
    setSelectedScheduleId("");
    setChildCountInput("1");
    setChildren([emptyChild()]);
    setConcern("");
    setChildCountError("");
    setIsSubmitting(false);
  };

  useEffect(() => {
    if (!isOpen) return undefined;

    const unsub = subscribeToPublishedSchedules((data) => {
      const today = getLocalDateString();
      const filtered = data
        .filter((s) => scheduleMatchesAssignedBranch(s, user))
        .filter((s) => s.status === "published")
        .filter((s) => !isQueueEnded(s))
        .filter((s) => String(s.clinicDate || "") >= today)
        .sort((a, b) => {
          const dateDiff = new Date(a.clinicDate) - new Date(b.clinicDate);
          if (dateDiff !== 0) return dateDiff;
          return String(a.openingTime || "").localeCompare(String(b.openingTime || ""));
        });
      setSchedules(filtered);
    });

    return () => {
      unsub();
      Object.values(activeListenersRef.current).forEach((unsubFn) => unsubFn && unsubFn());
      activeListenersRef.current = {};
    };
    // Intentionally depend on branch identity, not the whole user object (avoids resubscribe churn).
  }, [isOpen, assignedBranch, assignedBranchId, user]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const currentIds = new Set(schedules.map((s) => s.id));

    schedules.forEach((schedule) => {
      if (activeListenersRef.current[schedule.id]) return;
      activeListenersRef.current[schedule.id] = subscribeToScheduleReservations(
        schedule.id,
        (data) => {
          const count = data.filter((r) => ACTIVE_RESERVATION_STATUSES.includes(r.status)).length;
          setScheduleCapacities((prev) => ({ ...prev, [schedule.id]: count }));
        }
      );
    });

    Object.keys(activeListenersRef.current).forEach((id) => {
      if (!currentIds.has(id)) {
        activeListenersRef.current[id]?.();
        delete activeListenersRef.current[id];
      }
    });
  }, [isOpen, schedules]);

  // Reset only when the modal closes — not on unrelated re-renders.
  useEffect(() => {
    if (!isOpen) {
      resetForm();
    }
  }, [isOpen]);

  // Clear selection if the chosen schedule disappears from the list (e.g. ended).
  useEffect(() => {
    if (!selectedScheduleId) return;
    if (!schedules.some((s) => s.id === selectedScheduleId)) {
      setSelectedScheduleId("");
    }
  }, [schedules, selectedScheduleId]);

  const applyChildCountToFields = (raw) => {
    const n = parseChildCount(raw);
    if (n == null) {
      setChildCountError(`Enter a whole number from 1 to ${MAX_CHILDREN}.`);
      return false;
    }
    setChildCountError("");
    setChildCountInput(String(n));
    setChildren((prev) => resizeChildren(prev, n));
    return true;
  };

  const handleChildCountChange = (e) => {
    // Allow free typing (including empty). Never coerce invalid/empty back to 1.
    const raw = e.target.value.replace(/[^0-9]/g, "");
    setChildCountInput(raw);
    if (childCountError) setChildCountError("");

    // When the typed value is already a complete valid count, resize field groups
    // reactively (preserving data for groups that remain).
    const n = parseChildCount(raw);
    if (n != null) {
      setChildren((prev) => resizeChildren(prev, n));
    }
  };

  const handleChildCountBlur = () => {
    if (childCountInput === "") {
      setChildCountError(`Enter a whole number from 1 to ${MAX_CHILDREN}.`);
      return;
    }
    applyChildCountToFields(childCountInput);
  };

  const updateChild = (index, partial) => {
    setChildren((prev) => prev.map((child, i) => (i === index ? { ...child, ...partial } : child)));
  };

  const handleAgeChange = (index, rawVal) => {
    updateChild(index, { age: rawVal.replace(/[^0-9]/g, "") });
  };

  const selectedSchedule = schedules.find((s) => s.id === selectedScheduleId) || null;
  const selectedCount = selectedSchedule ? scheduleCapacities[selectedSchedule.id] ?? 0 : 0;
  const selectedIsFull =
    selectedSchedule && selectedCount >= Number(selectedSchedule.slotCapacity || 0);

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

  const canSubmit =
    selectedSchedule &&
    !selectedIsFull &&
    childCountValid &&
    fieldsMatchCount &&
    childrenValid &&
    !isSubmitting;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user?.uid) return;

    const n = parseChildCount(childCountInput);
    if (n == null) {
      setChildCountError(`Enter a whole number from 1 to ${MAX_CHILDREN}.`);
      return;
    }
    setChildCountError("");
    setChildCountInput(String(n));

    const schedule = schedules.find((s) => s.id === selectedScheduleId);
    if (!schedule) return;
    const activeCount = scheduleCapacities[schedule.id] ?? 0;
    if (activeCount >= Number(schedule.slotCapacity || 0)) return;

    const finalChildren = resizeChildren(children, n);
    setChildren(finalChildren);

    const allValid = finalChildren.every((c) => {
      const nameOk = Boolean(c.childName?.trim());
      const age = c.age?.trim() || "";
      const sexOk = Boolean(c.sex);
      return nameOk && /^\d+$/.test(age) && !getChildAgeError(age) && sexOk;
    });
    if (!allValid) return;

    setIsSubmitting(true);
    try {
      await createWalkInReservation({
        scheduleId: schedule.id,
        children: finalChildren,
        concern,
        secretaryUid: user.uid,
      });
      setMessageModal({
        isOpen: true,
        type: "success",
        title: "Walk-in Checked In",
        message:
          "The walk-in patient has been added to the queue and marked as checked in.",
      });
      resetForm();
    } catch (err) {
      console.error("Walk-in reservation failed", err);
      setMessageModal({
        isOpen: true,
        type: "error",
        title: "Walk-in Failed",
        message: err?.message || "Could not create the walk-in reservation. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMessageClose = () => {
    const wasSuccess = messageModal.type === "success";
    setMessageModal((prev) => ({ ...prev, isOpen: false }));
    if (wasSuccess) onClose();
  };

  const formatScheduleOption = (schedule) => {
    const count = scheduleCapacities[schedule.id] ?? 0;
    const capacity = Number(schedule.slotCapacity || 0);
    const remaining = Math.max(capacity - count, 0);
    const dateLabel = new Date(schedule.clinicDate).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    const timeLabel = `${formatTime(schedule.openingTime)} – ${formatTime(schedule.closingTime)}`;
    const fullTag = remaining <= 0 ? " (Full)" : ` (${remaining}/${capacity} slots left)`;
    return `${formatBranchLabel(schedule.branch)} · ${dateLabel} · ${timeLabel}${fullTag}`;
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="pq-modal-scrim z-50">
        <div className="pq-glass-modal w-full max-w-lg flex flex-col max-h-[90vh] overflow-hidden" role="dialog" aria-modal="true" aria-labelledby="walkin-title">
          <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid var(--pq-glass-line)" }}>
            <h2 id="walkin-title" className="text-lg font-extrabold tracking-tight">Walk-in Patient</h2>
            <button
              type="button"
              onClick={onClose}
              className="pq-icon-btn"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
            <div className="px-6 py-5 space-y-6 overflow-y-auto flex-1">
              <section>
                <label htmlFor="walkin-schedule" className="pq-label">1. Select schedule</label>
                {schedules.length === 0 ? (
                  <p className="text-sm pq-muted pq-row block min-h-0">
                    No published schedules available for your assigned branch.
                  </p>
                ) : (
                  <select
                    id="walkin-schedule"
                    value={selectedScheduleId}
                    onChange={(e) => setSelectedScheduleId(e.target.value)}
                    required
                    className="pq-input"
                  >
                    <option value="">Select a schedule</option>
                    {schedules.map((schedule) => {
                      const count = scheduleCapacities[schedule.id] ?? 0;
                      const capacity = Number(schedule.slotCapacity || 0);
                      const isFull = count >= capacity;
                      return (
                        <option key={schedule.id} value={schedule.id} disabled={isFull}>
                          {formatScheduleOption(schedule)}
                        </option>
                      );
                    })}
                  </select>
                )}
                {selectedIsFull && (
                  <p className="mt-1.5 pq-error-text flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" aria-hidden="true" />
                    This schedule is full.
                  </p>
                )}
              </section>

              <section>
                <label htmlFor="walkin-child-count" className="pq-label">
                  2. How many children will be checked in?
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
              </section>

              {fieldsMatchCount && (
                <section className="space-y-3">
                  <h3 className="text-sm font-extrabold tracking-tight">3. Child details</h3>
                  {children.map((child, index) => {
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
                        <p className="pq-stat-label">
                          Child {index + 1}
                        </p>
                        <div className="min-w-0">
                          <label
                            htmlFor={`walkin-child-${index}-name`}
                            className="pq-label"
                          >
                            Child Name <span style={{ color: "var(--pq-alert)" }}>*</span>
                          </label>
                          <input
                            id={`walkin-child-${index}-name`}
                            type="text"
                            value={child.childName}
                            onChange={(e) => updateChild(index, { childName: e.target.value })}
                            placeholder="Enter child's full name"
                            className="pq-input"
                          />
                        </div>
                        <div
                          className="grid gap-3"
                          style={{ gridTemplateColumns: "5.75rem minmax(0, 1fr)" }}
                        >
                          <div className="min-w-0">
                            <label
                              htmlFor={`walkin-child-${index}-age`}
                              className="pq-label"
                            >
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
                            {ageError && (
                              <p className="mt-1 pq-error-text">{ageError}</p>
                            )}
                          </div>
                          <div className="min-w-0">
                            <label
                              htmlFor={`walkin-child-${index}-sex`}
                              className="pq-label"
                            >
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
                </section>
              )}

              <section>
                <h3 className="text-sm font-extrabold tracking-tight mb-2">4. Concern</h3>
                <label htmlFor="walkin-concern" className="pq-label">
                  Concern / Reason for Visit
                </label>
                <textarea
                  id="walkin-concern"
                  value={concern}
                  onChange={(e) => setConcern(e.target.value)}
                  placeholder="Optional: briefly describe the symptoms or reason for visit"
                  rows={3}
                  className="pq-input resize-none"
                />
              </section>
            </div>

            <div className="px-6 py-4 flex gap-3" style={{ borderTop: "1px solid var(--pq-glass-line)" }}>
              <button
                type="button"
                onClick={onClose}
                className="pq-btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!canSubmit}
                className="pq-btn-primary flex-1"
              >
                {isSubmitting ? "Checking in..." : "Check In Walk-in"}
              </button>
            </div>
          </form>
        </div>
      </div>

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
