import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CATALOG_DATA } from "./catalog.data";

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async getMakes(): Promise<string[]> {
    const rows = await this.prisma.catalogMake.findMany({
      select: { make: true },
      orderBy: { make: "asc" },
    });
    return rows.map((r) => r.make);
  }

  async getModels(make: string): Promise<string[]> {
    if (!make) return [];
    const row = await this.prisma.catalogMake.findUnique({
      where: { make },
      select: { models: true },
    });
    return row?.models || [];
  }

  getYears(): number[] {
    const year = new Date().getFullYear();
    return Array.from({ length: 40 }, (_, i) => year + 1 - i);
  }

  getFuels(): string[] {
    return ["Electric", "Hybrid", "Petrol", "Diesel"];
  }

  async upsertMake(make: string, models: string[]) {
    const cleanModels = Array.from(
      new Set((models || []).map((m) => m.trim()).filter(Boolean))
    ).sort();

    await this.prisma.catalogMake.upsert({
      where: { make },
      update: { models: cleanModels },
      create: { make, models: cleanModels },
    });
  }

  async seedBasicDemo() {
    // Convert {brand, models} -> {make, models}
    for (const item of CATALOG_DATA) {
      const make = (item.brand || "").trim();
      if (!make) continue;
      await this.upsertMake(make, item.models || []);
    }

    // Return the REAL number of makes now in DB
    const total = await this.prisma.catalogMake.count();
    return { ok: true, seeded: CATALOG_DATA.length, totalMakesInDb: total };
  }
}
