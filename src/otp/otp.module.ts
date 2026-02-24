import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { OtpController } from "./otp.controller";
import { OtpService } from "./otp.service";

@Module({
  imports: [PrismaModule],
  controllers: [OtpController],
  providers: [OtpService],
})
export class OtpModule {}
