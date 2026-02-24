// ✅ FILE: src/plans/plans.controller.ts
import { Controller, Get } from "@nestjs/common";
import { PlansService } from "./plans.service";

@Controller("plans")
export class PlansController {
  constructor(private readonly plansService: PlansService) {}

  // Public: show active plans to frontend
  @Get()
  listActive() {
    return this.plansService.listActive();
  }
}