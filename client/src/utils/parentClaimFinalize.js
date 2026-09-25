/**
 * Post-claim helpers for parent slot reservations.
 * The HTTP claim already committed the reservation; client queue rewrite is best-effort
 * because parents can only write their own ticket under RTDB rules.
 */

export function formatParentClaimResult(claimData = {}) {
  return {
    reservationId: claimData.reservationId,
    queueNumber:
      claimData.queueNumber != null && claimData.queueNumber !== ""
        ? Number(claimData.queueNumber)
        : null,
  };
}

/**
 * @param {string} scheduleId
 * @param {(scheduleId: string) => Promise<void>} recalculate
 */
export async function runPostClaimQueueSync(scheduleId, recalculate) {
  if (!scheduleId || typeof recalculate !== "function") return;
  try {
    await recalculate(scheduleId);
  } catch (error) {
    // Parents may lack write access to other tickets; Cloud Functions recalculate via Admin SDK.
    console.warn("Client queue recalculation deferred to server:", error?.message || error);
  }
}

/**
 * After a successful claim HTTP response: best-effort queue sync, then return ids.
 * @param {string} scheduleId
 * @param {{ reservationId?: string, queueNumber?: number|string }} claimData
 * @param {(scheduleId: string) => Promise<void>} [recalculate]
 */
export async function finalizeParentClaim(scheduleId, claimData, recalculate) {
  await runPostClaimQueueSync(scheduleId, recalculate);
  return formatParentClaimResult(claimData);
}
