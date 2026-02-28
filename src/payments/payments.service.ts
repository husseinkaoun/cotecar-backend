// ✅ FILE: src/payments/payments.service.ts
// Service: list plans + create payment (Stripe Checkout) + admin mark paid (manual) + webhook mark paid + auto-feature car

import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import Stripe from "stripe";

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
  private stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
    apiVersion: "2026-01-28.clover",
  });

  constructor(private prisma: PrismaService) {}

  // ✅ PUBLIC: return active plans
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

  // ✅ USER: Create payment for plan
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

    const planCodeUpper = String(plan.code || "").toUpperCase();
    const type =
      planCodeUpper.startsWith("FEATURED_")
        ? "FEATURE_CAR"
        : planCodeUpper.startsWith("DEALER_")
        ? "DEALER_SUBSCRIPTION"
        : "PLAN";

    const payment = await this.prisma.payment.create({
      data: {
        userId,
        planId: plan.id,
        type: type as any,
        provider: "STRIPE",
        amount,
        currency: plan.currency || "XOF",
        status: "PENDING",
        reference: makeReference(),
        meta: { planCode: plan.code },
      },
      include: { plan: true },
    });

    const frontend = process.env.FRONTEND_URL || "http://localhost:5173";
    const currency = String(plan.currency || "XOF").toUpperCase();
    const zeroDecimal = ["XOF", "JPY", "KRW"].includes(currency);

    const session = await this.stripe.checkout.sessions.create({
      mode: "payment",
      client_reference_id: payment.id,
      success_url: `${frontend}/payment-success?pid=${payment.id}`,
      cancel_url: `${frontend}/payment-cancel?pid=${payment.id}`,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: currency.toLowerCase(),
            unit_amount: zeroDecimal ? Math.round(amount) : Math.round(amount * 100),
            product_data: { name: plan.name },
          },
        },
      ],
    });

    return { payment, checkoutUrl: session.url };
  }

  // 🔥 Create FEATURE payment for specific car
  async createFeaturePaymentForCar(carId: string, planCode: string, userOrId: any) {
    const userId = extractUserId(userOrId);
    if (!userId || !isObjectIdString(userId)) throw new ForbiddenException("Invalid user");
    if (!carId || !isObjectIdString(carId)) throw new BadRequestException("Invalid car id");

    const code = String(planCode || "").trim().toUpperCase();
    if (!code.startsWith("FEATURED_")) throw new BadRequestException("Use FEATURED_* plan");

    const car = await this.prisma.car.findUnique({ where: { id: carId } });
    if (!car) throw new NotFoundException("Car not found");

    if (String(car.ownerId) !== String(userId)) {
      const role = extractUserRole(userOrId);
      if (role !== "ADMIN") throw new ForbiddenException("Not your car");
    }

    const plan = await this.prisma.listingPlan.findFirst({
      where: { code, isActive: true },
    });
    if (!plan) throw new NotFoundException("Plan not found");

    const amount = Number(plan.price);
    if (!Number.isFinite(amount) || amount < 0) {
      throw new BadRequestException("Invalid plan price");
    }

    const payment = await this.prisma.payment.create({
      data: {
        userId,
        planId: plan.id,
        carId,
        type: "FEATURE_CAR" as any,
        provider: "STRIPE",
        amount,
        currency: plan.currency || "XOF",
        status: "PENDING",
        reference: makeReference(),
        meta: { planCode: plan.code, carId },
      },
      include: { plan: true },
    });

    const frontend = process.env.FRONTEND_URL || "http://localhost:5173";
    const currency = String(plan.currency || "XOF").toUpperCase();
    const zeroDecimal = ["XOF", "JPY", "KRW"].includes(currency);

    const session = await this.stripe.checkout.sessions.create({
      mode: "payment",
      client_reference_id: payment.id,
      success_url: `${frontend}/?payment=success&pid=${payment.id}&carId=${carId}`,
      cancel_url: `${frontend}/?payment=cancel&pid=${payment.id}&carId=${carId}`,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: currency.toLowerCase(),
            unit_amount: zeroDecimal ? Math.round(amount) : Math.round(amount * 100),
            product_data: { name: plan.name },
          },
        },
      ],
    });

    return { payment, checkoutUrl: session.url };
  }

  // ✅ ADMIN: manual mark paid
  async adminMarkPaid(paymentId: string, userOrId: any) {
    const role = extractUserRole(userOrId);
    if (role !== "ADMIN") throw new ForbiddenException("Admin only");

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

  // ✅ STRIPE WEBHOOK: mark paid + auto-feature
  async markPaidFromStripe(paymentId: string, stripeMeta: any) {
    if (!paymentId || !isObjectIdString(paymentId)) return;

    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { plan: true },
    });
    if (!payment) return;

    if (payment.status === "PAID") return payment;

    const updated = await this.prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: "PAID",
        paidAt: new Date(),
        meta: { ...(payment.meta as any), ...stripeMeta },
      },
    });

    // 🔥 Auto-feature if FEATURE_CAR
    // ✅ IMPORTANT: only update fields that exist in Car model (isFeatured, featuredUntil)
    if (payment.type === "FEATURE_CAR" && payment.carId) {
      const daysRaw = Number(payment.plan?.featuredDays ?? 7);
      const safeDays = Number.isFinite(daysRaw)
        ? Math.min(90, Math.max(1, Math.floor(daysRaw)))
        : 7;

      const featuredUntil = new Date(Date.now() + safeDays * 24 * 60 * 60 * 1000);

      await this.prisma.car.update({
        where: { id: payment.carId },
        data: {
          isFeatured: true,
          featuredUntil,
        },
      });
    }

    return updated;
  }
}
