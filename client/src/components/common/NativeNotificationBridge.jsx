import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import {
  registerNativeNotificationClickHandler,
  startNativeNotificationListener,
} from "../../services/nativeNotificationService";

/**
 * Bridges RTDB notification writes to the Android OS notification shade
 * when running inside the Capacitor APK (Web Push is unavailable in WebView).
 */
export default function NativeNotificationBridge() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    return registerNativeNotificationClickHandler((url) => navigate(url));
  }, [navigate]);

  useEffect(() => {
    if (loading || !user || user.role !== "parent") return undefined;
    return startNativeNotificationListener(user.uid, {
      devicePushEnabled: user.devicePushEnabled === true,
    });
  }, [user?.uid, user?.role, user?.devicePushEnabled, loading]);

  return null;
}
