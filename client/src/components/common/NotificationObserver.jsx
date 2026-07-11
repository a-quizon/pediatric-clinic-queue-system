import React, { useEffect, useRef } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { subscribeToAllSchedules } from '../../services/scheduleService';
import { subscribeToAllReservations } from '../../services/reservationService';
import notificationService, { NOTIFICATION_EVENTS } from '../../services/notificationService';
import { evaluatePositionEvents } from '../../services/positionEventEngine';

/**
 * Global Notification Observer
 * Subscribes to real-time database transitions and dispatches Notification Event IDs.
 * Never triggers toasts on initial mount/refresh, only on actual application state transitions.
 */
export default function NotificationObserver() {
  const { user } = useAuth();

  const isInitialSchedulesLoad = useRef(true);
  const isInitialReservationsLoad = useRef(true);

  const prevSchedulesRef = useRef({});
  const prevMyReservationsRef = useRef({});
  const prevPatientsAheadRef = useRef({});

  useEffect(() => {
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
                ['reserved', 'waiting', 'checked_in', 'validation_open', 'waiting_for_window', 'in_consultation'].includes(r.status)
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
  }, []);

  useEffect(() => {
    if (!user) return;

    // Subscribe to all reservations for parent reservation transitions & queue progress
    const unsubReservations = subscribeToAllReservations((allReservations) => {
      const data = allReservations || [];

      // Filter parent's own reservations
      const myReservations = data.filter((r) => r.parentId === user.uid);
      const myResMap = {};
      myReservations.forEach((r) => {
        myResMap[r.id] = r;
      });

      if (isInitialReservationsLoad.current) {
        prevMyReservationsRef.current = { ...myResMap };
        isInitialReservationsLoad.current = false;
        return;
      }

      // Check parent reservation transitions
      myReservations.forEach((r) => {
        const prevRes = prevMyReservationsRef.current[r.id];

        if (prevRes) {
          const prevStatus = prevRes.status;
          const currStatus = r.status;
          const prevPenalty = prevRes.penaltyCount || 0;
          const currPenalty = r.penaltyCount || 0;

          // Check penalty increment while reservation is still active (not forfeited)
          if (currPenalty > prevPenalty && currStatus !== 'forfeited') {
            notificationService.notify(NOTIFICATION_EVENTS.PENALIZED, {
              entityId: r.id,
              parentId: r.parentId,
              dedupeKey: `penalized_${r.id}_${currPenalty}_${r.lastPenalizedAt || Date.now()}`,
            });
          }

          if (prevStatus !== currStatus) {
            if (currStatus === 'checked_in') {
              notificationService.notify(NOTIFICATION_EVENTS.QR_VERIFIED, {
                entityId: r.id,
                parentId: r.parentId,
                dedupeKey: `qr_verified_${r.id}`,
              });
            } else if (currStatus === 'in_consultation') {
              notificationService.notify(NOTIFICATION_EVENTS.CONSULTATION_STARTED, {
                entityId: r.id,
                parentId: r.parentId,
                dedupeKey: `consult_start_${r.id}`,
              });
            } else if (currStatus === 'completed' || currStatus === 'consultation_completed') {
              notificationService.notify(NOTIFICATION_EVENTS.CONSULTATION_COMPLETED, {
                entityId: r.id,
                parentId: r.parentId,
                dedupeKey: `consult_complete_${r.id}`,
              });
            } else if (currStatus === 'penalized') {
              notificationService.notify(NOTIFICATION_EVENTS.PENALIZED, {
                entityId: r.id,
                parentId: r.parentId,
                dedupeKey: `penalized_${r.id}_${currPenalty}_${r.lastPenalizedAt || Date.now()}`,
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

      // Position Event Architecture: Re-evaluate position thresholds across active reservations
      evaluatePositionEvents(data, prevSchedulesRef.current, user);

      prevMyReservationsRef.current = { ...myResMap };
    });

    return () => unsubReservations();
  }, [user]);

  return null;
}
