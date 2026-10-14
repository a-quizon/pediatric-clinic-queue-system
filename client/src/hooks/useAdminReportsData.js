import { useState, useEffect, useMemo } from 'react';
import { getDb } from '../firebase/database';
import { ref, get } from 'firebase/database';
import {
  isDateInRange,
  isTimestampInRange,
  rangeSpanDays,
  timestampToManilaDate,
} from '../utils/reportDateRange';
import { isCompletedSchedule } from '../utils/reportSessions';

/** System-wide KPIs/charts for an inclusive Manila date range (`range: null` → no data while invalid). */
export const useAdminReportsData = ({ range = {} } = {}) => {
  const [data, setData] = useState({
    users: [],
    schedules: [],
    reservations: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch only once on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [usersSnap, schedulesSnap, reservationsSnap] = await Promise.all([
          get(ref(getDb(), "users")),
          get(ref(getDb(), "schedules")),
          get(ref(getDb(), "reservations"))
        ]);

        let rawUsers = [];
        if (usersSnap.exists()) {
          const uVals = usersSnap.val();
          rawUsers = Object.entries(uVals).map(([id, val]) => ({ id, ...val }));
        }

        let rawSchedules = [];
        if (schedulesSnap.exists()) {
          const sVals = schedulesSnap.val();
          rawSchedules = Object.entries(sVals).map(([id, val]) => ({ id, ...val }));
        }

        let rawReservations = [];
        if (reservationsSnap.exists()) {
          const rVals = reservationsSnap.val();
          rawReservations = Object.entries(rVals).map(([id, val]) => ({ id, ...val }));
        }

        setData({
          users: rawUsers,
          schedules: rawSchedules,
          reservations: rawReservations
        });
      } catch (err) {
        console.error("Error fetching admin reports data:", err);
        setError(err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const metrics = useMemo(() => {
    if (!range || (!data.users.length && !data.schedules.length && !data.reservations.length)) {
      return { kpis: null, adoptionData: [], branchData: [], outcomeData: [], hasData: false };
    }

    // 1. Filter by inclusive Manila date range
    const parents = data.users.filter(
      (u) => u.role === "parent" && isTimestampInRange(u.createdAt, range)
    );

    // Only completed sessions count for utilization/outcomes
    const filteredSchedules = data.schedules.filter(
      (s) => isCompletedSchedule(s) && isDateInRange(s.clinicDate, range)
    );

    const validScheduleIds = new Set(filteredSchedules.map(s => s.id));

    // Reservations (linked to completed filtered schedules)
    const filteredReservations = data.reservations.filter(r => validScheduleIds.has(r.scheduleId));

    // 2. Compute KPIs
    const totalParents = parents.length;
    const totalSessions = filteredSchedules.length;
    const totalReservations = filteredReservations.length;

    // 3. Parent Adoption Trend — daily buckets for short ranges, monthly otherwise
    const byDay = rangeSpanDays(range) <= 92;
    const adoptionMap = {};
    parents.forEach(p => {
      const day = timestampToManilaDate(p.createdAt);
      const sortKey = byDay ? day : day.slice(0, 7);
      const label = byDay
        ? new Date(`${day}T04:00:00Z`).toLocaleDateString('en-US', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric' })
        : new Date(`${sortKey}-01T04:00:00Z`).toLocaleDateString('en-US', { timeZone: 'Asia/Manila', month: 'short', year: 'numeric' });
      if (!adoptionMap[sortKey]) adoptionMap[sortKey] = { sortKey, label, users: 0 };
      adoptionMap[sortKey].users += 1;
    });

    const adoptionData = Object.values(adoptionMap)
      .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
      .map(item => ({ date: item.label, users: item.users }));

    // 4. Branch Utilization
    const branchMap = {};
    filteredSchedules.forEach(s => {
      const branch = s.branch || "Unknown";
      if (!branchMap[branch]) branchMap[branch] = { branch, schedules: 0, reservations: 0 };
      branchMap[branch].schedules += 1;
    });
    
    filteredReservations.forEach(r => {
      const schedule = filteredSchedules.find(s => s.id === r.scheduleId);
      if (schedule) {
        const branch = schedule.branch || "Unknown";
        if (branchMap[branch]) {
          branchMap[branch].reservations += 1;
        }
      }
    });

    const branchData = Object.values(branchMap).sort((a, b) => b.reservations - a.reservations);

    // 5. Global Outcomes
    let checkedUp = 0;
    let cancelled = 0;
    let forfeited = 0;

    filteredReservations.forEach(r => {
      // Checked Up statuses
      if (["completed", "consultation_completed"].includes(r.status)) {
        checkedUp++;
      } 
      // Cancelled status
      else if (r.status === "cancelled") {
        cancelled++;
      } 
      // Forfeited statuses (expired, validation_expired, or forfeited by exceeding penalty limit)
      // Note: 'penalized' is NOT a status, it's just a metadata state
      else if (["forfeited", "expired", "validation_expired"].includes(r.status)) {
        forfeited++;
      }
    });

    const outcomeData = [
      { name: 'Checked Up', value: checkedUp, color: '#16a34a' },
      { name: 'Cancelled', value: cancelled, color: '#dc2626' },
      { name: 'Forfeited', value: forfeited, color: '#ea580c' },
    ].filter(item => item.value > 0);

    const hasData = totalParents > 0 || totalSessions > 0 || totalReservations > 0;

    return {
      kpis: {
        totalParents,
        totalSessions,
        totalReservations
      },
      adoptionData,
      branchData,
      outcomeData,
      hasData
    };
  }, [data, range]);

  return {
    loading,
    error,
    metrics,
  };
};
