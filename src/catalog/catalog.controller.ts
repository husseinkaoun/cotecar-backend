// src/catalog/catalog.controller.ts
import { Controller, Get, Query } from "@nestjs/common";
import { CatalogService } from "./catalog.service";
import { CI_CITIES } from "./cities.data";

@Controller("catalog")
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get("makes")
  getMakes() {
    return this.catalogService.getMakes();
  }

  @Get("models")
  getModels(@Query("make") make: string) {
    return this.catalogService.getModels(make);
  }

  @Get("years")
  getYears() {
    return this.catalogService.getYears();
  }

  @Get("fuels")
  getFuels() {
    return this.catalogService.getFuels();
  }

  // ✅ NEW: cities
  @Get("cities")
  getCities() {
    return CI_CITIES;
  }
}
