const express = require("express");
const path = require("path");
const { admin, initFirebaseAdmin, verifyIdToken } = require("../services/firebaseAdmin");
const { deleteUserAccount } = require(path.join(__dirname, "../../client/functions/deleteUserAccountRuntime"));

const router = express.Router();

router.post("/admin/delete-user", async (req, res) => {
  try {
    initFirebaseAdmin();
  } catch (err) {
    return res.status(503).json({
      success: false,
      error: "Admin SDK is not configured on the local server.",
    });
  }

  const decoded = await verifyIdToken(req.headers.authorization);
  if (!decoded?.uid) {
    return res.status(401).json({ success: false, error: "Authentication required." });
  }

  try {
    await deleteUserAccount({
      admin,
      callerUid: decoded.uid,
      targetUid: req.body?.uid,
    });
    return res.json({ success: true });
  } catch (err) {
    console.error("[admin] delete-user failed:", err);
    const status = err.status || 500;
    return res.status(status).json({
      success: false,
      error: err.message || "Failed to delete user.",
    });
  }
});

module.exports = router;
