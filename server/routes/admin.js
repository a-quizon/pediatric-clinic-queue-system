const express = require("express");
const path = require("path");
const { admin, initFirebaseAdmin, verifyIdToken } = require("../services/firebaseAdmin");
const { deleteUserAccount } = require(path.join(__dirname, "../../client/functions/deleteUserAccountRuntime"));
const { resetSecretaryPassword } = require(path.join(__dirname, "../../client/functions/resetSecretaryPasswordRuntime"));
const { updateUserAccount } = require(path.join(__dirname, "../../client/functions/updateUserAccountRuntime"));

const router = express.Router();

function requireAdminSdk(res) {
  try {
    initFirebaseAdmin();
    return true;
  } catch (err) {
    res.status(503).json({
      success: false,
      error: "Admin SDK is not configured on the local server.",
    });
    return false;
  }
}

router.post("/admin/delete-user", async (req, res) => {
  if (!requireAdminSdk(res)) return;

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

router.post("/admin/update-user", async (req, res) => {
  if (!requireAdminSdk(res)) return;

  const decoded = await verifyIdToken(req.headers.authorization);
  if (!decoded?.uid) {
    return res.status(401).json({ success: false, error: "Authentication required." });
  }

  try {
    await updateUserAccount({
      admin,
      callerUid: decoded.uid,
      targetUid: req.body?.uid,
      updates: req.body?.updates,
    });
    return res.json({ success: true });
  } catch (err) {
    console.error("[admin] update-user failed:", err.message);
    const status = err.status || 500;
    return res.status(status).json({
      success: false,
      error: err.message || "Failed to update user.",
    });
  }
});

router.post("/admin/reset-secretary-password", async (req, res) => {
  if (!requireAdminSdk(res)) return;

  const decoded = await verifyIdToken(req.headers.authorization);
  if (!decoded?.uid) {
    return res.status(401).json({ success: false, error: "Authentication required." });
  }

  try {
    const result = await resetSecretaryPassword({
      admin,
      callerUid: decoded.uid,
      targetUid: req.body?.uid,
    });
    // temporaryPassword is returned once to the authenticated doctor; never logged.
    return res.json({
      success: true,
      uid: result.uid,
      temporaryPassword: result.temporaryPassword,
      secretaryName: result.secretaryName,
    });
  } catch (err) {
    console.error("[admin] reset-secretary-password failed:", err.message);
    const status = err.status || 500;
    return res.status(status).json({
      success: false,
      error: err.message || "Failed to reset secretary password.",
    });
  }
});

module.exports = router;
