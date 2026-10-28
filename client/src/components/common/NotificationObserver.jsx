import React, { useEffect, useRef } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { subscribeToAllSchedules, subscribeToUpcomingPublishedSchedules } from '../../services/scheduleService';
import { subscribeToParentReservations, subscribeToScheduleReservations, ACTIVE_RESERVATION_STATUSES } from '../../services/reservationService';
import { getBranchConfigurations } from '../../services/branchConfigurationService';
import notificationService, { NOTIFICATION_EVENTS } from '../../services/notificationService';
import { evaluatePositionEvents } from '../../services/positionEventEngine';
import { cleanupOwnStaffNotifications } from '../../services/notificationCenterService';
import { safeUnsub } from '../../firebase/rtdbSubscribe';
import { buildSecretaryRecentActivities } from '../../utils/secretaryRecentActivity';
import { pickUpcomingPublishedSchedule } from '../../utils/upcomingSchedule';
import { branchesMatch } from '../../utils/stringUtils';
import { manilaDateString, manilaNowMinutes } from '../../utils/manilaDate';

/**
 * Global Notification Observer
 * Subscribes to real-time database transitions and dispatches Notification Event IDs.
 * Never triggers toasts on initial mount/refresh, only on actual application state transitions.
 */
export default function NotificationObserver() {
  const { user, role } = useAuth();

  useEffect(() => {
    if (role && role !== 'parent') {
      cleanupOwnStaffNotifications();
    }
  }, [role]);

  // Secretary: in-app toasts for the same events shown in Dashboard Recent Activity (no push).
  useEffect(() => {
    if (!user?.uid || role !== 'secretary') return undefined;

    let cancelled = false;
    let branchConfig = null;
    let latestSchedules = [];
    let unsubSchedules = () => {};
    let unsubReservations = () => {};
    let activeScheduleId = null;
    let isInitialReservationsLoad = true;
    const seenActivityKeys = new Set();

    const syncReservationListener = (scheduleId) => {
      safeUnsub(unsubReservations);
      unsubReservations = () => {};
      activeScheduleId = scheduleId || null;
      isInitialReservationsLoad = true;

      if (!scheduleId) return;

      unsubReservations = subscribeToScheduleReservations(scheduleId, (reservations) => {
        const activities = buildSecretaryRecentActivities(reservations || []);

        if (isInitialReservationsLoad) {
          activities.forEach((act) => seenActivityKeys.add(act.key));
          isInitialReservationsLoad = false;
          return;
        }

        activities.forEach((act) => {
          if (seenActivityKeys.has(act.key)) return;
          seenActivityKeys.add(act.key);
          notificationService.notify(NOTIFICATION_EVENTS.SECRETARY_ACTIVITY, {
            dedupeKey: `secretary_activity_${act.key}`,
            customTitle: act.title,
            customMessage: act.text,
            severity: act.severity,
            skipPush: true,
            showToast: true,
          });
        });
      });
    };

    const refreshUpcoming = () => {
      if (cancelled) return;
      const upcoming = pickUpcomingPublishedSchedule({
        schedules: latestSchedules,
        user,
        branch: branchConfig,
        today: manilaDateString(),
        nowMinutes: manilaNowMinutes(),
      });
      const nextId = upcoming?.schedule?.id || null;
      if (nextId !== activeScheduleId) {
        syncReservationListener(nextId);
      }
    };

    const tickMs = 60 * 1000;
    const interval = setInterval(refreshUpcoming, tickMs);

    (async () => {
      try {
        const branches = await getBranchConfigurations();
        if (cancelled) return;
        branchConfig =
          branches.find(
            (b) =>
              (user.assignedBranchId && b.id === user.assignedBranchId) ||
              branchesMatch(b.name, user.assignedBranch)
          ) || null;
      } catch {
        branchConfig = null;
      }

      if (cancelled) return;

      unsubSchedules = subscribeToUpcomingPublishedSchedules(manilaDateString(), (schedules) => {
        latestSchedules = schedules || [];
        refreshUpcoming();
      });
    })();

    return () => {
      cancelled = true;
      clearInterval(interval);
      safeUnsub(unsubSchedules);
      safeUnsub(unsubReservations);
    };
  }, [user?.uid, user?.assignedBranch, user?.assignedBranchId, role]);

  // In-app fallback for admin suspicious-account alerts (when push is denied / offline).
  useEffect(() => {
    if (!user?.uid || role !== 'admin') return undefined;

    let unsub = () => {};
    let cancelled = false;
    const seen = new Set();

    import('../../services/suspiciousAccountService').then(({ subscribeAdminAlerts, markAdminAlertRead }) => {
      if (cancelled) return;
      subscribeAdminAlerts(user.uid, (alerts) => {
        alerts.forEach((alert) => {
          if (alert.read || seen.has(alert.id)) return;
          if (alert.type !== 'SUSPICIOUS_ACCOUNT') return;
          seen.add(alert.id);
          notificationService.notify(NOTIFICATION_EVENTS.SUSPICIOUS_ACCOUNT, {
            dedupeKey: `admin_alert_${alert.id}`,
            customMessage: alert.body || alert.message,
            showToast: true,
            metadata: {
              parentId: alert.parentId,
              auditLogId: alert.auditLogId,
              url: alert.url,
            },
          });
          markAdminAlertRead(user.uid, alert.id).catch(() => {});
        });
      }).then((unsubscribeFn) => {
        if (cancelled) {
          unsubscribeFn?.();
          return;
        }
        unsub = unsubscribeFn || (() => {});
      });
    });

    return () => {
      cancelled = true;
      unsub();
    };
  }, [user?.uid, role]);

  const isInitialSchedulesLoad = useRef(true);
  const isInitialReservationsLoad = useRef(true);

  const prevSchedulesRef = useRef({});
  const prevMyReservationsRef = useRef({});
  const prevPatientsAheadRef = useRef({});
  const activeParentScheduleIdRef = useRef(null);

  useEffect(() => {
    if (!user || role !== 'parent') {
      return;
    }

    // Subscribe to all schedules for schedule state transitions
    const unsubSchedules = subscribeToAllSchedules((data) => {
      const currentSchedules = data || {};

      if (isInitialSchedulesLoad.current) {
        prevSchedulesRef.current = { ...currentSchedules };
        isInitialSchedulesLoad.current = false;
        return;
      }

      // Compare previous vs current schedules
      Object.entries(currentSchedules).forEach(([schedId, sched]) => {
        const prevSched = prevSchedulesRef.current[schedId];

        if (prevSched) {
          // Check transitions in queueStatus / status
          const prevStatus = prevSched.queueStatus;
          const currStatus = sched.queueStatus;

          if (prevStatus !== currStatus) {
            // Only parents with an active reservation on this schedule receive queue-related notifications
            const hasActiveRes = user && Object.values(prevMyReservationsRef.current).some(
              (r) =>
                r.scheduleId === schedId &&
                ACTIVE_RESERVATION_STATUSES.includes(r.status)
            );

            if (hasActiveRes) {
              if ((prevStatus === 'not_started' || !prevStatus) && currStatus === 'active') {
                notificationService.notify(NOTIFICATION_EVENTS.QUEUE_STARTED, {
                  entityId: schedId,
                  parentId: user?.uid,
                  dedupeKey: `queue_start_${schedId}_${sched.clinicDate}`,
                });
              } else if (prevStatus === 'active' && currStatus === 'paused') {
                notificationService.notify(NOTIFICATION_EVENTS.QUEUE_PAUSED, {
                  entityId: schedId,
                  parentId: user?.uid,
                  dedupeKey: `queue_paused_${schedId}_${sched.clinicDate}_${sched.queueStatusUpdatedAt || sched.updatedAt || 0}`,
                });
              } else if (prevStatus === 'paused' && currStatus === 'active') {
                notificationService.notify(NOTIFICATION_EVENTS.QUEUE_RESUMED, {
                  entityId: schedId,
                  parentId: user?.uid,
                  dedupeKey: `queue_resumed_${schedId}_${sched.clinicDate}_${sched.queueStatusUpdatedAt || sched.updatedAt || 0}`,
                });
              } else if (currStatus === 'closed' && prevStatus !== 'closed') {
                notificationService.notify(NOTIFICATION_EVENTS.QUEUE_CLOSED, {
                  entityId: schedId,
                  parentId: user?.uid,
                  dedupeKey: `queue_closed_${schedId}_${sched.clinicDate}`,
                });
              } else if (
                (currStatus === 'ended' || currStatus === 'completed' || sched.status === 'completed') &&
                prevStatus !== 'ended' &&
                prevStatus !== 'completed' &&
                prevSched.status !== 'completed'
              ) {
                notificationService.notify(NOTIFICATION_EVENTS.CLINIC_SESSION_ENDED, {
                  entityId: schedId,
                  parentId: user?.uid,
                  dedupeKey: `clinic_ended_${schedId}_${sched.clinicDate}`,
                });
              }
            }
          }
        }
      });

      prevSchedulesRef.current = { ...currentSchedules };
    });

    return () => safeUnsub(unsubSchedules);
  }, [user, role]);

  const isInitialScheduleLoad = useRef(true);

  useEffect(() => {
    if (!user || role !== 'parent') return;

    let unsubSchedule = () => {};
    let activeScheduleId = null;

    // Subscribe to parent's reservations
    const unsubParent = subscribeToParentReservations(user.uid, (parentData) => {
      const myReservations = parentData || [];
      const myResMap = {};
      myReservations.forEach((r) => {
        myResMap[r.id] = r;
      });

      if (isInitialReservationsLoad.current) {
        prevMyReservationsRef.current = { ...myResMap };
        isInitialReservationsLoad.current = false;
      } else {
        // Check parent reservation transitions
        myReservations.forEach((r) => {
          const prevRes = prevMyReservationsRef.current[r.id];

          if (prevRes) {
            const prevStatus = prevRes.status;
            const currStatus = r.status;
            const prevPenalty = prevRes.penaltyCount || 0;
            const currPenalty = r.penaltyCount || 0;

            // Check check-in request reminder from Secretary
            const prevCheckInReq = prevRes.checkInRequestedAt || 0;
            const currCheckInReq = r.checkInRequestedAt || 0;
            if (currCheckInReq > prevCheckInReq) {
              notificationService.notify(NOTIFICATION_EVENTS.CHECK_IN_REQUESTED, {
                entityId: r.id,
                parentId: r.parentId,
                dedupeKey: `check_in_req_${r.id}_${currCheckInReq}`,
              });
            }

            if (currPenalty > prevPenalty && currStatus !== 'forfeited') {
              notificationService.notify(NOTIFICATION_EVENTS.PENALIZED, {
                entityId: r.id,
                parentId: r.parentId,
                dedupeKey: `penalized_${r.id}_${currPenalty}`,
              });
            }

            if (prevStatus !== currStatus) {
              if (currStatus === "checked_in") {
                notificationService.notify(NOTIFICATION_EVENTS.QR_VERIFIED, {
                  entityId: r.id,
                  parentId: r.parentId,
                  dedupeKey: `checked_in_${r.id}`,
                });
              } else if (currStatus === "in_consultation" || currStatus === "with_doctor") {
                notificationService.notify(NOTIFICATION_EVENTS.CONSULTATION_STARTED, {
                  entityId: r.id,
                  parentId: r.parentId,
                  dedupeKey: `consult_start_${r.id}`,
                });
              } else if (currStatus === "completed" || currStatus === "consultation_completed") {
                notificationService.notify(NOTIFICATION_EVENTS.CONSULTATION_COMPLETED, {
                  entityId: r.id,
                  parentId: r.parentId,
                  dedupeKey: `consult_complete_${r.id}`,
                });
              } else if (currStatus === "forfeited") {
                notificationService.notify(NOTIFICATION_EVENTS.FORFEITED, {
                  entityId: r.id,
                  parentId: r.parentId,
                  dedupeKey: `forfeited_${r.id}`,
                });
              }
            }
          } else {
            // Initialize tracking for newly found reservation
            prevMyReservationsRef.current[r.id] = r;
          }
        });
      }

      // Handle dependent schedule listener
      const activeRes = myReservations.find((r) => ACTIVE_RESERVATION_STATUSES.includes(r.status));
      const newScheduleId = activeRes ? activeRes.scheduleId : null;

      if (newScheduleId !== activeScheduleId) {
        unsubSchedule();
        activeScheduleId = newScheduleId;
        activeParentScheduleIdRef.current = newScheduleId;

        if (newScheduleId) {
          isInitialScheduleLoad.current = true;
          unsubSchedule = subscribeToScheduleReservations(newScheduleId, (scheduleData) => {
            if (isInitialScheduleLoad.current) {
              isInitialScheduleLoad.current = false;
            } else {
              // Re-evaluate waiting-line positions 1–3 for push / in-app alerts
              evaluatePositionEvents(scheduleData || [], prevSchedulesRef.current, user);
            }
          });
        }
      }

      prevMyReservationsRef.current = { ...myResMap };
    });

    return () => {
      safeUnsub(unsubParent);
      safeUnsub(unsubSchedule);
    };
  }, [user, role]);

  return null;
}
