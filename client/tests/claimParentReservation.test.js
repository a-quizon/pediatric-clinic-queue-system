import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  finalizeParentClaim,
  formatParentClaimResult,
  runPostClaimQueueSync,
} from "../src/utils/parentClaimFinalize.js";

describe("finalizeParentClaim (post-claim success path)", () => {
  it("returns reservationId and queueNumber even when client recalculate throws", async () => {
    const recalcCalls = [];
    const recalcThatThrows = async (scheduleId) => {
      recalcCalls.push(scheduleId);
      throw new Error("PERMISSION_DENIED: parent cannot update other tickets");
    };

    const result = await finalizeParentClaim(
      "schedule-1",
      { reservationId: "res-abc", queueNumber: 5 },
      recalcThatThrows
    );

    assert.deepEqual(recalcCalls, ["schedule-1"]);
    assert.equal(result.reservationId, "res-abc");
    assert.equal(result.queueNumber, 5);
  });

  it("coerces queueNumber to a number", async () => {
    const result = await finalizeParentClaim(
      "schedule-1",
      { reservationId: "res-1", queueNumber: "3" },
      async () => {}
    );
    assert.equal(result.queueNumber, 3);
  });

  it("returns null queueNumber when claim body omits it", async () => {
    const result = formatParentClaimResult({ reservationId: "res-1" });
    assert.equal(result.reservationId, "res-1");
    assert.equal(result.queueNumber, null);
  });

  it("runPostClaimQueueSync does not throw when recalculate fails", async () => {
    await assert.doesNotReject(() =>
      runPostClaimQueueSync("s1", async () => {
        throw new Error("PERMISSION_DENIED");
      })
    );
  });

  it("does not treat a successful recalc as a claim failure", async () => {
    let ran = false;
    const result = await finalizeParentClaim("s1", { reservationId: "r1", queueNumber: 1 }, async () => {
      ran = true;
    });
    assert.equal(ran, true);
    assert.equal(result.reservationId, "r1");
  });
});
