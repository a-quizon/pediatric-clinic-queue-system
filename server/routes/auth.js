const express = require("express");
const { initFirebaseAdmin, getDb } = require("../services/firebaseAdmin");
const { resolveAccountByIdentifier } = require("../services/phoneLookup");

const router = express.Router();

/**
 * POST /api/auth/resolve-identifier
 * Body: { identifier: string }
 * Resolves email or phone → Firebase Auth email for password login.
 * Phone matching accepts +63 / 09 / 9… legacy formats and phone|phoneNumber fields.
 */
router.post("/auth/resolve-identifier", async (req, res) => {
  try {
    initFirebaseAdmin();
    const resolved = await resolveAccountByIdentifier(getDb(), req.body?.identifier);
    return res.json({
      success: true,
      type: resolved.type,
      email: resolved.email,
    });
  } catch (err) {
    console.error("[auth] resolve-identifier:", err.message);
    const statusByCode = {
      invalid_input: 400,
      user_not_found: 404,
    };
    return res.status(statusByCode[err.code] || 500).json({
      success: false,
      error: err.code || "internal",
      message: err.message || "Unable to resolve login identifier.",
    });
  }
});

module.exports = router;
