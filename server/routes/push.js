const express = require("express");
const { verifyIdToken, getDb } = require("../services/firebaseAdmin");
const {
  getPublicVapidKey,
  isVapidReady,
  saveSubscription,
  deleteSubscription,
  sendPushToParent,
} = require("../services/webPushService");
const { deliverNotification } = require("../services/notificationEngine");

const router = express.Router();
const STAFF_ROLES = new Set(["admin", "doctor", "secretary"]);

function isValidSubscription(subscription) {
  return Boolean(
    subscription &&
      typeof subscription.endpoint === "string" &&
      subscription.endpoint.startsWith("https://") &&
      subscription.keys &&
      subscription.keys.p256dh &&
      subscription.keys.auth
  );
}

async function requireUser(req, res, next) {
  const decoded = await verifyIdToken(req.headers.authorization);
  if (!decoded?.uid) {
    return res.status(401).json({ success: false, error: "Authentication required." });
  }
  req.authUser = decoded;
  return next();
}

router.get("/vapid-public-key", (_req, res) => {
  if (!isVapidReady() || !getPublicVapidKey()) {
    return res.status(503).json({ success: false, error: "VAPID public key is not configured." });
  }
  return res.json({ success: true, publicKey: getPublicVapidKey() });
});

router.post("/save-subscription", requireUser, async (req, res) => {
  try {
    const { userId, subscription } = req.body || {};
    const targetUserId = userId || req.authUser.uid;

    if (targetUserId !== req.authUser.uid) {
      return res.status(403).json({ success: false, error: "You can only save a subscription for your own account." });
    }
    if (!isValidSubscription(subscription)) {
      return res.status(400).json({ success: false, error: "Invalid Push subscription payload." });
    }

    const key = await saveSubscription(targetUserId, subscription);
    return res.json({ success: true, key });
  } catch (err) {
    console.error("[push] save-subscription failed:", err);
    return res.status(500).json({ success: false, error: "Failed to save subscription." });
  }
});

router.post("/delete-subscription", requireUser, async (req, res) => {
  try {
    const { userId, subscription } = req.body || {};
    const targetUserId = userId || req.authUser.uid;
    if (targetUserId !== req.authUser.uid) {
      return res.status(403).json({ success: false, error: "You can only delete your own subscription." });
    }
    await deleteSubscription(targetUserId, subscription);
    return res.json({ success: true });
  } catch (err) {
    console.error("[push] delete-subscription failed:", err);
    return res.status(500).json({ success: false, error: "Failed to delete subscription." });
  }
});

router.post("/send-notification", requireUser, async (req, res) => {
  try {
    const { parentId, eventId, notification, title, body, url, type } = req.body || {};
    const targetParentId = parentId || req.authUser.uid;
    const roleSnap = await getDb().ref(`users/${req.authUser.uid}/role`).once("value");
    const role = roleSnap.exists() ? roleSnap.val() : null;

    const isSelf = targetParentId === req.authUser.uid;
    const isStaff = STAFF_ROLES.has(role);
    const hasDispatchSecret =
      process.env.PUSH_DISPATCH_SECRET &&
      req.headers["x-push-secret"] === process.env.PUSH_DISPATCH_SECRET;

    if (!isSelf && !isStaff && !hasDispatchSecret) {
      return res.status(403).json({ success: false, error: "Not allowed to send this notification." });
    }

    if (eventId) {
      const delivered = await deliverNotification(eventId, {
        parentId: targetParentId,
        ...notification,
        reservationId: req.body.reservationId,
        branchId: req.body.branchId,
        dedupeKey: req.body.dedupeKey,
      });
      return res.json({ success: Boolean(delivered) });
    }

    const payload = {
      title: title || notification?.title || "Pediatric Clinic",
      body: body || notification?.body || notification?.message || "You have a new clinic update.",
      type: type || notification?.type || "INFO",
      url: url || notification?.url || "/parent/notifications",
      id: notification?.id || notification?.dedupeKey || req.body.dedupeKey,
      reservationId: req.body.reservationId || notification?.reservationId || null,
    };

    const result = await sendPushToParent(targetParentId, payload, {
      notificationId: payload.id,
      claim: Boolean(payload.id),
    });
    return res.json({ success: result.success, ...result });
  } catch (err) {
    console.error("[push] send-notification failed:", err);
    return res.status(500).json({ success: false, error: "Failed to send notification." });
  }
});

module.exports = router;
