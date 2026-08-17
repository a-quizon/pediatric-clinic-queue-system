import React, { useEffect, useRef } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { subscribeToAllSchedules } from '../../services/scheduleService';
import { subscribeToParentReservations, subscribeToScheduleReservations, ACTIVE_RESERVATION_STATUSES } from '../../services/reservationService';
import notificationService, { NOTIFICATION_EVENTS } from '../../services/notificationService';
import { evaluatePositionEvents } from '../../services/positionEventEngine';
import { cleanupNonParentNotifications } from '../../services/notificationCenterService';

/**
 * Global Notification Observer
 * Subscribes to real-time database transitions and dispatches Notification Event IDs.
 * Never triggers toasts on initial mount/refresh, only on actual application state transitions.
 */
export default function NotificationObserver() {
  const { user, role } = useAuth();

  useEffect(() => {
    cleanupNonParentNotifications();
  }, []);

  const isInitialSchedulesLoad = useRef(true);
  const isInitialReservationsLoad = useRef(true);

  const prevSchedulesRef = useRef({});
  const prevMyReservationsRef = useRef({});
  const prevPatientsAheadRef = useRef({});

  useEffect(() => {
    if (!user || role !== 'parent') return;

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

        if (!prevSched) {
          // New schedule published today or future
          if (sched.status === 'published') {
            notificationService.notify(NOTIFICATION_EVENTS.SCHEDULE_AVAILABLE, {
              entityId: schedId,
              parentId: user?.uid,
              dedupeKey: `sched_avail_${schedId}`,
            });
          }
        } else {
          // Check if draft schedule transitioned to published
          if (prevSched.status !== 'published' && sched.status === 'published') {
            notificationService.notify(NOTIFICATION_EVENTS.SCHEDULE_AVAILABLE, {
              entityId: schedId,
              parentId: user?.uid,
              dedupeKey: `sched_avail_${schedId}`,
            });
          }

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
                  dedupeKey: `queue_paused_${schedId}_${Date.now()}`,
                });
              } else if (prevStatus === 'paused' && currStatus === 'active') {
                notificationService.notify(NOTIFICATION_EVENTS.QUEUE_RESUMED, {
                  entityId: schedId,
                  parentId: user?.uid,
                  dedupeKey: `queue_resumed_${schedId}_${Date.now()}`,
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

    return () => unsubSchedules();
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
              if (currStatus === 'validation_open') {
                notificationService.notify(NOTIFICATION_EVENTS.VALIDATION_OPEN, {
                  entityId: r.id,
                  parentId: r.parentId,
                  dedupeKey: `val_open_${r.id}`,
                });
              } else if (currStatus === 'validation_expired') {
                notificationService.notify(NOTIFICATION_EVENTS.VALIDATION_EXPIRED, {
                  entityId: r.id,
                  parentId: r.parentId,
                  dedupeKey: `val_exp_${r.id}`,
                });
              } else if (currStatus === 'checked_in') {
                notificationService.notify(NOTIFICATION_EVENTS.CHECKED_IN, {
                  entityId: r.id,
                  parentId: r.parentId,
                  dedupeKey: `checked_in_${r.id}`,
                });
              } else if (currStatus === 'in_consultation') {
                notificationService.notify(NOTIFICATION_EVENTS.TURN_IS_NOW, {
                  entityId: r.id,
                  parentId: r.parentId,
                  dedupeKey: `turn_is_now_${r.id}`,
                });
              } else if (currStatus === 'completed' || currStatus === 'consultation_completed') {
                notificationService.notify(NOTIFICATION_EVENTS.CONSULTATION_COMPLETED, {
                  entityId: r.id,
                  parentId: r.parentId,
                  dedupeKey: `consult_complete_${r.id}`,
                });
              } else if (currStatus === 'forfeited') {
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
        
        if (newScheduleId) {
          isInitialScheduleLoad.current = true;
          unsubSchedule = subscribeToScheduleReservations(newScheduleId, (scheduleData) => {
            if (isInitialScheduleLoad.current) {
              isInitialScheduleLoad.current = false;
            } else {
              // Position Event Architecture: Re-evaluate position thresholds across active reservations
              evaluatePositionEvents(scheduleData || [], prevSchedulesRef.current, user);
            }
          });
        }
      }

      prevMyReservationsRef.current = { ...myResMap };
    });

    return () => {
      unsubParent();
      unsubSchedule();
    };
  }, [user, role]);

  return null;
}
