import { Body, Controller, Post, Req, UseGuards } from "@nestjs/common";
import { OtpService } from "./otp.service";
import { SendOtpDto } from "./dto/send-otp.dto";
import { VerifyOtpDto } from "./dto/verify-otp.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

@Controller("otp")
export class OtpController {
  constructor(private otp: OtpService) {}

  // ✅ POST /otp/send
  @UseGuards(JwtAuthGuard)
  @Post("send")
  async send(@Req() req: any, @Body() dto: SendOtpDto) {
    const userId = req.user?.sub || req.user?.id || req.user?.userId;
    return this.otp.sendOtp(userId, dto.channel, dto.target);
  }

  // ✅ POST /otp/verify
  @UseGuards(JwtAuthGuard)
  @Post("verify")
  async verify(@Req() req: any, @Body() dto: VerifyOtpDto) {
    const userId = req.user?.sub || req.user?.id || req.user?.userId;
    return this.otp.verifyOtp(userId, dto.channel, dto.target, dto.code);
  }
}
