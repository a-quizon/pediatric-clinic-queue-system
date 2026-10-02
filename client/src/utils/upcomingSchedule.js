import { manilaDateString, manilaNowMinutes } from "./manilaDate.js";
import { clinicBlocksForDate, minutesFromTime } from "./scheduleOpeningRules.js";
import { scheduleMatchesAssignedBranch } from "./stringUtils.js";

const FINISHED_QUEUE_STATUSES = ["closed", "ended", "completed"];
const RUNNING_QUEUE_STATUSES = ["active", "paused"];

function scheduleList(schedules) {
  return Array.isArray(schedules) ? schedules : Object.values(schedules || {});
}

/**
 * Session blocks for a published day. Branch config blocks (e.g. morning +
 * afternoon) are kept only inside the schedule's published hours; when the
 * branch has none, the schedule's own opening/closing pair is the single block.
 */
export function sessionBlocksForSchedule(schedule, branch) {
  const open = minutesFromTime(schedule?.openingTime);
  const close = minutesFromTime(schedule?.closingTime);
  const hasPublishedHours = open != null && close != null;
  const configured = clinicBlocksForDate(branch, schedule?.clinicDate).filter(
    (block) =>
      !hasPublishedHours ||
      (minutesFromTime(block.openingTime) >= open && minutesFromTime(block.closingTime) <= close)
  );
  if (configured.length > 0) return configured;
  if (hasPublishedHours) {
    return [{ openingTime: schedule.openingTime, closingTime: schedule.closingTime }];
  }
  return [];
}

function byDateThenOpening(a, b) {
  if (a.schedule.clinicDate !== b.schedule.clinicDate) {
    return a.schedule.clinicDate < b.schedule.clinicDate ? -1 : 1;
  }
  return (minutesFromTime(a.block?.openingTime) ?? 0) - (minutesFromTime(b.block?.openingTime) ?? 0);
}

/**
 * The secretary's nearest published session that has not ended (Asia/Manila).
 * A running (active/paused) queue from today onward always wins, even past
 * closing time. Otherwise today's blocks count as ended at their closing minute.
 * Returns { schedule, block, blocks } or null.
 */
export function pickUpcomingPublishedSchedule({
  schedules,
  user,
  branch,
  today = manilaDateString(),
  nowMinutes = manilaNowMinutes(),
}) {
  const candidates = scheduleList(schedules).filter(
    (schedule) =>
      scheduleMatchesAssignedBranch(schedule, user) &&
      schedule.status === "published" &&
      !schedule.dayClosed &&
      schedule.clinicDate &&
      schedule.clinicDate >= today &&
      !FINISHED_QUEUE_STATUSES.includes(schedule.queueStatus)
  );

  const withBlocks = candidates.map((schedule) => ({
    schedule,
    blocks: sessionBlocksForSchedule(schedule, branch),
  }));

  const remainingBlocks = ({ schedule, blocks }) =>
    schedule.clinicDate === today
      ? blocks.filter((block) => nowMinutes < minutesFromTime(block.closingTime))
      : blocks;

  const running = withBlocks
    .filter((item) => RUNNING_QUEUE_STATUSES.includes(item.schedule.queueStatus))
    .map((item) => ({
      ...item,
      block: remainingBlocks(item)[0] || item.blocks[item.blocks.length - 1] || null,
    }))
    .sort(byDateThenOpening);
  if (running.length > 0) return running[0];

  const upcoming = withBlocks
    .map((item) => ({ ...item, block: remainingBlocks(item)[0] || null }))
    .filter((item) => item.block)
    .sort(byDateThenOpening);

  return upcoming[0] || null;
}
