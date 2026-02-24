// ✅ FILE: src/plans/plans.service.ts
import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class PlansService {
  constructor(private prisma: PrismaService) {}

  async listActive() {
    return this.prisma.listingPlan.findMany({
      where: { isActive: true },
      orderBy: { price: "asc" },
      select: {
        id: true,
        code: true,
        name: true,
        currency: true,
        price: true,
        listingLimit: true,
        featuredDays: true,
        isActive: true,
      },
    });
  }
}