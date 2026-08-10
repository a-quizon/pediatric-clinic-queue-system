const express = require("express");
const cors = require("cors");
const admin = require("firebase-admin");
require("dotenv").config();

const app = express();

app.use(cors({
  origin: "http://localhost:5173", // Restrict CORS to the Vite frontend
  credentials: true
}));
app.use(express.json());

// Initialize Firebase Admin
let isFirebaseAdminInitialized = false;

try {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  // Replace literal '\n' characters in the environment variable with actual newlines
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (projectId && clientEmail && privateKey) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey,
      }),
      databaseURL: "https://pediatric-clinic-queue-system-default-rtdb.asia-southeast1.firebasedatabase.app"
    });
    isFirebaseAdminInitialized = true;
    console.log("Firebase Admin successfully initialized via environment variables.");
  } else {
    console.warn("\n=======================================================");
    console.warn("WARNING: Firebase Admin credentials are missing from .env!");
    console.warn("The /api/admin/update-staff-email endpoint will fail.");
    console.warn("Please configure:");
    console.warn("  FIREBASE_PROJECT_ID");
    console.warn("  FIREBASE_CLIENT_EMAIL");
    console.warn("  FIREBASE_PRIVATE_KEY");
    console.warn("=======================================================\n");
  }
} catch (error) {
  console.error("Error initializing Firebase Admin SDK. Please check your credentials.", error.message);
}

// Middleware to verify Firebase ID token
const verifyAdminToken = async (req, res, next) => {
  if (!isFirebaseAdminInitialized) {
    return res.status(500).json({ error: "Server is missing Firebase Admin configuration." });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized: Missing or invalid token" });
  }

  const idToken = authHeader.split("Bearer ")[1];

  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    
    // Verify the requesting user is an admin in the database
    const callerRef = admin.database().ref(`users/${decodedToken.uid}`);
    const snapshot = await callerRef.once("value");
    const callerData = snapshot.val();

    if (!callerData || callerData.role !== "admin" || callerData.status !== "active") {
      return res.status(403).json({ error: "Forbidden: Only active admins can perform this action" });
    }

    req.adminUser = decodedToken;
    next();
  } catch (error) {
    console.error("Auth Error:", error);
    return res.status(401).json({ error: "Unauthorized: Invalid token" });
  }
};

app.post("/api/admin/update-staff-email", verifyAdminToken, async (req, res) => {
  const { targetUid, newEmail } = req.body;

  if (!targetUid || !newEmail) {
    return res.status(400).json({ error: "Missing required fields: targetUid or newEmail" });
  }

  try {
    // 1. Fetch current target user data from Database to verify their role
    const targetRef = admin.database().ref(`users/${targetUid}`);
    const targetSnapshot = await targetRef.once("value");
    const targetData = targetSnapshot.val();

    if (!targetData) {
      return res.status(404).json({ error: "Target user not found in database." });
    }

    // Security Check: Ensure we only modify doctor or secretary emails
    if (targetData.role !== "doctor" && targetData.role !== "secretary") {
      return res.status(403).json({ error: "Forbidden: You can only modify doctor or secretary emails through this API." });
    }

    // 2. Fetch current target user data from Auth in case we need to rollback
    const currentAuthUser = await admin.auth().getUser(targetUid);
    const oldEmail = currentAuthUser.email;

    // Skip if email is the same
    if (oldEmail === newEmail) {
      return res.status(200).json({ message: "Email is already up to date" });
    }

    // 3. Update Firebase Auth Email
    try {
      await admin.auth().updateUser(targetUid, { email: newEmail });
    } catch (authError) {
      console.error("Firebase Auth Update Error:", authError);
      if (authError.code === 'auth/email-already-exists') {
        return res.status(409).json({ error: "The email address is already in use by another account." });
      } else if (authError.code === 'auth/invalid-email') {
        return res.status(400).json({ error: "The email address is improperly formatted." });
      }
      return res.status(500).json({ error: "Failed to update authentication credential" });
    }

    // 4. Update Realtime Database
    try {
      await targetRef.update({
        email: newEmail,
        updatedAt: Date.now()
      });
      
      return res.status(200).json({ message: "Staff email updated successfully" });
    } catch (dbError) {
      console.error("Database Update Error:", dbError);
      
      // ROLLBACK: Revert Firebase Auth email
      try {
        await admin.auth().updateUser(targetUid, { email: oldEmail });
        console.log(`Rolled back auth email for targetUid: ${targetUid}`);
      } catch (rollbackError) {
        console.error(`CRITICAL: Staff email synchronization rollback failed for targetUid: ${targetUid}`, rollbackError);
      }

      return res.status(500).json({ error: "Failed to update database profile. Action was rolled back." });
    }
  } catch (error) {
    console.error("General Error updating staff email:", error);
    return res.status(500).json({ error: "An unexpected error occurred" });
  }
});

app.get("/", (req, res) => {
  res.send("Server Running");
});

app.listen(5000, () => {
  console.log("Server running on port 5000");
});