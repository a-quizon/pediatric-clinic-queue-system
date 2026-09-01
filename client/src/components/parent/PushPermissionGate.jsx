import { useEffect, useRef } from "react";
import { Capacitor } from "@capacitor/core";
import { useAuth } from "../../hooks/useAuth";
import {
  getOsNotificationPermissionStatus,
  isOsPermissionPromptable,
  requestPushPermissionAfterLogin,
} from "../../services/pushService";

/**
 * On the native APK, request the OS notification permission if it was never decided
 * (cold start with an existing parent session). Does not render UI.
 */
export default function PushPermissionGate() {
  const { user, loading } = useAuth();
  const attemptedRef = useRef(false);

  useEffect(() => {
    if (loading || !user || user.role !== "parent") return;
    if (!Capacitor.isNativePlatform()) return;

    const run = async () => {
      if (attemptedRef.current) return;
      const status = await getOsNotificationPermissionStatus();
      if (!isOsPermissionPromptable(status)) return;
      attemptedRef.current = true;
      await requestPushPermissionAfterLogin(user).catch(() => {});
    };

    run();
  }, [user?.uid, user?.role, loading]);

  return null;
}
