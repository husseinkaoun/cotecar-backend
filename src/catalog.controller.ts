import { Controller, Get, Query } from "@nestjs/common";

@Controller("catalog")
export class CatalogController {
  @Get("makes")
  async makes() {
    // TODO: replace with your DB logic later
    return [];
  }

  @Get("models")
  async models(@Query("makeId") makeId?: string) {
    // TODO: replace with your DB logic later
    return [];
  }
}
