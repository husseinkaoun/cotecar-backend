import express from "express";
import { CATALOG_DATA } from "./catalog-data.js";

const router = express.Router();

// GET /catalog/makes
router.get("/makes", (req, res) => {
  const makes = CATALOG_DATA
    .map((x) => x.brand)
    .sort((a, b) => a.localeCompare(b));

  res.json(makes);
});

// GET /catalog/models
// ✔ supports:
//   /catalog/models
//   /catalog/models?brand=Toyota
//   /catalog/models?make=Toyota
router.get("/models", (req, res) => {
  const brand =
    req.query.brand ||
    req.query.make ||
    req.query.maker ||
    "";

  // If no brand → return full catalog
  if (!brand) {
    return res.json(CATALOG_DATA);
  }

  const found = CATALOG_DATA.find(
    (x) => x.brand.toLowerCase() === String(brand).trim().toLowerCase()
  );

  return res.json(found ? found.models : []);
});

// GET /catalog/all
router.get("/all", (req, res) => {
  res.json(CATALOG_DATA);
});

// ✅ ADD THIS — REQUIRED BY FRONTEND
// GET /catalog/cities
router.get("/cities", (req, res) => {
  res.json([
    "Abidjan",
    "Cocody",
    "Yopougon",
    "Plateau",
    "Marcory",
    "Treichville",
    "Koumassi",
    "Port-Bouët",
    "Anyama",
    "Bingerville",
  ]);
});

export default router;
