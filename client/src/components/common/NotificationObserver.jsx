import React, { useEffect, useRef } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { subscribeToAllSchedules } from '../../services/scheduleService';
import { subscribeToAllReservations } from '../../services/reservationService';
import notificationService, { NOTIFICATION_EVENTS } from '../../services/notificationService';

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
          notificationService.notify(NOTIFICATION_EVENTS.SCHEDULE_AVAILABLE, {
            entityId: schedId,
            dedupeKey: `sched_avail_${schedId}`,
          });
        } else {
          // Check transitions in queueStatus / status
          const prevStatus = prevSched.queueStatus;
          const currStatus = sched.queueStatus;

          if (prevStatus !== currStatus) {
            if ((prevStatus === 'not_started' || !prevStatus) && currStatus === 'active') {
              notificationService.notify(NOTIFICATION_EVENTS.QUEUE_STARTED, {
                entityId: schedId,
                dedupeKey: `queue_start_${schedId}_${sched.clinicDate}`,
              });
            } else if (prevStatus === 'active' && currStatus === 'paused') {
              notificationService.notify(NOTIFICATION_EVENTS.QUEUE_PAUSED, {
                entityId: schedId,
                dedupeKey: `queue_paused_${schedId}_${Date.now()}`,
              });
            } else if (prevStatus === 'paused' && currStatus === 'active') {
              notificationService.notify(NOTIFICATION_EVENTS.QUEUE_RESUMED, {
                entityId: schedId,
                dedupeKey: `queue_resumed_${schedId}_${Date.now()}`,
              });
            } else if (currStatus === 'closed' && prevStatus !== 'closed') {
              notificationService.notify(NOTIFICATION_EVENTS.QUEUE_CLOSED, {
                entityId: schedId,
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
                dedupeKey: `clinic_ended_${schedId}_${sched.clinicDate}`,
              });
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

          if (prevStatus !== currStatus) {
            if (currStatus === 'checked_in') {
              notificationService.notify(NOTIFICATION_EVENTS.QR_VERIFIED, {
                entityId: r.id,
                dedupeKey: `qr_verified_${r.id}`,
              });
            } else if (currStatus === 'in_consultation') {
              notificationService.notify(NOTIFICATION_EVENTS.CONSULTATION_STARTED, {
                entityId: r.id,
                dedupeKey: `consult_start_${r.id}`,
              });
            } else if (currStatus === 'completed' || currStatus === 'consultation_completed') {
              notificationService.notify(NOTIFICATION_EVENTS.CONSULTATION_COMPLETED, {
                entityId: r.id,
                dedupeKey: `consult_complete_${r.id}`,
              });
            } else if (currStatus === 'penalized') {
              notificationService.notify(NOTIFICATION_EVENTS.PENALIZED, {
                entityId: r.id,
                dedupeKey: `penalized_${r.id}_${r.penaltyCount || 1}`,
              });
            } else if (currStatus === 'forfeited') {
              notificationService.notify(NOTIFICATION_EVENTS.FORFEITED, {
                entityId: r.id,
                dedupeKey: `forfeited_${r.id}`,
              });
            }
          }

          // Queue Progress threshold checks (NEAR_TURN & ALMOST_NEXT)
          if (['reserved', 'waiting'].includes(r.status)) {
            // Calculate patients ahead on this schedule
            const activeLine = data
              .filter(
                (item) =>
                  item.scheduleId === r.scheduleId &&
                  ['reserved', 'waiting', 'checked_in', 'in_consultation'].includes(item.status)
              )
              .sort((a, b) => (a.queuePosition || 999) - (b.queuePosition || 999));

            const myIndex = activeLine.findIndex((item) => item.id === r.id);
            const patientsAhead = myIndex >= 0 ? myIndex : 0;
            const prevAhead = prevPatientsAheadRef.current[r.id];

            if (prevAhead !== undefined && patientsAhead < prevAhead) {
              if (patientsAhead === 1) {
                notificationService.notify(NOTIFICATION_EVENTS.ALMOST_NEXT, {
                  entityId: r.id,
                  dedupeKey: `almost_next_${r.id}`,
                });
              } else if (patientsAhead > 1 && patientsAhead <= 3) {
                notificationService.notify(NOTIFICATION_EVENTS.NEAR_TURN, {
                  entityId: r.id,
                  dedupeKey: `near_turn_${r.id}_ahead_${patientsAhead}`,
                });
              }
            }

            prevPatientsAheadRef.current[r.id] = patientsAhead;
          }
        } else {
          // Initialize tracking for newly found reservation
          prevMyReservationsRef.current[r.id] = r;
        }
      });

      prevMyReservationsRef.current = { ...myResMap };
    });

    return () => unsubReservations();
  }, [user]);

  return null;
}
