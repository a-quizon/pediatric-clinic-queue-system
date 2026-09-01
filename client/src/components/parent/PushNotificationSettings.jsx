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
      className={`relative inline-flex h-7 w-12 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed ${
        checked ? "bg-blue-600" : "bg-gray-200"
      }`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${
          checked ? "translate-x-6" : "translate-x-1"
        }`}
      />
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
      <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-xs flex justify-center items-center">
        <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
      </div>
    );
  }

  if (variant === "dashboard") {
    if (!supported || osDenied || deviceEnabled || !promptable) return null;
    if (!checkPushSupport()) return null;

    return (
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-4 border border-blue-100 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-in fade-in slide-in-from-bottom-4">
        <div className="flex items-start sm:items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-xl text-white shrink-0 shadow-sm">
            <Bell className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-bold text-blue-900 text-sm">Stay updated on your queue</h4>
            <p className="text-xs text-blue-700 mt-0.5 pr-2">
              Get notified when you are almost next, when it is your turn, or when your reservation changes.
            </p>
          </div>
        </div>
        <button
          onClick={handleDeviceToggle}
          disabled={isUpdatingDevice}
          className="w-full sm:w-auto shrink-0 px-4 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-sm font-bold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
    <div className="bg-white rounded-3xl p-5 sm:p-6 border border-gray-100 shadow-xs space-y-5">
      <p className="text-sm text-gray-500">
        Choose how you want to receive clinic and queue updates.
      </p>

      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-extrabold text-gray-800">In-app notifications</p>
          <p className="text-sm text-gray-500 mt-0.5">
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

      <div className="border-t border-gray-100" />

      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-extrabold text-gray-800">Device-level push notifications</p>
          <p className="text-sm text-gray-500 mt-0.5">{deviceHelper}</p>
        </div>
        {isUpdatingDevice ? (
          <Loader2 className="w-5 h-5 text-gray-400 animate-spin flex-shrink-0 mt-1" />
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
        <div className="flex items-start gap-2 text-xs text-gray-500 bg-gray-50 rounded-2xl p-3">
          <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <p>
            System permission is still allowed. Turning this off stops alerts from this app; revoke permission in device settings if you want to block them system-wide.
          </p>
        </div>
      )}
    </div>
  );
}
