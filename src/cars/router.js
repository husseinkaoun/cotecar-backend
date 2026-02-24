import express from "express";
import prisma from "../db.js"; // ✅ correct if file is in /routes
import jwt from "jsonwebtoken";

const router = express.Router();

// Protect middleware
const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ message: "No token" });
    }

    const token = authHeader.split(" ")[1];
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    // ✅ support both { id } and { sub } tokens
    req.userId = payload.id || payload.sub;

    if (!req.userId) {
      return res.status(401).json({ message: "Invalid token payload" });
    }

    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid token" });
  }
};

// GET /cars - Public
router.get("/", async (req, res) => {
  try {
    const cars = await prisma.car.findMany({
      include: {
        owner: {
          select: { fullName: true, phone: true, city: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    return res.json(cars);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Server error" });
  }
});

// GET /cars/mine - Protected
router.get("/mine", protect, async (req, res) => {
  try {
    const cars = await prisma.car.findMany({
      where: { ownerId: req.userId },
      include: {
        owner: {
          select: { fullName: true, phone: true, city: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    return res.json(cars);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Server error" });
  }
});

// POST /cars - Protected
router.post("/", protect, async (req, res) => {
  try {
    const {
      title,
      brand,
      model,
      year,
      price,
      mileage,
      condition,
      transmission,
      fuel,
      carType,
      color,
      description,
      images = [],
      published = true,
      status = "ACTIVE",
      address,
      lat,
      lng,
    } = req.body;

    const car = await prisma.car.create({
      data: {
        title,
        brand,
        model,
        year,
        price,
        mileage,
        condition,
        transmission,
        fuel,
        carType,
        color,
        description,
        images,
        published,
        status,
        address,
        lat: lat !== undefined && lat !== null && lat !== "" ? Number(lat) : null,
        lng: lng !== undefined && lng !== null && lng !== "" ? Number(lng) : null,
        ownerId: req.userId,
      },
      include: {
        owner: {
          select: { fullName: true, phone: true, city: true },
        },
      },
    });

    return res.status(201).json(car);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Server error" });
  }
});

export default router;
