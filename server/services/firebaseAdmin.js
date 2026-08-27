const fs = require("fs");
const path = require("path");
const admin = require("firebase-admin");

function loadServiceAccount() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    } catch (err) {
      console.error("[firebaseAdmin] FIREBASE_SERVICE_ACCOUNT is not valid JSON");
    }
  }

  const envPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const localPath = path.join(__dirname, "..", "serviceAccountKey.json");
  const candidate = envPath || localPath;

  if (candidate && fs.existsSync(candidate)) {
    return JSON.parse(fs.readFileSync(candidate, "utf8"));
  }

  return null;
}

function hasServiceAccount() {
  return Boolean(loadServiceAccount());
}

function initFirebaseAdmin() {
  if (admin.apps.length) {
    return admin.app();
  }

  const projectId =
    process.env.FIREBASE_PROJECT_ID ||
    process.env.GCLOUD_PROJECT ||
    "pediatric-clinic-queue-testing";

  const databaseURL =
    process.env.FIREBASE_DATABASE_URL ||
    `https://${projectId}-default-rtdb.firebaseio.com`;

  const serviceAccount = loadServiceAccount();
  const options = { projectId, databaseURL };

  if (!serviceAccount) {
    const expectedPath = path.join(__dirname, "..", "serviceAccountKey.json");
    console.error("[firebaseAdmin] No Admin SDK key found.");
    console.error(`[firebaseAdmin] Place the JSON at: ${expectedPath}`);
    console.error("[firebaseAdmin] Viewer accounts cannot generate this key in Firebase Console.");
    console.error("[firebaseAdmin] Ask a project Owner to download it from Project settings → Service accounts.");
    throw new Error("Missing Firebase Admin service account key");
  }

  options.credential = admin.credential.cert(serviceAccount);

  try {
    admin.initializeApp(options);
    console.log(`[firebaseAdmin] Initialized for project ${projectId}`);
  } catch (err) {
    console.error("[firebaseAdmin] Failed to initialize:", err.message);
    throw err;
  }

  return admin.app();
}

function getDb() {
  initFirebaseAdmin();
  return admin.database();
}

async function verifyIdToken(authHeader) {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) return null;
  try {
    initFirebaseAdmin();
    return await admin.auth().verifyIdToken(token);
  } catch (err) {
    console.error("[firebaseAdmin] ID token verification failed:", err.message);
    return null;
  }
}

module.exports = {
  admin,
  initFirebaseAdmin,
  getDb,
  verifyIdToken,
  hasServiceAccount,
};
