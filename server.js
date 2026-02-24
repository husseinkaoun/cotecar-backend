// ✅ FILE: server.js
// ✅ PURPOSE NOW: ONLY serve /uploads static + debug + health check
// ❌ DO NOT mount auth/cars/users/catalog/verification routes here anymore
// ✅ Your real API is NestJS: `node dist/main.js`

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

dotenv.config();

const app = express();
const PORT = process.env.UPLOADS_PORT || 4000; // ✅ run uploads server on a different port

// ✅ Needed for __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ✅ Always resolve uploads from project root
const UPLOADS_DIR = path.join(__dirname, "uploads");
const CARS_UPLOADS_DIR = path.join(UPLOADS_DIR, "cars");
const VERIF_UPLOADS_DIR = path.join(UPLOADS_DIR, "verification");

// ✅ Ensure folders exist
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
if (!fs.existsSync(CARS_UPLOADS_DIR)) fs.mkdirSync(CARS_UPLOADS_DIR, { recursive: true });
if (!fs.existsSync(VERIF_UPLOADS_DIR)) fs.mkdirSync(VERIF_UPLOADS_DIR, { recursive: true });

// ✅ CORS (safe for static)
app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

// ✅ Health check
app.get("/", (req, res) => {
  res.send("CôteCar Uploads server running ✅");
});

// ✅ Static uploads (THIS FIXES Cannot GET /uploads/...)
app.use(
  "/uploads",
  express.static(UPLOADS_DIR, {
    fallthrough: false,
    maxAge: "7d",
  })
);

// ✅ Debug path (kept)
app.get("/debug/uploads", (req, res) => {
  res.json({
    cwd: process.cwd(),
    serverDir: __dirname,
    uploadsDir: UPLOADS_DIR,
    uploadsExists: fs.existsSync(UPLOADS_DIR),
    carsDir: CARS_UPLOADS_DIR,
    carsDirExists: fs.existsSync(CARS_UPLOADS_DIR),
    verificationDir: VERIF_UPLOADS_DIR,
    verificationDirExists: fs.existsSync(VERIF_UPLOADS_DIR),
  });
});

// ✅ 404
app.use((req, res) => {
  res.status(404).json({ message: "Not found" });
});

// ✅ Error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: "Server error" });
});

// ✅ Start
app.listen(PORT, () => {
  console.log(`UPLOADS SERVER RUNNING ON http://localhost:${PORT}`);
  console.log(`Serving uploads at http://localhost:${PORT}/uploads/...`);
});
