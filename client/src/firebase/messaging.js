import { checkPushSupport } from "../services/pushService";

export const VAPID_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || import.meta.env.VITE_FIREBASE_VAPID_KEY;

if (import.meta.env.DEV && !import.meta.env.VITE_VAPID_PUBLIC_KEY) {
  console.warn(
    "[Push] Warning: VITE_VAPID_PUBLIC_KEY is missing in .env. Generate keys with `npm run generate-vapid` in /server."
  );
}

/**
 * Checks whether Web Push (service worker + PushManager + Notifications) is available.
 */
export const checkMessagingSupported = async () => {
  return checkPushSupport();
};

export const getMessagingInstance = async () => {
  return null;
};
