import express from "express";
import prisma from "../db.js";
import jwt from "jsonwebtoken";

const router = express.Router();

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

// ─────────── GET /users/me ───────────
router.get("/me", protect, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
        whatsapp: true,
        city: true,
        sellerType: true,
        role: true,
      },
    });

    if (!user) return res.status(404).json({ message: "User not found" });

    res.json(user);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Server error" });
  }
});

// ─────────── PATCH /users/me ───────────
router.patch("/me", protect, async (req, res) => {
  try {
    const { city, whatsapp, fullName, phone } = req.body;

    const user = await prisma.user.update({
      where: { id: req.userId },
      data: {
        city: city ?? undefined,
        whatsapp: whatsapp ?? undefined,
        fullName: fullName ?? undefined,
        phone: phone ?? undefined,
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
        whatsapp: true,
        city: true,
        sellerType: true,
        role: true,
      },
    });

    res.json(user);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
