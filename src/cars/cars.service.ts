// ✅ FILE: src/cars/cars.service.ts
// FULL PRODUCTION VERSION — NO DEBUG
// - Only CAR allowed (AI check when enabled)
// - Cloudinary upload
// - Featured cars first (not expired)
// - Verified dealers first (after featured)
// - Admin feature/unfeature endpoints
// - Listing limit uses latest PAID DEALER_SUBSCRIPTION plan (NOT FEATURE_CAR)
// - Feature-by-plan consumes a PAID FEATURE_CAR payment by attaching carId
// - ✅ FIX: MongoDB null vs missing field for carId (OR: null OR isSet:false)

import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import axios from "axios";
import FormData from "form-data";
import { v2 as cloudinary } from "cloudinary";
import { Readable } from "stream";

type CarStatus = "ACTIVE" | "PAUSED" | "SOLD";

/* ---------- helpers ---------- */

function isObjectIdString(v: unknown): v is string {
  return typeof v === "string" && /^[a-f\d]{24}$/i.test(v);
}

function extractUserId(userOrId: any): string | null {
  if (typeof userOrId === "string") return userOrId;
  return (
    userOrId?.sub ||
    userOrId?.id ||
    userOrId?.userId ||
    userOrId?._id ||
    userOrId?.uid ||
    null
  );
}

function extractUserRole(user: any): string {
  return String(user?.role || "").toUpperCase();
}

function hasText(v: any) {
  return !!String(v ?? "").trim();
}

/* ---------- VERIFIED SELLER FLAG ---------- */

function isSellerVerified(owner: any): boolean {
  const st = String(owner?.verification?.status || "").toUpperCase();
  return st === "VERIFIED";
}

function withVerifiedOwner(cars: any[]) {
  return (cars || []).map((c) => {
    const owner = c?.owner || null;
    return {
      ...c,
      owner: owner
        ? {
            ...owner,
            sellerVerified: isSellerVerified(owner),
          }
        : owner,
    };
  });
}

/* ---------- AI CONFIG ---------- */

function aiEnabled() {
  return String(process.env.AI_ENABLED ?? "true").toLowerCase() !== "false";
}

function getAiUrl() {
  return process.env.AI_URL || "http://127.0.0.1:8001/check-image";
}

function getAiMinConf() {
  const n = Number(process.env.AI_MIN_CONF ?? 0.6);
  return Number.isFinite(n) ? n : 0.6;
}

function adminBypassEnabled() {
  return (
    String(process.env.AI_ADMIN_BYPASS || "true").toLowerCase() !== "false"
  );
}

type AiResult = { ok: boolean; label?: string; confidence?: number };

async function aiCheckImageBuffer(file: Express.Multer.File): Promise<AiResult> {
  const aiUrl = getAiUrl();
  const buf = (file as any)?.buffer as Buffer | undefined;

  if (!buf || !Buffer.isBuffer(buf)) {
    throw new Error("Upload file has no buffer.");
  }

  const form = new FormData();
  form.append("file", buf, {
    filename: file.originalname || "image.jpg",
    contentType: file.mimetype || "image/jpeg",
  });

  const res = await axios.post(aiUrl, form, {
    headers: { ...form.getHeaders() },
    timeout: 15000,
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
  });

  if (res.status < 200 || res.status >= 300) {
    throw new Error("AI service error");
  }

  return res.data as AiResult;
}

function isAllowedVehicle(ai: AiResult) {
  const label = String(ai?.label || "").toLowerCase();
  const conf = Number(ai?.confidence ?? 0);
  return ai?.ok === true && label === "car" && conf >= getAiMinConf();
}

/* ---------- CLOUDINARY ---------- */

function cloudinaryReady() {
  return (
    !!process.env.CLOUDINARY_CLOUD_NAME &&
    !!process.env.CLOUDINARY_API_KEY &&
    !!process.env.CLOUDINARY_API_SECRET
  );
}

function initCloudinaryOnce() {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME || "",
    api_key: process.env.CLOUDINARY_API_KEY || "",
    api_secret: process.env.CLOUDINARY_API_SECRET || "",
  });
}

async function uploadToCloudinary(file: Express.Multer.File): Promise<string> {
  if (!cloudinaryReady()) {
    throw new Error("Cloudinary env vars missing");
  }

  const buf = (file as any)?.buffer as Buffer | undefined;
  if (!buf || !Buffer.isBuffer(buf)) {
    throw new Error("Upload file has no buffer.");
  }

  const stream = Readable.from(buf);

  return new Promise<string>((resolve, reject) => {
    const up = cloudinary.uploader.upload_stream(
      {
        folder: "cotecar/cars",
        resource_type: "image",
        transformation: [{ quality: "auto" }, { fetch_format: "auto" }],
      },
      (err, result) => {
        if (err || !result?.secure_url) {
          return reject(err || new Error("Upload failed"));
        }
        resolve(result.secure_url);
      }
    );

    stream.pipe(up);
  });
}

/* ---------- OWNER SELECT ---------- */

const ownerSelect = {
  select: {
    id: true,
    email: true,
    role: true,
    fullName: true,
    phone: true,
    whatsapp: true,
    city: true,
    sellerType: true,
    address: true,
    lat: true,
    lng: true,
    createdAt: true,
    updatedAt: true,
    verification: {
      select: {
        status: true,
        reviewedAt: true,
      },
    },
  },
};

@Injectable()
export class CarsService {
  constructor(private prisma: PrismaService) {
    if (cloudinaryReady()) initCloudinaryOnce();
  }

  /* =======================================================
     PUBLIC LIST — FEATURED FIRST (NOT EXPIRED)
     Then VERIFIED dealers
     Then NEWEST
     ======================================================= */

  async findAllPublic() {
    const now = new Date();

    // Auto-expire featured
    await this.prisma.car.updateMany({
      where: {
        isFeatured: true,
        OR: [{ featuredUntil: null }, { featuredUntil: { lte: now } }],
      },
      data: { isFeatured: false, featuredUntil: null },
    });

    // 1) Featured first
    const featured = await this.prisma.car.findMany({
      where: {
        status: { in: ["ACTIVE", "SOLD"] },
        isFeatured: true,
        featuredUntil: { gt: now },
      },
      orderBy: { createdAt: "desc" },
      include: { owner: ownerSelect },
    });

    const featuredIds = featured.map((c) => c.id);

    // 2) Rest
    const rest = await this.prisma.car.findMany({
      where: {
        status: { in: ["ACTIVE", "SOLD"] },
        ...(featuredIds.length > 0 ? { id: { notIn: featuredIds } } : {}),
      },
      orderBy: { createdAt: "desc" },
      include: { owner: ownerSelect },
    });

    const restWithFlags = withVerifiedOwner(rest).sort((a: any, b: any) => {
      const av = a?.owner?.sellerVerified ? 1 : 0;
      const bv = b?.owner?.sellerVerified ? 1 : 0;
      if (bv !== av) return bv - av;
      return (
        new Date(b?.createdAt || 0).getTime() - new Date(a?.createdAt || 0).getTime()
      );
    });

    return withVerifiedOwner(featured).concat(restWithFlags);
  }

  /* ---------- MY CARS ---------- */

  async findMine(userOrId: any) {
    const userId = extractUserId(userOrId);
    if (!userId || !isObjectIdString(userId)) {
      throw new ForbiddenException("Invalid user");
    }

    const cars = await this.prisma.car.findMany({
      where: { ownerId: userId },
      orderBy: { createdAt: "desc" },
      include: { owner: ownerSelect },
    });

    return withVerifiedOwner(cars);
  }

  /* ---------- PLAN HELPERS ---------- */

  // listing limit plan = latest PAID DEALER_SUBSCRIPTION plan
  private async getUserListingPlan(userId: string) {
    const latestSub = await this.prisma.payment.findFirst({
      where: {
        userId,
        status: "PAID",
        type: "DEALER_SUBSCRIPTION",
      },
      orderBy: { createdAt: "desc" },
      include: { plan: true },
    });

    if (latestSub?.plan?.isActive) return latestSub.plan;

    // fallback: FREE plan must exist
    return this.prisma.listingPlan.findFirst({
      where: { code: "FREE", isActive: true },
    });
  }

  // feature credit = PAID FEATURE_CAR payment, usable if carId is null OR missing
  private async getUsableFeaturePayment(userId: string) {
    return this.prisma.payment.findFirst({
      where: {
        userId,
        status: "PAID",
        type: "FEATURE_CAR",
        OR: [{ carId: null }, { carId: { isSet: false } }],
      },
      orderBy: { createdAt: "desc" },
      include: { plan: true },
    });
  }

  /* ---------- CREATE CAR ---------- */

  async create(user: any, body: any, files: Express.Multer.File[]) {
    const userId = extractUserId(user);
    const role = extractUserRole(user);

    if (!userId || !isObjectIdString(userId)) {
      throw new ForbiddenException("Invalid user");
    }

    const dbUser = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, phone: true, fullName: true },
    });

    if (!dbUser) throw new ForbiddenException("Invalid user");

    if (!hasText(dbUser.phone) || !hasText(dbUser.fullName)) {
      throw new ForbiddenException(
        "Please complete your Seller Profile before posting."
      );
    }

    // Listing limits (non-admin)
    const isAdmin = role === "ADMIN";
    if (!isAdmin) {
      const plan = await this.getUserListingPlan(userId);

      const limitRaw = Number(plan?.listingLimit ?? 1);
      const limit =
        Number.isFinite(limitRaw) && limitRaw >= 1 ? Math.floor(limitRaw) : 1;

      const currentCount = await this.prisma.car.count({
        where: { ownerId: userId, status: { in: ["ACTIVE", "PAUSED"] } },
      });

      if (currentCount >= limit) {
        throw new ForbiddenException(
          `Listing limit reached (${limit}). Upgrade your plan to post more cars.`
        );
      }
    }

    // AI check (if enabled)
    const shouldCheckAI =
      aiEnabled() && !(role === "ADMIN" && adminBypassEnabled());

    const list = Array.isArray(files) ? files : [];

    if (shouldCheckAI) {
      for (const f of list) {
        try {
          const ai = await aiCheckImageBuffer(f);
          if (!isAllowedVehicle(ai)) {
            throw new BadRequestException("Only car photos are allowed.");
          }
        } catch {
          throw new BadRequestException(
            "Image verification failed. Only car photos are allowed."
          );
        }
      }
    }

    // Upload images
    let images: string[] = [];
    if (list.length > 0) {
      if (!cloudinaryReady()) {
        throw new BadRequestException(
          "Image upload not configured (Cloudinary missing)."
        );
      }
      try {
        images = await Promise.all(list.map((f) => uploadToCloudinary(f)));
      } catch {
        throw new BadRequestException("Image upload failed. Try again.");
      }
    }

    const car = await this.prisma.car.create({
      data: {
        title: body.title,
        brand: body.brand,
        model: body.model,
        year: Number(body.year),
        price: Number(body.price),
        mileage: body.mileage ? Number(body.mileage) : null,
        condition: body.condition || "Used",
        transmission: body.transmission || "Automatic",
        fuel: body.fuel || null,
        carType: body.carType || null,
        color: body.color || null,
        description: body.description || null,
        address: body.address || null,
        lat: body.lat ?? null,
        lng: body.lng ?? null,
        images,
        status: "ACTIVE",
        ownerId: userId,
      },
      include: { owner: ownerSelect },
    });

    return withVerifiedOwner([car])[0];
  }

  /* ---------- FEATURE (ADMIN) ---------- */

  async featureCar(id: string, days: number, userOrId: any) {
    const role = extractUserRole(userOrId);
    if (role !== "ADMIN") throw new ForbiddenException("Admin only");

    if (!id || !isObjectIdString(id)) {
      throw new BadRequestException("Invalid car id");
    }

    const car = await this.prisma.car.findUnique({ where: { id } });
    if (!car) throw new NotFoundException("Car not found");

    const d = Number(days);
    const safeDays =
      Number.isFinite(d) && d > 0 ? Math.min(90, Math.floor(d)) : 7;

    const until = new Date(Date.now() + safeDays * 24 * 60 * 60 * 1000);

    const updated = await this.prisma.car.update({
      where: { id },
      data: { isFeatured: true, featuredUntil: until },
      include: { owner: ownerSelect },
    });

    return withVerifiedOwner([updated])[0];
  }

  /* ---------- UNFEATURE (ADMIN) ---------- */

  async unfeatureCar(id: string, userOrId: any) {
    const role = extractUserRole(userOrId);
    if (role !== "ADMIN") throw new ForbiddenException("Admin only");

    if (!id || !isObjectIdString(id)) {
      throw new BadRequestException("Invalid car id");
    }

    const car = await this.prisma.car.findUnique({ where: { id } });
    if (!car) throw new NotFoundException("Car not found");

    const updated = await this.prisma.car.update({
      where: { id },
      data: { isFeatured: false, featuredUntil: null },
      include: { owner: ownerSelect },
    });

    return withVerifiedOwner([updated])[0];
  }

  /* ---------- FEATURE BY PAYMENT (USER) ---------- */

  async featureMyCarByPlan(carId: string, userOrId: any) {
    const userId = extractUserId(userOrId);
    const role = extractUserRole(userOrId);

    if (!userId || !isObjectIdString(userId)) {
      throw new ForbiddenException("Invalid user");
    }

    if (!carId || !isObjectIdString(carId)) {
      throw new BadRequestException("Invalid car id");
    }

    const car = await this.prisma.car.findUnique({ where: { id: carId } });
    if (!car) throw new NotFoundException("Car not found");

    if (car.ownerId !== userId && role !== "ADMIN") {
      throw new ForbiddenException("You do not own this car");
    }

    const pay = await this.getUsableFeaturePayment(userId);
    const daysRaw = Number(pay?.plan?.featuredDays ?? 0);
    const featuredDays =
      Number.isFinite(daysRaw) && daysRaw > 0 ? Math.floor(daysRaw) : 0;

    if (!pay || !pay.plan || !pay.plan.isActive || featuredDays <= 0) {
      throw new ForbiddenException(
        "No paid featured credit found. Please buy Featured (7D / 30D) and mark it PAID."
      );
    }

    const safeDays = Math.min(90, featuredDays);
    const until = new Date(Date.now() + safeDays * 24 * 60 * 60 * 1000);

    const updated = await this.prisma.car.update({
      where: { id: carId },
      data: { isFeatured: true, featuredUntil: until },
      include: { owner: ownerSelect },
    });

    await this.prisma.payment.update({
      where: { id: pay.id },
      data: { carId },
    });

    return withVerifiedOwner([updated])[0];
  }

  /* ---------- STATUS ---------- */

  async setStatus(id: string, status: CarStatus, userOrId: any) {
    const userId = extractUserId(userOrId);
    const role = extractUserRole(userOrId);

    if (!userId || !isObjectIdString(userId)) {
      throw new ForbiddenException("Invalid user");
    }

    const car = await this.prisma.car.findUnique({ where: { id } });
    if (!car) throw new NotFoundException("Car not found");

    if (car.ownerId !== userId && role !== "ADMIN") {
      throw new ForbiddenException("You do not own this car");
    }

    return this.prisma.car.update({
      where: { id },
      data: { status, soldAt: status === "SOLD" ? new Date() : null },
      include: { owner: ownerSelect },
    });
  }

  /* ---------- DELETE ---------- */

  async delete(id: string, userOrId: any) {
    const userId = extractUserId(userOrId);
    const role = extractUserRole(userOrId);

    if (!userId || !isObjectIdString(userId)) {
      throw new ForbiddenException("Invalid user");
    }

    const car = await this.prisma.car.findUnique({ where: { id } });
    if (!car) throw new NotFoundException("Car not found");

    if (car.ownerId !== userId && role !== "ADMIN") {
      throw new ForbiddenException("You do not own this car");
    }

    await this.prisma.car.delete({ where: { id } });
    return { success: true };
  }
}