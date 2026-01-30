import express from "express";
import auth from "../middleware/auth.js";
import admin from "../firebaseAdmin.js";
import PushToken from "../models/pushToken.model.js";

const router = express.Router();

/**
 * Register / save FCM token
 */
router.post("/register", auth, async (req, res) => {
  try {
    if (!req.body) {
      return res.status(400).json({ error: "Request body is missing. Make sure Content-Type is application/json" });
    }
    
    const { token, platform = "web" } = req.body;

    if (!token || typeof token !== "string") {
      return res.status(400).json({ error: "Invalid token" });
    }

    const cleanToken = token.trim();

    await PushToken.findOneAndUpdate(
      { token: cleanToken },
      {
        userId: req.user._id,
        platform,
        lastSeen: new Date(),
      },
      { upsert: true, new: true }
    );

    return res.json({ success: true });
  } catch (err) {
    console.error("Push registration error:", err);
    return res.status(500).json({ error: "Failed to register push token" });
  }
});

/**
 * 🔔 TEST PUSH (verify everything works)
 */
router.post("/test", auth, async (req, res) => {
  try {
    const records = await PushToken.find({
      userId: req.user._id,
      platform: "web",
    }).lean();

    const tokens = records.map((r) => r.token);

    if (!tokens.length) {
      return res.status(404).json({ error: "No tokens for this user" });
    }

    const resp = await admin.messaging().sendEachForMulticast({
      tokens,
      notification: {
        title: "Test Push ✅",
        body: "If you see this, FCM web push is working.",
      },
      data: { link: "/" }, // MUST be strings
      webpush: {
        fcmOptions: { link: "http://localhost:3000/" },
      },
    });

    return res.json({
      success: true,
      successCount: resp.successCount,
      failureCount: resp.failureCount,
    });
  } catch (err) {
    console.error("Push test error:", err);
    return res.status(500).json({ error: "Push test failed" });
  }
});

export default router;
