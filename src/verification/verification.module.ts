import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { VerificationController } from "./verification.controller";
import { VerificationService } from "./verification.service";
import { AdminGuard } from "../auth/admin.guard";

@Module({
  imports: [PrismaModule],
  controllers: [VerificationController],
  providers: [VerificationService, AdminGuard],
})
export class VerificationModule {}
