import admin from "firebase-admin";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let firebaseAdmin = null;

try {
  let serviceAccount = null;

  // Option 1: Use env var (Vercel / production)
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    console.log("Firebase: Using credentials from FIREBASE_SERVICE_ACCOUNT_JSON env var");
  } else {
    // Option 2: Use local file (development)
    const serviceAccountPath = path.join(__dirname, "firebase-service-account.json");
    if (fs.existsSync(serviceAccountPath)) {
      serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"));
      console.log("Firebase: Using credentials from firebase-service-account.json file");
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
