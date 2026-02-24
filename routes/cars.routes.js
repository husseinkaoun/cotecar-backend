import express from "express";
import { requireAuth } from "../middleware/auth.js";
import {
  getPublicCars,
  getMyCars,
  setCarStatus,
  deleteCar,
} from "../controllers/cars.controller.js";

const router = express.Router();

// Public (shows only ACTIVE)
router.get("/", getPublicCars);

// Private (my cars: ACTIVE + PAUSED + SOLD)
router.get("/mine", requireAuth, getMyCars);

// Owner-only actions
router.patch("/:id/status", requireAuth, setCarStatus);
router.delete("/:id", requireAuth, deleteCar);

export default router;
