import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  OFFLINE_MUTATION_MESSAGE,
  assertCanMutateRealtime,
  connectionTone,
  getRtdbConnectionSnapshot,
  setRtdbConnectionSnapshot,
} from "../src/utils/rtdbConnectionState.js";

describe("rtdbConnectionState", () => {
  beforeEach(() => {
    setRtdbConnectionSnapshot({ connected: true, everConnected: true });
  });

  it("labels Online Reconnecting Offline and gates mutations", () => {
    assert.equal(setRtdbConnectionSnapshot({ connected: true, everConnected: true }).label, "Online");
    assert.equal(getRtdbConnectionSnapshot().canMutateRealtime, true);
    assert.equal(connectionTone("Online"), "ok");

    assert.equal(
      setRtdbConnectionSnapshot({ connected: false, everConnected: true }).label,
      "Reconnecting"
    );
    assert.equal(getRtdbConnectionSnapshot().canMutateRealtime, false);
    assert.equal(connectionTone("Reconnecting"), "warn");

    assert.equal(
      setRtdbConnectionSnapshot({ connected: false, everConnected: false }).label,
      "Offline"
    );
    assert.equal(getRtdbConnectionSnapshot().canMutateRealtime, false);
    assert.equal(connectionTone("Offline"), "bad");
  });

  it("assertCanMutateRealtime throws when not Online", () => {
    setRtdbConnectionSnapshot({ connected: false, everConnected: true });
    assert.throws(() => assertCanMutateRealtime(), { message: OFFLINE_MUTATION_MESSAGE });
    setRtdbConnectionSnapshot({ connected: true, everConnected: true });
    assert.doesNotThrow(() => assertCanMutateRealtime());
  });
});
