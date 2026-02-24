import express from "express";
import prisma from "../db.js";
import jwt from "jsonwebtoken";
import multer from "multer";
import fs from "fs";

const router = express.Router();

// ✅ ensure folders exist
if (!fs.existsSync("uploads")) fs.mkdirSync("uploads");
if (!fs.existsSync("uploads/cars")) fs.mkdirSync("uploads/cars");

// ─────────── AUTH MIDDLEWARE ───────────
const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ message: "No token" });
    }
    const token = authHeader.split(" ")[1];
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = payload.id || payload.sub;
    next();
  } catch {
    return res.status(401).json({ message: "Invalid token" });
  }
};

// ─────────── MULTER (save to disk) ───────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/cars"),
  filename: (req, file, cb) => {
    const original = file.originalname || "";
    const dot = original.lastIndexOf(".");
    const ext = dot >= 0 ? original.slice(dot) : "";
    const safeExt = ext && ext.length <= 10 ? ext.replace(/[^.a-z0-9]/gi, "") : "";
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${safeExt}`);
  },
});
const upload = multer({ storage }).array("images", 10);

// ─────────── HELPERS ───────────
function toNum(v) {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function normalizeStatus(s) {
  const v = String(s || "").toUpperCase();
  if (v === "ACTIVE" || v === "PAUSED" || v === "SOLD") return v;
  return null;
}
async function ensureOwnerOr403(carId, userId) {
  const car = await prisma.car.findUnique({ where: { id: carId } });
  if (!car) return { ok: false, status: 404, msg: "Car not found" };
  if (car.ownerId !== userId) return { ok: false, status: 403, msg: "Forbidden" };
  return { ok: true, car };
}

// ─────────── ROUTES ───────────

// GET /cars (public)
router.get("/", async (req, res) => {
  try {
    const cars = await prisma.car.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        owner: {
          select: {
            id: true,
            fullName: true,
            phone: true,
            whatsapp: true,
            city: true,
            sellerType: true,
          },
        },
      },
    });
    res.json(cars);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Server error" });
  }
});

// GET /cars/:id (public)
router.get("/:id", async (req, res) => {
  try {
    const car = await prisma.car.findUnique({
      where: { id: req.params.id },
      include: {
        owner: {
          select: {
            id: true,
            fullName: true,
            phone: true,
            whatsapp: true,
            city: true,
            sellerType: true,
          },
        },
      },
    });
    if (!car) return res.status(404).json({ message: "Car not found" });
    res.json(car);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Server error" });
  }
});

// POST /cars (protected + upload)
router.post("/", protect, upload, async (req, res) => {
  try {
    const files = Array.isArray(req.files) ? req.files : [];
    const images = files.map((f) => `/uploads/cars/${f.filename}`);

    const car = await prisma.car.create({
      data: {
        title: req.body.title || "",
        brand: req.body.brand || "",
        model: req.body.model || "",
        fuel: req.body.fuel || "",
        condition: req.body.condition || "",
        transmission: req.body.transmission || "",
        carType: req.body.carType || "",
        color: req.body.color || "",
        description: req.body.description || "",
        address: req.body.address || "",

        year: toNum(req.body.year),
        price: toNum(req.body.price),
        mileage: toNum(req.body.mileage),
        lat: toNum(req.body.lat),
        lng: toNum(req.body.lng),

        status: req.body.status ? String(req.body.status).toUpperCase() : "ACTIVE",
        images,
        ownerId: req.userId,
      },
    });

    res.status(201).json(car);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Server error" });
  }
});

// PATCH /cars/:id/status (protected)
router.patch("/:id/status", protect, async (req, res) => {
  try {
    const carId = req.params.id;
    const status = normalizeStatus(req.body.status);

    if (!status) return res.status(400).json({ message: "Invalid status" });

    const check = await ensureOwnerOr403(carId, req.userId);
    if (!check.ok) return res.status(check.status).json({ message: check.msg });

    const updated = await prisma.car.update({
      where: { id: carId },
      data: { status },
    });

    res.json(updated);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Server error" });
  }
});

// DELETE /cars/:id (protected)
router.delete("/:id", protect, async (req, res) => {
  try {
    const carId = req.params.id;

    const check = await ensureOwnerOr403(carId, req.userId);
    if (!check.ok) return res.status(check.status).json({ message: check.msg });

    await prisma.car.delete({ where: { id: carId } });

    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
