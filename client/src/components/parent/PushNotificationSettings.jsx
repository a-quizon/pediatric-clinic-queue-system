import React, { useState, useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { Bell, Loader2, Info } from "lucide-react";
import { checkMessagingSupported } from "../../firebase/messaging";
import {
  checkPushSupport,
  disableDevicePush,
  getOsNotificationPermissionStatus,
  isOsPermissionPromptable,
  registerPushSubscription,
} from "../../services/pushService";
import { setInAppNotificationsEnabled } from "../../services/notificationPreferencesService";
import { useAuth } from "../../hooks/useAuth";

function ToggleSwitch({ checked, disabled, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
      className={`pq-switch ${checked ? "" : ""}`}
    >
      <span className="pq-switch-knob" />
    </button>
  );
}

export default function PushNotificationSettings({ variant = "settings" }) {
  const { user, updateContextUser } = useAuth();
  const [osStatus, setOsStatus] = useState("loading");
  const [supported, setSupported] = useState(true);
  const [isUpdatingInApp, setIsUpdatingInApp] = useState(false);
  const [isUpdatingDevice, setIsUpdatingDevice] = useState(false);

  const inAppEnabled = user?.inAppNotificationsEnabled !== false;
  const deviceEnabled = user?.devicePushEnabled === true;
  const osDenied = osStatus === "denied";
  const osGranted = osStatus === "granted";
  const promptable = isOsPermissionPromptable(osStatus);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      try {
        const isSupported = Capacitor.isNativePlatform()
          ? true
          : await checkMessagingSupported();
        if (!isMounted) return;
        if (!isSupported) {
          setSupported(false);
          setOsStatus("unsupported");
          return;
        }
        setSupported(true);
        const status = await getOsNotificationPermissionStatus();
        if (!isMounted) return;
        setOsStatus(status);
        if (status === "denied" && user?.devicePushEnabled) {
          await disableDevicePush(user);
          updateContextUser?.({
            devicePushEnabled: false,
            notificationPermission: "denied",
          });
        }
      } catch (_err) {
        if (isMounted) {
          setSupported(false);
          setOsStatus("unsupported");
        }
      }
    };

    if (user) load();
    return () => {
      isMounted = false;
    };
  }, [user?.uid, user?.devicePushEnabled, user?.notificationPermission]);

  const handleInAppToggle = async () => {
    if (!user?.uid || isUpdatingInApp) return;
    const next = !inAppEnabled;
    setIsUpdatingInApp(true);
    try {
      await setInAppNotificationsEnabled(user.uid, next);
      updateContextUser?.({ inAppNotificationsEnabled: next });
    } catch (err) {
      console.error("Failed to update in-app notification preference:", err);
    } finally {
      setIsUpdatingInApp(false);
    }
  };

  const handleDeviceToggle = async () => {
    if (!user?.uid || isUpdatingDevice || osDenied) return;
    setIsUpdatingDevice(true);
    try {
      if (deviceEnabled) {
        await disableDevicePush(user);
        updateContextUser?.({ devicePushEnabled: false });
      } else {
        const result = await registerPushSubscription(user);
        const status = await getOsNotificationPermissionStatus();
        setOsStatus(status);
        const granted = Boolean(result) && status === "granted";
        updateContextUser?.({
          devicePushEnabled: granted,
          notificationPermission: status,
        });
      }
    } catch (err) {
      console.error("Failed to update device push preference:", err);
    } finally {
      setIsUpdatingDevice(false);
    }
  };

  if (osStatus === "loading") {
    if (variant === "dashboard") return null;
    return (
      <div className="pq-glass p-5 flex justify-center items-center">
        <Loader2 className="w-5 h-5 pq-faint animate-spin" />
      </div>
    );
  }

  if (variant === "dashboard") {
    if (!supported || osDenied || deviceEnabled || !promptable) return null;
    if (!checkPushSupport()) return null;

    return (
      <div className="pq-glass p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3">
          <div className="p-2 rounded-xl text-white shrink-0" style={{ background: "var(--pq-mark-blue)" }}>
            <Bell className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-bold text-sm">Stay updated on your queue</h4>
            <p className="text-xs pq-muted mt-0.5 pr-2">
              Get notified when you are almost next, when it is your turn, or when your reservation changes.
            </p>
          </div>
        </div>
        <button
          onClick={handleDeviceToggle}
          disabled={isUpdatingDevice}
          className="pq-btn-primary w-full sm:w-auto shrink-0"
        >
          {isUpdatingDevice && <Loader2 className="w-4 h-4 animate-spin" />}
          {isUpdatingDevice ? "Enabling..." : "Enable Notifications"}
        </button>
      </div>
    );
  }

  const deviceHelper = !supported
    ? "This device cannot receive background notifications."
    : osDenied
      ? Capacitor.isNativePlatform()
        ? "Notifications are blocked in system settings. Enable them there to turn this on."
        : "Notifications are blocked in your browser settings. Unblock them to turn this on."
      : deviceEnabled
        ? Capacitor.isNativePlatform()
          ? "You will receive alerts on this device when clinic updates occur."
          : "You will receive alerts on this device even if the browser is closed."
        : "Allow device notifications to get alerts when the app is in the background.";

  return (
    <div className="pq-glass p-5 sm:p-6 space-y-5">
      <p className="text-sm pq-muted">
        Choose how you want to receive clinic and queue updates.
      </p>

      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-extrabold">In-app notifications</p>
          <p className="text-sm pq-muted mt-0.5">
            Show toast alerts while you are using the app. Your notification history is always saved.
          </p>
        </div>
        <ToggleSwitch
          checked={inAppEnabled}
          disabled={isUpdatingInApp}
          onChange={handleInAppToggle}
          label="In-app notifications"
        />
      </div>

      <div style={{ borderTop: "1px solid var(--pq-glass-line)" }} />

      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-extrabold">Device-level push notifications</p>
          <p className="text-sm pq-muted mt-0.5">{deviceHelper}</p>
        </div>
        {isUpdatingDevice ? (
          <Loader2 className="w-5 h-5 pq-faint animate-spin flex-shrink-0 mt-1" />
        ) : (
          <ToggleSwitch
            checked={deviceEnabled && osGranted}
            disabled={!supported || osDenied || isUpdatingDevice}
            onChange={handleDeviceToggle}
            label="Device-level push notifications"
          />
        )}
      </div>

      {osGranted && !deviceEnabled && supported && (
        <div className="flex items-start gap-2 text-xs pq-note pq-note-info">
          <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <p>
            System permission is still allowed. Turning this off stops alerts from this app; revoke permission in device settings if you want to block them system-wide.
          </p>
        </div>
      )}
    </div>
  );
}
