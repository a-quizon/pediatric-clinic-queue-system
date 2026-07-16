import { database } from "../firebase/database";
import { ref, push, set, get, update, remove, onValue } from "firebase/database";

const defaultSchedule = () => ({
  monday: { isOpen: false, openingTime: "", closingTime: "" },
  tuesday: { isOpen: false, openingTime: "", closingTime: "" },
  wednesday: { isOpen: false, openingTime: "", closingTime: "" },
  thursday: { isOpen: false, openingTime: "", closingTime: "" },
  friday: { isOpen: false, openingTime: "", closingTime: "" },
  saturday: { isOpen: false, openingTime: "", closingTime: "" },
  sunday: { isOpen: false, openingTime: "", closingTime: "" }
});

const DEFAULT_BRANCHES = [
  {
    name: "Angeles",
    schedule: {
      ...defaultSchedule(),
      monday: { isOpen: true, openingTime: "09:00", closingTime: "12:00" },
      tuesday: { isOpen: true, openingTime: "15:00", closingTime: "17:00" },
      wednesday: { isOpen: true, openingTime: "09:00", closingTime: "12:00" },
      thursday: { isOpen: true, openingTime: "15:00", closingTime: "17:00" },
      friday: { isOpen: true, openingTime: "09:00", closingTime: "12:00" }
    }
  },
  {
    name: "Magalang",
    schedule: {
      ...defaultSchedule(),
      monday: { isOpen: true, openingTime: "14:00", closingTime: "17:00" },
      tuesday: { isOpen: true, openingTime: "09:00", closingTime: "12:00" },
      wednesday: { isOpen: true, openingTime: "14:00", closingTime: "17:00" },
      thursday: { isOpen: true, openingTime: "09:00", closingTime: "12:00" },
      friday: { isOpen: true, openingTime: "14:00", closingTime: "17:00" },
      saturday: { isOpen: true, openingTime: "09:00", closingTime: "12:00" }
    }
  }
];

const getPatternForDay = (schedulePatterns, dayIndex) => {
  const matchers = {
    "mwf": [1, 3, 5],
    "tth": [2, 4],
    "tths": [2, 4, 6],
    "weekdays": [1, 2, 3, 4, 5],
    "weekends": [0, 6],
    "everyday": [0, 1, 2, 3, 4, 5, 6],
    "monday": [1],
    "tuesday": [2],
    "wednesday": [3],
    "thursday": [4],
    "friday": [5],
    "saturday": [6],
    "sunday": [0]
  };

  if (!schedulePatterns) return null;

  for (const [pattern, hours] of Object.entries(schedulePatterns)) {
    const p = pattern.toLowerCase().trim();
    if (matchers[p] && matchers[p].includes(dayIndex)) {
      return hours;
    }
  }
  return null;
};

const migrateToV2 = async (branches) => {
  const updatedBranches = await Promise.all(branches.map(async (branch) => {
    if (branch.schedulePatterns && !branch.schedule) {
      const newSchedule = defaultSchedule();
      const daysMap = {
        0: 'sunday', 1: 'monday', 2: 'tuesday', 3: 'wednesday',
        4: 'thursday', 5: 'friday', 6: 'saturday'
      };
      
      for (let i = 0; i < 7; i++) {
        const patternHours = getPatternForDay(branch.schedulePatterns, i);
        if (patternHours) {
          newSchedule[daysMap[i]] = {
            isOpen: true,
            openingTime: patternHours.openingTime,
            closingTime: patternHours.closingTime
          };
        }
      }

      await update(ref(database, `branchConfigurations/${branch.id}`), {
        schedule: newSchedule,
        schedulePatterns: null
      });

      return { ...branch, schedule: newSchedule, schedulePatterns: undefined };
    }
    return branch;
  }));

  return updatedBranches;
};

export const getBranchConfigurations = async () => {
  const snapshot = await get(ref(database, "branchConfigurations"));
  if (snapshot.exists()) {
    const data = snapshot.val();
    const branches = Object.entries(data).map(([id, value]) => ({ id, ...value }));
    return await migrateToV2(branches);
  }
  return [];
};

export const subscribeToBranchConfigurations = (callback) => {
  const branchesRef = ref(database, "branchConfigurations");
  return onValue(branchesRef, async (snapshot) => {
    if (!snapshot.exists()) {
      callback([]);
      return;
    }
    const data = snapshot.val();
    const branches = Object.entries(data).map(([id, value]) => ({ id, ...value }));
    const migratedBranches = await migrateToV2(branches);
    callback(migratedBranches);
  });
};

export const seedDefaultBranches = async () => {
  const existing = await getBranchConfigurations();
  if (existing.length === 0) {
    for (const branch of DEFAULT_BRANCHES) {
      const branchRef = push(ref(database, "branchConfigurations"));
      await set(branchRef, {
        ...branch,
        createdAt: Date.now()
      });
    }
  }
};

export const createBranch = async (branchData) => {
  const branchRef = push(ref(database, "branchConfigurations"));
  await set(branchRef, {
    ...branchData,
    createdAt: Date.now()
  });
  return branchRef.key;
};

export const updateBranch = async (branchId, branchData) => {
  await update(ref(database, `branchConfigurations/${branchId}`), branchData);
};

export const deleteBranch = async (branchId) => {
  await remove(ref(database, `branchConfigurations/${branchId}`));
};

export const getClinicHours = async (branchName, clinicDate) => {
  const branches = await getBranchConfigurations();
  const branch = branches.find(b => b.name === branchName);
  
  if (!branch || !branch.schedule) return null;

  const [year, month, day] = clinicDate.split('-');
  const localDate = new Date(year, month - 1, day);
  const dayIndex = localDate.getDay();
  
  const daysMap = {
    0: 'sunday', 1: 'monday', 2: 'tuesday', 3: 'wednesday',
    4: 'thursday', 5: 'friday', 6: 'saturday'
  };

  const daySchedule = branch.schedule[daysMap[dayIndex]];
  if (daySchedule && daySchedule.isOpen) {
    return {
      openingTime: daySchedule.openingTime,
      closingTime: daySchedule.closingTime
    };
  }

  return null;
};

// check kung tapos na yung closing time ng branch for today's schedule
export const validateScheduleClosingTime = async (branchName, clinicDate) => {
  if (!branchName || !clinicDate) {
    return { valid: true };
  }

  // check if selected schedule date matches today's local date
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const todayStr = `${year}-${month}-${day}`;

  if (clinicDate !== todayStr) {
    return { valid: true };
  }

  // retrieve closing time from the currently selected branch configuration
  const hours = await getClinicHours(branchName, clinicDate);
  if (!hours || !hours.closingTime) {
    return {
      valid: false,
      message: "This branch is closed on the selected date."
    };
  }

  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const [closeH, closeM] = hours.closingTime.split(":").map(Number);
  const closingMinutes = closeH * 60 + closeM;

  if (currentMinutes >= closingMinutes) {
    return {
      valid: false,
      message: "You can no longer create or update today's schedule because the selected branch has already reached its closing time. Please choose another date."
    };
  }

  return { valid: true };
};

export const checkBranchInUse = async (branchName) => {
  const schedulesSnapshot = await get(ref(database, "schedules"));
  let hasPublishedSchedules = false;
  let scheduleIds = [];
  
  if (schedulesSnapshot.exists()) {
    const schedules = schedulesSnapshot.val();
    for (const [id, schedule] of Object.entries(schedules)) {
      if (schedule.branch === branchName) {
        scheduleIds.push(id);
        if (schedule.status === "published") {
          hasPublishedSchedules = true;
        }
      }
    }
  }

  let hasActiveReservations = false;
  if (scheduleIds.length > 0) {
    const reservationsSnapshot = await get(ref(database, "reservations"));
    if (reservationsSnapshot.exists()) {
      const reservations = reservationsSnapshot.val();
      for (const res of Object.values(reservations)) {
        const inactiveStatuses = ["cancelled", "completed", "consultation_completed", "forfeited", "penalized", "late_limit_reached", "expired", "validation_expired"];
        if (scheduleIds.includes(res.scheduleId) && !inactiveStatuses.includes(res.status)) {
          hasActiveReservations = true;
          break;
        }
      }
    }
  }

  return { hasPublishedSchedules, hasActiveReservations };
};
