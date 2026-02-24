// ✅ FILE: src/cars/cars.controller.ts
// FULL FILE (with the new endpoint: PATCH :id/feature-by-plan)

import {
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Param,
  Body,
  UseGuards,
  Req,
  UseInterceptors,
  UploadedFiles,
  BadRequestException,
} from "@nestjs/common";
import { FilesInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import { CarsService } from "./cars.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CreateCarDto } from "./dto/create-car.dto";

type CarStatus = "ACTIVE" | "PAUSED" | "SOLD";

@Controller("cars")
export class CarsController {
  constructor(private readonly carsService: CarsService) {}

  /* ==============================
     🔓 PUBLIC LIST
     ============================== */
  @Get()
  getAll() {
    return this.carsService.findAllPublic();
  }

  /* ==============================
     🔐 MY CARS
     ============================== */
  @UseGuards(JwtAuthGuard)
  @Get("mine")
  getMine(@Req() req: any) {
    return this.carsService.findMine(req.user);
  }

  /* ==============================
     🔐 CREATE CAR
     ============================== */
  @UseGuards(JwtAuthGuard)
  @Post()
  @UseInterceptors(
    FilesInterceptor("images", 10, {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (req, file, cb) => {
        const allowedTypes = ["image/jpeg", "image/png", "image/webp"];

        if (!allowedTypes.includes(file.mimetype)) {
          return cb(
            new BadRequestException("Only JPG, PNG, or WEBP images are allowed"),
            false
          );
        }

        cb(null, true);
      },
    })
  )
  create(
    @Req() req: any,
    @UploadedFiles() files: Express.Multer.File[],
    @Body() body: CreateCarDto
  ) {
    const normalizedBody = {
      ...body,
      address:
        typeof (body as any).address === "string"
          ? (body as any).address.trim()
          : undefined,
      lat:
        (body as any).lat !== undefined &&
        (body as any).lat !== null &&
        String((body as any).lat).trim() !== ""
          ? Number((body as any).lat)
          : undefined,
      lng:
        (body as any).lng !== undefined &&
        (body as any).lng !== null &&
        String((body as any).lng).trim() !== ""
          ? Number((body as any).lng)
          : undefined,
    };

    return this.carsService.create(req.user, normalizedBody, files || []);
  }

  /* ==============================
     🔐 FEATURE CAR (USER BY PLAN)
     ============================== */
  @UseGuards(JwtAuthGuard)
  @Patch(":id/feature-by-plan")
  featureByPlan(@Req() req: any, @Param("id") id: string) {
    return this.carsService.featureMyCarByPlan(id, req.user);
  }

  /* ==============================
     🔐 FEATURE CAR (ADMIN ONLY)
     ============================== */
  @UseGuards(JwtAuthGuard)
  @Patch(":id/feature")
  featureCar(
    @Req() req: any,
    @Param("id") id: string,
    @Body() body: { days?: number }
  ) {
    // role check happens in service
    return this.carsService.featureCar(id, body?.days ?? 7, req.user);
  }

  /* ==============================
     🔐 UNFEATURE CAR (ADMIN ONLY)
     ============================== */
  @UseGuards(JwtAuthGuard)
  @Patch(":id/unfeature")
  unfeatureCar(@Req() req: any, @Param("id") id: string) {
    // role check happens in service
    return this.carsService.unfeatureCar(id, req.user);
  }

  /* ==============================
     🔐 CHANGE STATUS
     ============================== */
  @UseGuards(JwtAuthGuard)
  @Patch(":id/status")
  setStatus(
    @Req() req: any,
    @Param("id") id: string,
    @Body() body: { status: CarStatus }
  ) {
    const allowed: CarStatus[] = ["ACTIVE", "PAUSED", "SOLD"];

    if (!body?.status || !allowed.includes(body.status)) {
      throw new BadRequestException(
        `status must be one of: ${allowed.join(", ")}`
      );
    }

    return this.carsService.setStatus(id, body.status, req.user);
  }

  /* ==============================
     🔐 DELETE CAR
     ============================== */
  @UseGuards(JwtAuthGuard)
  @Delete(":id")
  delete(@Req() req: any, @Param("id") id: string) {
    return this.carsService.delete(id, req.user);
  }
}