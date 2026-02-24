// ✅ FILE: src/verification/verification.service.ts

import { unlink } from "fs/promises";
import { existsSync } from "fs";

import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { SubmitSellerVerificationDto } from "./dto/submit-seller-verification.dto";
import { AdminReviewDto } from "./dto/admin-review.dto";

/* ---------- helpers ---------- */

async function resolveUserId(
  prisma: PrismaService,
  userOrId: any
): Promise<string | null> {
  if (typeof userOrId === "string" && userOrId.trim() !== "")
    return userOrId;

  const id = userOrId?.userId || userOrId?.id || userOrId?.sub || null;
  if (id) return id;

  const email = userOrId?.email || null;
  if (email) {
    const u = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    return u?.id || null;
  }

  return null;
}

@Injectable()
export class VerificationService {
  constructor(private readonly prisma: PrismaService) {}

  // -------------------------
  // Seller
  // -------------------------

  async getMyVerification(userOrId: any) {
    const userId = await resolveUserId(this.prisma, userOrId);

    if (!userId)
      throw new UnauthorizedException("Invalid token (missing id/email)");

    return this.prisma.sellerVerification.findUnique({
      where: { userId },
    });
  }

  async submitSellerVerification(
    userOrId: any,
    dto: SubmitSellerVerificationDto,
    files: {
      idImage?: Express.Multer.File[];
      selfie?: Express.Multer.File[];
    }
  ) {
    const userId = await resolveUserId(this.prisma, userOrId);

    if (!userId)
      throw new UnauthorizedException("Invalid token (missing id/email)");

    const idImage = files?.idImage?.[0];
    const selfie = files?.selfie?.[0];

    if (!idImage || !selfie) {
      throw new BadRequestException("ID image and selfie are required");
    }

    const existing = await this.prisma.sellerVerification.findUnique({
      where: { userId },
    });

    if (existing?.status === "VERIFIED") {
      throw new ForbiddenException("Seller already verified");
    }

    const idImagePath = (idImage.path || "").split("\\").join("/");
    const selfiePath = (selfie.path || "").split("\\").join("/");

    const data = {
      userId,
      idType: dto.idType,
      idNumber: dto.idNumber ?? null,
      idImage: idImagePath,
      selfie: selfiePath,
      status: "PENDING" as const,
      note: null,
      reviewedAt: null,
    };

    if (existing) {
      return this.prisma.sellerVerification.update({
        where: { userId },
        data,
      });
    }

    return this.prisma.sellerVerification.create({ data });
  }

  // -------------------------
  // Admin
  // -------------------------

  async adminList(status?: string) {
    return this.prisma.sellerVerification.findMany({
      where: status ? { status: status as any } : undefined,
      orderBy: { createdAt: "asc" },
    });
  }

  async adminReview(id: string, dto: AdminReviewDto) {
    const record = await this.prisma.sellerVerification.findUnique({
      where: { id },
    });

    if (!record) {
      throw new NotFoundException("Verification request not found");
    }

    // 🔐 If admin rejects → delete uploaded files safely
    if (dto.status === "REJECTED") {
      const toAbs = (p?: string | null) => {
        if (!p) return null;

        const fixed = String(p).split("\\").join("/");

        const isAbs =
          /^[A-Za-z]:\//.test(fixed) || fixed.startsWith("/");

        return isAbs
          ? fixed
        : `${process.cwd().split("\\").join("/")}/${fixed}`; 
      };

      try {
        const idPath = toAbs(record.idImage);
        const selfiePath = toAbs(record.selfie);

        if (idPath && existsSync(idPath)) {
          await unlink(idPath);
        }

        if (selfiePath && existsSync(selfiePath)) {
          await unlink(selfiePath);
        }
      } catch (err) {
        console.log("File delete error (safe to ignore):", err);
      }
    }

    return this.prisma.sellerVerification.update({
      where: { id },
      data: {
        status: dto.status as any,
        note: dto.note ?? null,
        reviewedAt: new Date(),
      },
    });
  }

  async getAdminFilePath(id: string, type: "idImage" | "selfie") {
    const record = await this.prisma.sellerVerification.findUnique({
      where: { id },
      select: { idImage: true, selfie: true },
    });

    if (!record) {
      throw new NotFoundException("Verification request not found");
    }

    const filePath =
      type === "idImage" ? record.idImage : record.selfie;

    if (!filePath) {
      throw new NotFoundException("File not found");
    }

    return filePath;
  }
}
