const express = require("express");
const { admin, initFirebaseAdmin, verifyIdToken } = require("../services/firebaseAdmin");
const { claimReservationSlot } = require("../../client/functions/claimReservationRuntime");

const router = express.Router();

const STATUS_BY_CODE = {
  unauthenticated: 401,
  "permission-denied": 403,
  "invalid-argument": 400,
  "failed-precondition": 409,
  "not-found": 404,
};

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

module.exports = router;
