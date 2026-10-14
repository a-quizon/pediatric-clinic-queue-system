import { useState, useEffect, useMemo } from 'react';
import { getDb } from '../firebase/database';
import { ref, get } from 'firebase/database';
import { buildSessionRows, filterSessions, ALL_BRANCHES } from '../utils/reportSessions';

/**
 * Completed clinic sessions with per-session reservation metrics.
 * Filtering (branch + inclusive Manila date range) is driven by the caller's shared filter state;
 * pass `range: null` while the range is invalid to show nothing.
 */
export const useReportsData = ({ branch = ALL_BRANCHES, range = {} } = {}) => {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const fetchData = async () => {
      try {
        setLoading(true);
        const [schedulesSnap, reservationsSnap] = await Promise.all([
          get(ref(getDb(), "schedules")),
          get(ref(getDb(), "reservations"))
        ]);

        const rawSchedules = schedulesSnap.exists()
          ? Object.entries(schedulesSnap.val()).map(([id, val]) => ({ id, ...val }))
          : [];
        const rawReservations = reservationsSnap.exists()
          ? Object.entries(reservationsSnap.val()).map(([id, val]) => ({ id, ...val }))
          : [];

        if (!cancelled) setSessions(buildSessionRows(rawSchedules, rawReservations));
      } catch (err) {
        console.error("Error fetching reports data:", err);
        if (!cancelled) setError(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchData();
    return () => {
      cancelled = true;
    };
  }, []);

  const dataset = useMemo(
    () => (range ? filterSessions(sessions, { branch, range }) : []),
    [sessions, branch, range]
  );

  return {
    loading,
    error,
    dataset,
    unfilteredDataset: sessions,
  };
};
