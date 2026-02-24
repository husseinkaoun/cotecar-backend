// ✅ FILE: src/payments/payments.controller.ts
// Public plans + user create payment + admin mark paid

import { Controller, Get, Post, Patch, Param, Body, UseGuards, Req } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { PaymentsService } from "./payments.service";

@Controller("payments")
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  // ✅ PUBLIC: list active plans (Standard / Featured / Dealer)
  @Get("plans")
  getPlans() {
    return this.paymentsService.getActivePlans();
  }

  // ✅ USER: create a payment (PENDING) for a plan
  @UseGuards(JwtAuthGuard)
  @Post("create")
  create(@Req() req: any, @Body() body: { planCode: string }) {
    return this.paymentsService.createPaymentForPlan(body?.planCode, req.user);
  }

  // ✅ ADMIN: confirm payment manually (sets PAID)
  @UseGuards(JwtAuthGuard)
  @Patch(":id/mark-paid")
  markPaid(@Req() req: any, @Param("id") id: string) {
    return this.paymentsService.adminMarkPaid(id, req.user);
  }
}