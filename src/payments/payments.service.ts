// ✅ FILE: src/payments/payments.service.ts
// Service: list plans + create payment (manual for now) + admin mark paid

import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

function isObjectIdString(v: unknown): v is string {
  return typeof v === "string" && /^[a-f\d]{24}$/i.test(v);
}

function extractUserId(userOrId: any): string | null {
  if (typeof userOrId === "string") return userOrId;
  return userOrId?.sub || userOrId?.id || userOrId?.userId || null;
}

function extractUserRole(user: any): string {
  return String(user?.role || "").toUpperCase();
}

function makeReference() {
  const hex = Math.random().toString(16).slice(2, 8).toUpperCase();
  return `PAY-${Date.now()}-${hex}`;
}

@Injectable()
export class PaymentsService {
  constructor(private prisma: PrismaService) {}

  // ✅ PUBLIC: return active plans for pricing page (safe fields only)
  async getActivePlans() {
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
      },
    });
  }

  // ✅ USER: Create a payment intent (PENDING) for a plan
  async createPaymentForPlan(planCode: string, userOrId: any) {
    const userId = extractUserId(userOrId);
    if (!userId || !isObjectIdString(userId)) {
      throw new ForbiddenException("Invalid user");
    }

    const code = String(planCode || "").trim().toUpperCase();
    if (!code) throw new BadRequestException("Invalid plan");

    const plan = await this.prisma.listingPlan.findFirst({
      where: { code, isActive: true },
    });
    if (!plan) throw new NotFoundException("Plan not found");

    const amount = Number(plan.price);
    if (!Number.isFinite(amount) || amount < 0) {
      throw new BadRequestException("Invalid plan price");
    }

    // ✅ PaymentType enum in your schema:
    // FEATURE_CAR | DEALER_SUBSCRIPTION | BUMP
    const planCodeUpper = String(plan.code || "").toUpperCase();
    const type =
      planCodeUpper.startsWith("FEATURED_")
        ? "FEATURE_CAR"
        : planCodeUpper.startsWith("DEALER_")
        ? "DEALER_SUBSCRIPTION"
        : "DEALER_SUBSCRIPTION";

    const payment = await this.prisma.payment.create({
      data: {
        userId,
        planId: plan.id, // ok (your Payment.planId is optional, but we set it)
        type: type as any, // Prisma enum value

        provider: "MANUAL", // later Wave
        amount,
        currency: plan.currency || "XOF",
        status: "PENDING",
        reference: makeReference(),
        meta: { planCode: plan.code },
      },
      include: { plan: true },
    });

    return payment;
  }

  // ✅ ADMIN: mark payment as PAID (manual verification)
  async adminMarkPaid(paymentId: string, userOrId: any) {
    const role = extractUserRole(userOrId);
    if (role !== "ADMIN") throw new ForbiddenException("Admin only");

    if (!paymentId || !isObjectIdString(paymentId)) {
      throw new BadRequestException("Invalid payment id");
    }

    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
    });
    if (!payment) throw new NotFoundException("Payment not found");

    if (payment.status === "PAID") return payment;

    return this.prisma.payment.update({
      where: { id: paymentId },
      data: { status: "PAID", paidAt: new Date() },
    });
  }
}