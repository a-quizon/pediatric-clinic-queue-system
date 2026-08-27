const webpush = require("web-push");
const { getDb } = require("./firebaseAdmin");

let vapidReady = false;

function configureVapid() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:clinic@localhost";

  if (!publicKey || !privateKey) {
    console.warn("[webPush] VAPID keys missing. Set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY.");
    vapidReady = false;
    return false;
  }

  try {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    vapidReady = true;
    return true;
  } catch (err) {
    console.error("[webPush] Failed to configure VAPID:", err.message);
    vapidReady = false;
    return false;
  }
}

function isVapidReady() {
  return vapidReady || configureVapid();
}

function getPublicVapidKey() {
  return process.env.VAPID_PUBLIC_KEY || "";
}

function sanitizeKey(value) {
  return String(value || "").replace(/[.#$\[\]]/g, "_");
}

function collectSubscriptions(pushSubscriptions) {
  if (!pushSubscriptions || typeof pushSubscriptions !== "object") return [];
  return Object.entries(pushSubscriptions)
    .map(([key, value]) => {
      if (!value || !value.endpoint || !value.keys?.p256dh || !value.keys?.auth) {
        return null;
      }
      return {
        key,
        subscription: {
          endpoint: value.endpoint,
          expirationTime: value.expirationTime || null,
          keys: {
            p256dh: value.keys.p256dh,
            auth: value.keys.auth,
          },
        },
      };
    })
    .filter(Boolean);
}

async function deleteGoneSubscriptions(parentId, keys) {
  if (!keys.length) return;
  const updates = {};
  keys.forEach((key) => {
    updates[key] = null;
  });
  await getDb().ref(`users/${parentId}/pushSubscriptions`).update(updates);
}

async function claimPushDispatch(parentId, notificationId) {
  if (!parentId || !notificationId) return true;
  const flagRef = getDb().ref(`notifications/${parentId}/${notificationId}/pushDispatchedAt`);
  const result = await flagRef.transaction((current) => {
    if (current) return;
    return Date.now();
  });
  return Boolean(result.committed && result.snapshot.exists());
}

async function sendToSubscription(subscription, payload, options = {}) {
  if (!isVapidReady()) {
    throw new Error("VAPID keys are not configured");
  }

  return webpush.sendNotification(subscription, JSON.stringify(payload), {
    TTL: options.TTL ?? 60 * 60,
    urgency: options.urgency || "normal",
    topic: options.topic ? String(options.topic).slice(0, 32) : undefined,
  });
}

function buildPayload(notification = {}) {
  const type = notification.type || notification.eventId || "INFO";
  return {
    title: notification.title || "Pediatric Clinic",
    body: notification.body || notification.message || "You have a new clinic update.",
    message: notification.body || notification.message || "",
    type,
    tag: notification.dedupeKey || notification.id || type,
    url: notification.url || "/parent/notifications",
    icon: "/favicon.svg",
    reservationId: notification.reservationId || null,
    branchId: notification.branchId || null,
  };
}

async function sendPushToParent(parentId, notification, options = {}) {
  if (!parentId) {
    return { success: false, sent: 0, failed: 0, reason: "missing_parent" };
  }
  if (!isVapidReady()) {
    return { success: false, sent: 0, failed: 0, reason: "vapid_not_configured" };
  }

  const notificationId = options.notificationId || notification.id || notification.dedupeKey;
  if (notificationId && options.claim !== false) {
    const claimed = await claimPushDispatch(parentId, sanitizeKey(notificationId));
    if (!claimed) {
      return { success: true, sent: 0, failed: 0, reason: "already_dispatched" };
    }
  }

  const snap = await getDb().ref(`users/${parentId}`).once("value");
  if (!snap.exists()) {
    return { success: false, sent: 0, failed: 0, reason: "user_not_found" };
  }

  const user = snap.val() || {};
  if (user.role && user.role !== "parent") {
    return { success: false, sent: 0, failed: 0, reason: "not_parent" };
  }

  const entries = collectSubscriptions(user.pushSubscriptions);
  if (!entries.length) {
    return { success: true, sent: 0, failed: 0, reason: "no_subscriptions" };
  }

  const payload = buildPayload(notification);
  const urgency = ["YOU_ARE_NEXT", "ALMOST_NEXT", "CHECK_IN_REQUESTED", "PENALIZED", "FORFEITED"].includes(payload.type)
    ? "high"
    : "normal";

  let sent = 0;
  let failed = 0;
  const goneKeys = [];

  await Promise.all(
    entries.map(async ({ key, subscription }) => {
      try {
        await sendToSubscription(subscription, payload, {
          urgency,
          topic: payload.tag,
        });
        sent += 1;
      } catch (err) {
        failed += 1;
        const statusCode = err.statusCode || err.status;
        if (statusCode === 404 || statusCode === 410) {
          goneKeys.push(key);
        } else {
          console.error(`[webPush] send failed for ${parentId}:`, err.message);
        }
      }
    })
  );

  if (goneKeys.length) {
    await deleteGoneSubscriptions(parentId, goneKeys).catch((err) => {
      console.error("[webPush] failed to prune expired subscriptions:", err.message);
    });
  }

  return { success: sent > 0 || failed === 0, sent, failed, pruned: goneKeys.length };
}

async function saveSubscription(userId, subscription) {
  if (!userId || !subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
    throw new Error("Invalid subscription payload");
  }

  const crypto = require("crypto");
  const key = crypto.createHash("sha256").update(subscription.endpoint).digest("hex");
  await getDb().ref(`users/${userId}/pushSubscriptions/${key}`).update({
    endpoint: subscription.endpoint,
    expirationTime: subscription.expirationTime || null,
    keys: subscription.keys,
    updatedAt: Date.now(),
    createdAt: Date.now(),
  });
  await getDb().ref(`users/${userId}`).update({
    notificationPermission: "granted",
    notificationTokenUpdatedAt: Date.now(),
  });
  return key;
}

async function deleteSubscription(userId, subscription) {
  if (!userId || !subscription?.endpoint) return;
  const crypto = require("crypto");
  const key = crypto.createHash("sha256").update(subscription.endpoint).digest("hex");
  await getDb().ref(`users/${userId}/pushSubscriptions/${key}`).remove();
}

module.exports = {
  configureVapid,
  isVapidReady,
  getPublicVapidKey,
  sendPushToParent,
  sendToSubscription,
  saveSubscription,
  deleteSubscription,
  buildPayload,
  sanitizeKey,
};
