// ✅ FILE: routes/verification.js
import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import prisma from "../db.js";
import protect from "../middleware/auth.js";

const router = express.Router();

/* ============================= */
/* ✅ Ensure upload folder       */
/* ============================= */
const VERIFY_DIR = path.join(process.cwd(), "uploads", "verification");
if (!fs.existsSync(VERIFY_DIR)) {
  fs.mkdirSync(VERIFY_DIR, { recursive: true });
}

/* ============================= */
/* ✅ Multer setup               */
/* ============================= */
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, VERIFY_DIR),
  filename: (req, file, cb) => {
    const original = file.originalname || "file";
    const safe = original.replace(/[^a-zA-Z0-9._-]/g, "_");
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}-${safe}`);
  },
});

const upload = multer({ storage });

/* ============================= */
/* ✅ GET /verification/me       */
/* ============================= */
router.get("/me", protect, async (req, res) => {
  try {
    const userId = req.userId;

    const v = await prisma.sellerVerification.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });

    return res.json({
      status: v?.status || "NOT_SUBMITTED",
      note: v?.note || "",
      idImage: v?.idImage || null,
      selfie: v?.selfie || null,
      reviewedAt: v?.reviewedAt || null,
    });
  } catch (err) {
    console.error("GET /verification/me error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* ============================= */
/* ✅ POST /verification/seller  */
/* ============================= */
router.post(
  "/seller",
  protect,
  upload.fields([
    { name: "idPhoto", maxCount: 1 },
    { name: "selfiePhoto", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const userId = req.userId;

      const idPhotoFile = req.files?.idPhoto?.[0];
      const selfiePhotoFile = req.files?.selfiePhoto?.[0];

      if (!idPhotoFile || !selfiePhotoFile) {
        return res.status(400).json({ message: "Both photos are required" });
      }

      const idImage = `/uploads/verification/${idPhotoFile.filename}`;
      const selfie = `/uploads/verification/${selfiePhotoFile.filename}`;

      const existing = await prisma.sellerVerification.findFirst({
        where: { userId },
        orderBy: { createdAt: "desc" },
      });

      let row;

      if (existing) {
        row = await prisma.sellerVerification.update({
          where: { id: existing.id },
          data: {
            idType: "NATIONAL_ID",
            idNumber: null,
            idImage,
            selfie,
            status: "PENDING",
            note: null,
            reviewedAt: null,
          },
        });
      } else {
        row = await prisma.sellerVerification.create({
          data: {
            idType: "NATIONAL_ID",
            idNumber: null,
            idImage,
            selfie,
            status: "PENDING",
            note: null,
            reviewedAt: null,

            // ✅ THIS IS THE FIX
            user: {
              connect: { id: userId },
            },
          },
        });
      }

      res.json({
        message: "Verification submitted successfully",
        status: row.status,
      });
    } catch (err) {
      console.error("POST /verification/seller error:", err);
      res.status(500).json({ message: "Server error" });
    }
  }
);

export default router;
