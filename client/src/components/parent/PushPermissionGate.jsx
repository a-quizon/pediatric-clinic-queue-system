import { useEffect, useRef } from "react";
import { Capacitor } from "@capacitor/core";
import { useAuth } from "../../hooks/useAuth";
import {
  checkPushSupport,
  hasActivePushSubscription,
  registerPushSubscription,
} from "../../services/pushService";

/**
 * On the Android APK, request notification permission as soon as a parent session
 * is ready instead of waiting for them to find the Enable Notifications button.
 */
export default function PushPermissionGate() {
  const { user, loading } = useAuth();
  const attemptedRef = useRef(false);

  useEffect(() => {
    if (loading || !user || user.role !== "parent") return;
    if (!checkPushSupport()) return;
    if (!Capacitor.isNativePlatform() && typeof Notification === "undefined") return;

    const run = async () => {
      if (Capacitor.isNativePlatform()) {
        const hasSub = await hasActivePushSubscription(user.uid);
        if (!hasSub && !attemptedRef.current) {
          attemptedRef.current = true;
          await registerPushSubscription(user).catch(() => {});
        }
        return;
      }

      if (Notification.permission === "granted") {
        const hasSub = await hasActivePushSubscription(user.uid);
        if (!hasSub) {
          await registerPushSubscription(user).catch(() => {});
        }
        return;
      }

      if (Notification.permission === "denied") return;
      if (attemptedRef.current) return;

      attemptedRef.current = true;
      await registerPushSubscription(user).catch(() => {});
    };

    run();
  }, [user?.uid, user?.role, loading]);

  return null;
}
