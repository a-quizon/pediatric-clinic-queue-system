import { useEffect, useMemo, useState } from "react";
import { subscribeToParentReservations, subscribeToScheduleReservations } from "../services/reservationService";
import { subscribeToAllSchedules } from "../services/scheduleService";
import { getServerTime } from "../services/timeService";
import { manilaDateString, manilaNowMinutes } from "../utils/manilaDate";
import { getCurrentSessionForParent } from "../utils/currentParentSession";

const CLOCK_TICK_MS = 30 * 1000;
const EMPTY_LIST = [];

function readClock() {
  const now = new Date(getServerTime());
  return { today: manilaDateString(now), nowMinutes: manilaNowMinutes(now) };
}

/**
 * The parent's single current session (live session first, else the earliest upcoming one)
 * plus the live queue for that session. Switches automatically when staff start or end a session.
 */
export function useCurrentParentSession(parentId) {
  const [reservationsState, setReservationsState] = useState({ parentId: null, data: EMPTY_LIST });
  const [schedulesState, setSchedulesState] = useState({ parentId: null, data: {} });
  const [queueState, setQueueState] = useState({ scheduleId: null, data: EMPTY_LIST });
  const [errorState, setErrorState] = useState({ parentId: null, error: null });
  const [clock, setClock] = useState(readClock);

  const reservationsLoaded = reservationsState.parentId === parentId;
  const schedulesLoaded = schedulesState.parentId === parentId;
  const error = errorState.parentId === parentId ? errorState.error : null;

  useEffect(() => {
    const tick = () => setClock(readClock());
    const onVisible = () => {
      if (document.visibilityState === "visible") tick();
    };
    const interval = setInterval(tick, CLOCK_TICK_MS);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  useEffect(() => {
    if (!parentId) return undefined;

    const onError = (err) => setErrorState({ parentId, error: err });
    const unsubReservations = subscribeToParentReservations(parentId, (data) => {
      setReservationsState({ parentId, data: data || EMPTY_LIST });
    }, onError);
    const unsubSchedules = subscribeToAllSchedules((data) => {
      setSchedulesState({ parentId, data: data || {} });
    }, onError);

    return () => {
      unsubReservations();
      unsubSchedules();
    };
  }, [parentId]);

  const session = useMemo(() => {
    if (!parentId || !reservationsLoaded || !schedulesLoaded) return null;
    return getCurrentSessionForParent(reservationsState.data, schedulesState.data, { parentId, ...clock });
  }, [reservationsState, schedulesState, reservationsLoaded, schedulesLoaded, parentId, clock]);

  const selectedScheduleId = session?.schedule.id || null;

  useEffect(() => {
    if (!selectedScheduleId) return undefined;
    return subscribeToScheduleReservations(selectedScheduleId, (data) => {
      setQueueState({ scheduleId: selectedScheduleId, data: data || EMPTY_LIST });
    }, (err) => setErrorState({ parentId, error: err }));
  }, [selectedScheduleId, parentId]);

  return {
    session,
    schedules: schedulesState.data,
    scheduleReservations: queueState.scheduleId === selectedScheduleId ? queueState.data : EMPTY_LIST,
    loading: Boolean(parentId) && (!reservationsLoaded || !schedulesLoaded) && !error,
    error,
  };
}
