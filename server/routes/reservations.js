const express = require("express");
const { admin, initFirebaseAdmin, verifyIdToken } = require("../services/firebaseAdmin");
const { claimReservationSlot } = require("../../client/functions/claimReservationRuntime");
const { notifyParentsScheduleAvailable } = require("../services/notificationEngine");

const router = express.Router();

const STATUS_BY_CODE = {
  unauthenticated: 401,
  "permission-denied": 403,
  "invalid-argument": 400,
  "failed-precondition": 409,
  "not-found": 404,
};

const STAFF_ROLES = new Set(["doctor", "secretary", "admin"]);

router.post("/reservations/claim", async (req, res) => {
  try {
    initFirebaseAdmin();
    const decoded = await verifyIdToken(req.headers.authorization);
    if (!decoded?.uid) {
      return res.status(401).json({
        success: false,
        error: "unauthenticated",
        message: "You must be signed in.",
      });
    }

    const result = await claimReservationSlot({
      admin,
      callerUid: decoded.uid,
      payload: req.body,
    });
    return res.json({ success: true, ...result });
  } catch (err) {
    const code = STATUS_BY_CODE[err.code] ? err.code : "internal";
    console.error("[reservations/claim]", err.message);
    return res.status(STATUS_BY_CODE[code] || 500).json({
      success: false,
      error: code,
      message: err.message || "Could not reserve a slot.",
    });
  }
});

router.post("/schedules/notify-available", async (req, res) => {
  try {
    initFirebaseAdmin();
    const decoded = await verifyIdToken(req.headers.authorization);
    if (!decoded?.uid) {
      return res.status(401).json({
        success: false,
        error: "unauthenticated",
        message: "You must be signed in.",
      });
    }
    const roleSnap = await admin.database().ref(`users/${decoded.uid}/role`).once("value");
    const role = roleSnap.exists() ? roleSnap.val() : null;
    if (!STAFF_ROLES.has(role)) {
      return res.status(403).json({
        success: false,
        error: "permission-denied",
        message: "Only clinic staff can notify parents.",
      });
    }

    const batchId = String(req.body?.batchId || "").trim();
    if (!batchId) {
      return res.status(400).json({
        success: false,
        error: "invalid-argument",
        message: "batchId is required.",
      });
    }

    const result = await notifyParentsScheduleAvailable({
      batchId,
      branchId: req.body?.branchId || null,
      branchName: req.body?.branchName || "",
      postedCount: Number(req.body?.postedCount || 0),
      startDate: req.body?.startDate || null,
      endDate: req.body?.endDate || null,
    });
    return res.json({ success: true, ...result });
  } catch (err) {
    console.error("[schedules/notify-available]", err.message);
    return res.status(500).json({
      success: false,
      error: "internal",
      message: err.message || "Could not notify parents.",
    });
  }
});

module.exports = router;
