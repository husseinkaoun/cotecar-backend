// ✅ FILE: routes/auth.js
import express from "express";
import prisma from "../db.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const router = express.Router();

/* ============================= */
/* ✅ REGISTER                  */
/* ============================= */
router.post("/register", async (req, res) => {
  try {
    const { email, password, fullName, phone } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password required" });
    }

    const existing = await prisma.user.findUnique({
      where: { email },
    });

    if (existing) {
      return res.status(400).json({ message: "Email already exists" });
    }

    const hashedPassword = bcrypt.hashSync(password, 10);

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        fullName: fullName || null,
        phone: phone || null,
      },
    });

    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET || "temp-fallback-secret-CHANGE-THIS",
      { expiresIn: "7d" }
    );

    res.json({ token });
  } catch (err) {
    console.error("REGISTER error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* ============================= */
/* ✅ LOGIN                     */
/* ============================= */
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET || "temp-fallback-secret-CHANGE-THIS",
      { expiresIn: "7d" }
    );

    res.json({ token });
  } catch (err) {
    console.error("LOGIN error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* ============================= */
/* ✅ ME (current user)         */
/* ============================= */
router.get("/me", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "No token" });
    }

    const token = authHeader.split(" ")[1];

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || "temp-fallback-secret-CHANGE-THIS"
    );

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
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

    if (!user) {
      return res.status(401).json({ message: "Invalid token" });
    }

    res.json(user);
  } catch (err) {
    console.error("ME error:", err);
    res.status(401).json({ message: "Invalid token" });
  }
});

export default router;
