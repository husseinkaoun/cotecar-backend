// ✅ FILE: src/auth/auth.service.ts
import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcryptjs";
import { PrismaService } from "../prisma/prisma.service";

function extractUserId(user: any): string | null {
  return user?.sub || user?.id || user?.userId || null;
}

function now() {
  return new Date();
}

function addMinutes(d: Date, minutes: number) {
  return new Date(d.getTime() + minutes * 60 * 1000);
}

function isLockedUntil(date: any) {
  if (!date) return false;
  const d = new Date(date);
  return d.getTime() > Date.now();
}

function genOtp6() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService, private jwt: JwtService) {}

  /* ─────────────────────────────────────────
     EMAIL + PASSWORD AUTH
  ────────────────────────────────────────── */

  // ✅ Updated: accept fullName + phone, and save them on register
  async register(
    email: string,
    password: string,
    fullName?: string,
    phone?: string
  ) {
    if (!email || !password) {
      throw new BadRequestException("email and password required");
    }

    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new BadRequestException("Email already exists");
    }

    const hash = await bcrypt.hash(password, 10);

    const safeFullName = String(fullName || "").trim();
    const safePhone = String(phone || "").trim();

    const user = await this.prisma.user.create({
      data: {
        email,
        password: hash,
        role: "USER",
        fullName: safeFullName || null,
        phone: safePhone || null,
      },
      select: {
        id: true,
        email: true,
        role: true,
        fullName: true,
        phone: true,
      },
    });

    const token = this.jwt.sign({
      sub: user.id,
      email: user.email,
      role: user.role,
    });

    return { user, token };
  }

  async login(email: string, password: string) {
    if (!email || !password) {
      throw new BadRequestException("email and password required");
    }

    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const ok = await bcrypt.compare(password, user.password || "");
    if (!ok) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const token = this.jwt.sign({
      sub: user.id,
      email: user.email,
      role: user.role,
    });

    // ✅ return saved info too
    return {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        fullName: user.fullName || "",
        phone: user.phone || "",
      },
      token,
    };
  }

  /* ─────────────────────────────────────────
     GOOGLE OAUTH AUTH
  ────────────────────────────────────────── */

  async googleLogin(googleUser: { email: string; fullName?: string }) {
    if (!googleUser?.email) {
      throw new UnauthorizedException("Google login failed");
    }

    let user = await this.prisma.user.findUnique({
      where: { email: googleUser.email },
    });

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email: googleUser.email,
          fullName: String(googleUser.fullName || "").trim() || null,
          password: "",
          role: "USER",
        },
      });
    }

    const token = this.jwt.sign({
      sub: user.id,
      email: user.email,
      role: user.role,
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        fullName: user.fullName || "",
        phone: user.phone || "",
      },
      token,
    };
  }

  /* ─────────────────────────────────────────
     PHONE OTP (JWT REQUIRED)
  ────────────────────────────────────────── */

  async sendPhoneOtp(jwtUser: any) {
    const userId = extractUserId(jwtUser);
    if (!userId) throw new UnauthorizedException("Missing user");

    const u = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        phone: true,
        phoneVerified: true,
        otpLockedUntil: true,
        otpLastSentAt: true,
        otpSendCount: true,
      },
    });

    if (!u) throw new UnauthorizedException("User not found");
    if (!u.phone) throw new BadRequestException("Please save your phone first");
    if (u.phoneVerified) return { ok: true, status: "ALREADY_VERIFIED" };

    if (isLockedUntil(u.otpLockedUntil)) {
      throw new ForbiddenException("OTP locked. Try later.");
    }

    // 60s cooldown
    if (u.otpLastSentAt) {
      const last = new Date(u.otpLastSentAt).getTime();
      if (Date.now() - last < 60_000) {
        throw new BadRequestException(
          "Please wait before requesting another code"
        );
      }
    }

    // anti-abuse: if sent >= 5, lock for 15 min
    if ((u.otpSendCount || 0) >= 5) {
      const lockUntil = addMinutes(now(), 15);
      await this.prisma.user.update({
        where: { id: u.id },
        data: { otpLockedUntil: lockUntil },
      });
      throw new ForbiddenException("Too many requests. Locked 15 minutes.");
    }

    const code = genOtp6();
    const hash = await bcrypt.hash(code, 10);

    await this.prisma.user.update({
      where: { id: u.id },
      data: {
        otpHash: hash,
        otpTarget: u.phone,
        otpChannel: "SMS",
        otpPurpose: "PHONE_VERIFY",
        otpExpiresAt: addMinutes(now(), 10),
        otpSendCount: (u.otpSendCount || 0) + 1,
        otpLastSentAt: now(),
        otpFailCount: 0,
        otpLockedUntil: null,
      },
    });

    // DEV MODE: return code (for testing)
    const isProd =
      String(process.env.NODE_ENV || "").toLowerCase() === "production";
    return isProd ? { ok: true } : { ok: true, devCode: code };
  }

  async confirmPhoneOtp(jwtUser: any, code: string) {
    const userId = extractUserId(jwtUser);
    if (!userId) throw new UnauthorizedException("Missing user");
    if (!code) throw new BadRequestException("code required");

    const u = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        phone: true,
        phoneVerified: true,
        otpHash: true,
        otpTarget: true,
        otpPurpose: true,
        otpExpiresAt: true,
        otpFailCount: true,
        otpLockedUntil: true,
      },
    });

    if (!u) throw new UnauthorizedException("User not found");
    if (u.phoneVerified) return { ok: true, status: "ALREADY_VERIFIED" };

    if (isLockedUntil(u.otpLockedUntil)) {
      throw new ForbiddenException("OTP locked. Try later.");
    }

    if (!u.phone || !u.otpHash || !u.otpExpiresAt) {
      throw new BadRequestException("No OTP pending");
    }

    if (u.otpPurpose !== "PHONE_VERIFY") {
      throw new BadRequestException("Invalid OTP purpose");
    }

    if (new Date(u.otpExpiresAt).getTime() < Date.now()) {
      throw new BadRequestException("OTP expired");
    }

    const ok = await bcrypt.compare(String(code).trim(), u.otpHash);
    if (!ok) {
      const fails = (u.otpFailCount || 0) + 1;
      const lock = fails >= 5 ? addMinutes(now(), 10) : null;

      await this.prisma.user.update({
        where: { id: u.id },
        data: {
          otpFailCount: fails,
          otpLockedUntil: lock,
        },
      });

      throw new BadRequestException("Invalid code");
    }

    await this.prisma.user.update({
      where: { id: u.id },
      data: {
        phoneVerified: true,
        verifiedAt: now(),

        // clear otp
        otpHash: null,
        otpTarget: null,
        otpChannel: null,
        otpPurpose: null,
        otpExpiresAt: null,
        otpFailCount: 0,
        otpLockedUntil: null,
      },
    });

    return { ok: true, status: "VERIFIED" };
  }
}
