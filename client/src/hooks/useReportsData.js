import { useState, useEffect, useMemo } from 'react';
import { database } from '../firebase/database';
import { ref, get } from 'firebase/database';

export const useReportsData = () => {
  const [data, setData] = useState({
    schedules: [],
    reservations: [],
    processedDataset: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filter states
  const [branchFilter, setBranchFilter] = useState("All Branches");
  const [dateRange, setDateRange] = useState("This Month"); // "Today", "This Week", "This Month", "Custom Range"
  const [customDateRange, setCustomDateRange] = useState({ start: null, end: null });

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [schedulesSnap, reservationsSnap] = await Promise.all([
          get(ref(database, "schedules")),
          get(ref(database, "reservations"))
        ]);

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

        // Step 1: Filter only completed schedules
        // Reports should represent completed clinic sessions only
        const completedSchedules = rawSchedules.filter(s => 
          s.status === 'completed' || s.queueStatus === 'completed' || s.queueStatus === 'ended'
        );

        // Step 2 & 3: Link reservations and compute metrics
        const processed = completedSchedules.map(schedule => {
          // Link reservations exactly by scheduleId
          const scheduleReservations = rawReservations.filter(r => r.scheduleId === schedule.id);

          const totalReservations = scheduleReservations.length;
          
          // Reusing existing logic for Checked Up
          const checkedUp = scheduleReservations.filter(r => 
            ["completed", "consultation_completed"].includes(r.status)
          ).length;

          // Reusing existing logic for Cancelled
          const cancelled = scheduleReservations.filter(r => 
            r.status === 'cancelled'
          ).length;

          // Reusing existing logic for Forfeited
          const forfeited = scheduleReservations.filter(r => 
            ["forfeited", "penalized", "late_limit_reached"].includes(r.status)
          ).length;

          // Completion Rate Formula: Checked Up ÷ Total Reservations × 100
          // Return 0% if Total Reservations is zero
          const completionRate = totalReservations > 0 ? (checkedUp / totalReservations) * 100 : 0;

          return {
            ...schedule,
            metrics: {
              totalReservations,
              checkedUp,
              cancelled,
              forfeited,
              completionRate: parseFloat(completionRate.toFixed(2)) // 2 decimal precision
            }
          };
        });

        setData({
          schedules: completedSchedules,
          reservations: rawReservations,
          processedDataset: processed
        });

      } catch (err) {
        console.error("Error fetching reports data:", err);
        setError(err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Step 4: Filters
  const filteredDataset = useMemo(() => {
    return data.processedDataset.filter(item => {
      // Branch filtering
      if (branchFilter !== "All Branches" && item.branch !== branchFilter) {
        return false;
      }

      // Date Range filtering
      if (!item.clinicDate) return false;
      
      const itemDate = new Date(item.clinicDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      itemDate.setHours(0, 0, 0, 0);

      if (dateRange === "Today") {
        if (itemDate.getTime() !== today.getTime()) return false;
      } else if (dateRange === "This Week") {
        const dayOfWeek = today.getDay(); // 0 (Sun) to 6 (Sat)
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - dayOfWeek);
        startOfWeek.setHours(0, 0, 0, 0);
        
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        endOfWeek.setHours(23, 59, 59, 999);
        
        if (itemDate < startOfWeek || itemDate > endOfWeek) return false;
      } else if (dateRange === "This Month") {
        if (itemDate.getMonth() !== today.getMonth() || itemDate.getFullYear() !== today.getFullYear()) return false;
      } else if (dateRange === "Custom Range" && customDateRange.start && customDateRange.end) {
        const start = new Date(customDateRange.start);
        start.setHours(0, 0, 0, 0);
        const end = new Date(customDateRange.end);
        end.setHours(23, 59, 59, 999);
        if (itemDate < start || itemDate > end) return false;
      }

      return true;
    });
  }, [data.processedDataset, branchFilter, dateRange, customDateRange]);

  return {
    loading,
    error,
    dataset: filteredDataset,
    unfilteredDataset: data.processedDataset,
    filters: {
      branch: branchFilter,
      setBranch: setBranchFilter,
      dateRange: dateRange,
      setDateRange: setDateRange,
      customDateRange: customDateRange,
      setCustomDateRange: setCustomDateRange
    }
  };
};
