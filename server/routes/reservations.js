const express = require("express");
const {
  admin,
  initFirebaseAdmin,
  verifyIdToken,
  getDemoDb,
  isDemoToken,
} = require("../services/firebaseAdmin");
const { claimReservationSlot } = require("../../client/functions/claimReservationRuntime");
const { releaseReservationForCaller } = require("../../client/functions/slotRelease");
const { publishClinicDays } = require("../../client/functions/schedulePublishRuntime");
const { validateReservationCode } = require("../../client/functions/validateReservationCodeRuntime");
const {
  updateQueueRules,
  updateSmsRules,
} = require("../../client/functions/systemConfigurationRuntime");
const {
  updateQueueSessionStatus,
  endClinicSession,
  updateScheduleSlotCapacity,
} = require("../../client/functions/queueSessionRuntime");
const { runWithDatabase } = require("../../client/functions/rtdbRouter");
const { notifyParentsScheduleAvailable } = require("../services/notificationEngine");

const router = express.Router();

/** Demo accounts must read and write the demo RTDB instance, never the live one. */
function runForCaller(decoded, fn) {
  if (!isDemoToken(decoded)) return fn();
  return runWithDatabase(getDemoDb(), fn, { suppressSms: true });
}

const STATUS_BY_CODE = {
  unauthenticated: 401,
  "permission-denied": 403,
  "invalid-argument": 400,
  "failed-precondition": 409,
  "not-found": 404,
  "resource-exhausted": 429,
};

const STAFF_ROLES = new Set(["doctor", "secretary"]);

router.post("/reservations/validate-code", async (req, res) => {
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

    const result = await runForCaller(decoded, () =>
      validateReservationCode({
        admin,
        callerUid: decoded.uid,
        code: req.body?.code,
        source: req.body?.source === "qr" ? "qr" : "manual",
      })
    );
    return res.json({ success: true, ...result });
  } catch (err) {
    const code = STATUS_BY_CODE[err.code] ? err.code : "internal";
    console.error("[reservations/validate-code]", err.message);
    return res.status(STATUS_BY_CODE[code] || 500).json({
      success: false,
      error: code,
      message: err.message || "Could not validate the reservation code.",
      ...(err.lockedUntil != null ? { lockedUntil: err.lockedUntil } : {}),
      ...(err.retryAfterSeconds != null ? { retryAfterSeconds: err.retryAfterSeconds } : {}),
    });
  }
});

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

    const result = await runForCaller(decoded, () =>
      claimReservationSlot({
        admin,
        callerUid: decoded.uid,
        payload: req.body,
      })
    );
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

router.post("/reservations/release", async (req, res) => {
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

    const result = await runForCaller(decoded, () =>
      releaseReservationForCaller({
        admin,
        callerUid: decoded.uid,
        reservationId: req.body?.reservationId,
      })
    );
    return res.json({ success: true, ...result });
  } catch (err) {
    const code = STATUS_BY_CODE[err.code] ? err.code : "internal";
    console.error("[reservations/release]", err.message);
    return res.status(STATUS_BY_CODE[code] || 500).json({
      success: false,
      error: code,
      message: err.message || "Could not release the slot.",
    });
  }
});

router.post("/schedules/publish", async (req, res) => {
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

    const result = await runForCaller(decoded, () =>
      publishClinicDays({
        admin,
        callerUid: decoded.uid,
        payload: req.body,
      })
    );
    return res.json({ success: true, ...result });
  } catch (err) {
    const code = STATUS_BY_CODE[err.code] ? err.code : "internal";
    console.error("[schedules/publish]", err.message);
    return res.status(STATUS_BY_CODE[code] || 500).json({
      success: false,
      error: code,
      message: err.message || "Could not post this day.",
    });
  }
});

router.post("/schedules/queue-status", async (req, res) => {
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

    const result = await runForCaller(decoded, () =>
      updateQueueSessionStatus({
        admin,
        callerUid: decoded.uid,
        scheduleId: req.body?.scheduleId,
        queueStatus: req.body?.queueStatus,
      })
    );
    return res.json({ success: true, ...result });
  } catch (err) {
    const code = STATUS_BY_CODE[err.code] ? err.code : "internal";
    console.error("[schedules/queue-status]", err.message);
    return res.status(STATUS_BY_CODE[code] || 500).json({
      success: false,
      error: code,
      message: err.message || "Could not update queue status.",
    });
  }
});

router.post("/schedules/end-session", async (req, res) => {
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

    const result = await runForCaller(decoded, () =>
      endClinicSession({
        admin,
        callerUid: decoded.uid,
        scheduleId: req.body?.scheduleId,
      })
    );
    return res.json({ success: true, ...result });
  } catch (err) {
    const code = STATUS_BY_CODE[err.code] ? err.code : "internal";
    console.error("[schedules/end-session]", err.message);
    return res.status(STATUS_BY_CODE[code] || 500).json({
      success: false,
      error: code,
      message: err.message || "Could not end the clinic session.",
    });
  }
});

router.post("/schedules/slot-capacity", async (req, res) => {
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

    const result = await runForCaller(decoded, () =>
      updateScheduleSlotCapacity({
        admin,
        callerUid: decoded.uid,
        scheduleId: req.body?.scheduleId,
        slotCapacity: req.body?.slotCapacity,
      })
    );
    return res.json({ success: true, ...result });
  } catch (err) {
    const code = STATUS_BY_CODE[err.code] ? err.code : "internal";
    console.error("[schedules/slot-capacity]", err.message);
    return res.status(STATUS_BY_CODE[code] || 500).json({
      success: false,
      error: code,
      message: err.message || "Could not update slot capacity.",
    });
  }
});

router.post("/system-configuration/queue-rules", async (req, res) => {
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

    const result = await runForCaller(decoded, () =>
      updateQueueRules({
        admin,
        callerUid: decoded.uid,
        branchId: req.body?.branchId,
        queueRules: req.body?.queueRules || req.body,
      })
    );
    return res.json({ success: true, ...result });
  } catch (err) {
    const code = STATUS_BY_CODE[err.code] ? err.code : "internal";
    console.error("[system-configuration/queue-rules]", err.message);
    return res.status(STATUS_BY_CODE[code] || 500).json({
      success: false,
      error: code,
      message: err.message || "Could not update queue rules.",
    });
  }
});

router.post("/system-configuration/sms-rules", async (req, res) => {
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

    const result = await runForCaller(decoded, () =>
      updateSmsRules({
        admin,
        callerUid: decoded.uid,
        branchId: req.body?.branchId,
        sms: req.body?.sms || req.body,
      })
    );
    return res.json({ success: true, ...result });
  } catch (err) {
    const code = STATUS_BY_CODE[err.code] ? err.code : "internal";
    console.error("[system-configuration/sms-rules]", err.message);
    return res.status(STATUS_BY_CODE[code] || 500).json({
      success: false,
      error: code,
      message: err.message || "Could not update SMS rules.",
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
    const isDemo = isDemoToken(decoded);
    const db = isDemo ? getDemoDb() : admin.database();
    const roleSnap = await db.ref(`users/${decoded.uid}/role`).once("value");
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

    // The local notification engine only reads the live database, so it would push to real parents.
    if (isDemo) {
      return res.json({ success: true, skipped: true, reason: "demo_database" });
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
