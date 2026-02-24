// ✅ FILE: src/payments/payments.module.ts
// New module for payments

import { Module } from "@nestjs/common";
import { PaymentsController } from "./payments.controller";
import { PaymentsService } from "./payments.service";
import { PrismaModule } from "../prisma/prisma.module";

@Module({
  imports: [PrismaModule],
  controllers: [PaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService], // ✅ optional but useful if other modules need it later
})
export class PaymentsModule {}