// src/auth/auth.controller.ts
import { Body, Controller, Get, Post, Req, Res, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { AuthService } from "./auth.service";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { PrismaService } from "../prisma/prisma.service";

import { RegisterDto } from "./dto/register.dto";
import { LoginDto } from "./dto/login.dto";

@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly prisma: PrismaService
  ) {}

  /* ─────────────────────────────────────────
     Email / Password Auth
  ────────────────────────────────────────── */

  @Post("register")
  async register(@Body() body: RegisterDto) {
    return this.authService.register(
      String(body.email || "").trim(),
      String(body.password || ""),
      String(body.fullName || "").trim(),
      String(body.phone || "").trim()
    );
  }

  @Post("login")
  async login(@Body() body: LoginDto) {
    return this.authService.login(
      String(body.email || "").trim(),
      String(body.password || "")
    );
  }

  /* ─────────────────────────────────────────
     Phone OTP Verification (JWT)
  ────────────────────────────────────────── */

  @UseGuards(JwtAuthGuard)
  @Post("phone/send")
  async sendPhoneOtp(@Req() req: any) {
    return this.authService.sendPhoneOtp(req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Post("phone/confirm")
  async confirmPhoneOtp(@Req() req: any, @Body() body: { code?: string }) {
    const code = body?.code;
    return this.authService.confirmPhoneOtp(req.user, String(code || ""));
  }

  /* ─────────────────────────────────────────
     Google OAuth
  ────────────────────────────────────────── */

  @Get("google")
  @UseGuards(AuthGuard("google"))
  async googleAuth() {
    // Passport handles redirect
  }

  @Get("google/callback")
  @UseGuards(AuthGuard("google"))
  async googleCallback(@Req() req: any, @Res({ passthrough: true }) res: any) {
    const { token } = await this.authService.googleLogin(req.user);

    const front = process.env.FRONTEND_URL || "http://localhost:5173";
    const safeFront = String(front).replace(/\/$/, "");

    return res.redirect(`${safeFront}/oauth-success?token=${encodeURIComponent(token)}`);
  }

  /* ─────────────────────────────────────────
     Current User (JWT)
  ────────────────────────────────────────── */

  @UseGuards(JwtAuthGuard)
  @Get("me")
  async me(@Req() req: any) {
    const email = req?.user?.email || null;

    if (email) {
      const dbUser = await this.prisma.user.findUnique({
        where: { email },
        select: {
          id: true,
          email: true,
          role: true,
          fullName: true,
          phone: true,
          whatsapp: true,
          city: true,
          sellerType: true,
          phoneVerified: true,
          emailVerified: true,
          verifiedAt: true,
        },
      });

      if (dbUser) return dbUser;
    }

    return {
      id: req?.user?.sub,
      email,
      role: req?.user?.role || "USER",
      fullName: req?.user?.fullName || null,
      phone: req?.user?.phone || null,
    };
  }
}
