import admin from "firebase-admin";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let firebaseAdmin = null;

try {
  let serviceAccount = null;

  // Option 1: Use Base64 env var (most reliable on Vercel - no escaping issues)
  const base64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
  if (base64 && typeof base64 === "string" && base64.length > 100) {
    try {
      const jsonStr = Buffer.from(base64, "base64").toString("utf8");
      serviceAccount = JSON.parse(jsonStr);
      console.log("Firebase: Using credentials from FIREBASE_SERVICE_ACCOUNT_BASE64");
    } catch (e) {
      console.error("Firebase: Invalid FIREBASE_SERVICE_ACCOUNT_BASE64:", e.message);
    }
  }

  // Option 2: Use JSON env var (Vercel)
  if (!serviceAccount && process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON.trim();
    // Reject paths (e.g. "./firebase-service-account.json") - they cause JSON parse errors
    if (raw.startsWith("{") && raw.endsWith("}")) {
      try {
        serviceAccount = JSON.parse(raw);
        console.log("Firebase: Using credentials from FIREBASE_SERVICE_ACCOUNT_JSON");
      } catch (e) {
        console.error("Firebase: Invalid FIREBASE_SERVICE_ACCOUNT_JSON:", e.message);
      }
    } else {
      console.warn("Firebase: FIREBASE_SERVICE_ACCOUNT_JSON looks like a path, not JSON. Use the full JSON or FIREBASE_SERVICE_ACCOUNT_BASE64.");
    }
  }

  // Option 3: Use local file (development only - file is gitignored, never on Vercel)
  if (!serviceAccount) {
    try {
      const serviceAccountPath = path.join(__dirname, "firebase-service-account.json");
      if (fs.existsSync(serviceAccountPath)) {
        serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"));
        console.log("Firebase: Using credentials from firebase-service-account.json file");
      }
    } catch (e) {
      // File missing on Vercel - expected, skip
    }
  }

  if (serviceAccount) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    firebaseAdmin = admin;
    console.log("Firebase: Initialized successfully");
  } else {
    console.warn("Firebase: No credentials found. Push notifications will be disabled.");
  }
} catch (err) {
  console.error("Firebase: Failed to initialize:", err.message);
  firebaseAdmin = null;
}

export default firebaseAdmin;
