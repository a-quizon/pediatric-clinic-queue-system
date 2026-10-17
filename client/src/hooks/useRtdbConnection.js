import { useEffect, useState } from "react";
import { onValue, ref } from "firebase/database";
import { getDb } from "../firebase/database";
import {
  getRtdbConnectionSnapshot,
  setRtdbConnectionSnapshot,
} from "../utils/rtdbConnectionState";

/**
 * Live Firebase Realtime Database link status for this browser.
 * Online / Reconnecting / Offline via .info/connected + everConnected.
 */
export function useRtdbConnection() {
  const [state, setState] = useState(() => getRtdbConnectionSnapshot());

  useEffect(() => {
    const connectedRef = ref(getDb(), ".info/connected");
    const unsub = onValue(connectedRef, (snap) => {
      const value = snap.val();
      const connected = value === true;
      const prev = getRtdbConnectionSnapshot();
      const everConnected = prev.everConnected || connected === true;
      setState(setRtdbConnectionSnapshot({ connected, everConnected }));
    });
    return () => unsub();
  }, []);

  return state;
}
