// ✅ FILE: src/verification/verification.controller.ts

import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
  UseInterceptors,
  UsePipes,
} from "@nestjs/common";
import { FileFieldsInterceptor } from "@nestjs/platform-express";
import { diskStorage } from "multer";
import * as path from "path"; // ✅ CHANGED (was extname import)
import * as fs from "fs"; // ✅ ADD
import type { Response } from "express";

import { VerificationService } from "./verification.service";
import { SubmitSellerVerificationDto } from "./dto/submit-seller-verification.dto";
import { AdminReviewDto } from "./dto/admin-review.dto";

import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { AdminGuard } from "../auth/admin.guard";

/* ----------------------------
   Helpers
---------------------------- */

function ensureImage(file: Express.Multer.File) {
  const ok = ["image/jpeg", "image/png", "image/webp"];
  return ok.includes(file.mimetype);
}

function filename(_: any, file: Express.Multer.File, cb: any) {
  if (!ensureImage(file)) {
    return cb(
      new BadRequestException("Only JPG/PNG/WEBP images allowed"),
      false
    );
  }

  const unique = `${Date.now()}-${Math.round(
    Math.random() * 1e9
  )}${path.extname(file.originalname)}`;

  cb(null, unique);
}

@Controller()
export class VerificationController {
  constructor(private readonly verification: VerificationService) {}

  private getUserId(req: any) {
    return req.user?.id || req.user?.userId || req.user?.sub;
  }

  // ----------------------------
  // Seller routes
  // ----------------------------

  @UseGuards(JwtAuthGuard)
  @Get("/verification/me")
  async me(@Req() req: any) {
    return this.verification.getMyVerification(req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Post("/verification/seller")
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: "idImage", maxCount: 1 },
        { name: "selfie", maxCount: 1 },
      ],
      {
        storage: diskStorage({
          destination: "uploads/verification",
          filename,
        }),

        // 🔐 Secure file size (3MB max per file)
        limits: { fileSize: 3 * 1024 * 1024 },

        // 🔐 Extra protection against fake files
        fileFilter: (req, file, cb) => {
          const allowed = ["image/jpeg", "image/png", "image/webp"];

          if (!allowed.includes(file.mimetype)) {
            return cb(
              new BadRequestException(
                "Only JPG, PNG, or WEBP images are allowed"
              ),
              false
            );
          }

          cb(null, true);
        },
      }
    )
  )
  async submit(@Req() req: any) {
    const dto: SubmitSellerVerificationDto = {
      idType: req.body?.idType,
      idNumber: req.body?.idNumber,
    };

    if (!dto.idType || String(dto.idType).trim().length < 2) {
      throw new BadRequestException("idType is required");
    }

    const files = req.files as {
      idImage?: Express.Multer.File[];
      selfie?: Express.Multer.File[];
    };

    return this.verification.submitSellerVerification(req.user, dto, files);
  }

  // ----------------------------
  // Admin routes
  // ----------------------------

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get("/admin/verification")
  async adminList(@Query("status") status?: string) {
    return this.verification.adminList(status);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Patch("/admin/verification/:id")
  async adminReview(@Param("id") id: string, @Req() req: any) {
    const dto: AdminReviewDto = {
      status: req.body?.status,
      note: req.body?.note,
    };

    if (!dto.status) {
      throw new BadRequestException(
        "status is required (VERIFIED or REJECTED)"
      );
    }

    return this.verification.adminReview(id, dto);
  }

  // ✅ Admin-only secure file view (verification images)
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get("/admin/verification/:id/file/:type")
  async adminFile(
    @Param("id") id: string,
    @Param("type") type: "idImage" | "selfie",
    @Res() res: Response
  ) {
    if (type !== "idImage" && type !== "selfie") {
      throw new BadRequestException("type must be idImage or selfie");
    }

    const filePath = await this.verification.getAdminFilePath(id, type);

    if (!filePath) {
      throw new BadRequestException("File path missing");
    }

    // ✅ normalize + make absolute

const fixed = String(filePath).split("\\").join("/");

    
    const absPath = path.isAbsolute(fixed)
      ? fixed
      : path.join(process.cwd(), fixed);

    // ✅ prevent path traversal outside uploads
    const uploadsRoot = path.join(process.cwd(), "uploads");
    if (!absPath.startsWith(uploadsRoot)) {
      throw new BadRequestException("Invalid file path");
    }

    if (!fs.existsSync(absPath)) {
      throw new BadRequestException("File not found on disk");
    }

    return res.sendFile(absPath);
  }
}
