require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { initFirebaseAdmin } = require("./services/firebaseAdmin");
const { configureVapid } = require("./services/webPushService");
const { startRealtimePushListeners } = require("./services/pushListeners");
const pushRouter = require("./routes/push");
const adminRouter = require("./routes/admin");
const smsAuthRouter = require("./routes/smsAuth");
const smsTestRouter = require("./routes/smsTest");
const authRouter = require("./routes/auth");

const app = express();
const PORT = Number(process.env.PORT) || 5000;

app.use(cors());
app.use(express.json({ limit: "256kb" }));

app.get("/", (_req, res) => {
  res.json({ status: "ok", service: "pediatric-clinic-queue-server" });
});

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api", pushRouter);
app.use("/api", adminRouter);
app.use("/api", smsAuthRouter);
app.use("/api", smsTestRouter);
app.use("/api", authRouter);

app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  configureVapid();
  try {
    initFirebaseAdmin();
    await startRealtimePushListeners();
  } catch (err) {
    console.error("[server] Realtime push dispatcher did not start:", err.message);
    console.error("[server] Closed-browser push will not send until serviceAccountKey.json is present.");
    console.error("[server] Ask the Firebase project Owner to generate the Admin SDK private key.");
  }
});
