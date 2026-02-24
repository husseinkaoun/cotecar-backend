import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import * as bcrypt from "bcrypt";

/* ---------- helpers ---------- */

function normalizePhone(phone: string) {
  return String(phone).trim().replace(/[^\d+]/g, "");
}

function normalizeEmail(email: string) {
  return String(email).trim().toLowerCase();
}

function isEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

function isPhone(v: string) {
  const p = normalizePhone(v);
  return p.length >= 8;
}

function now() {
  return new Date();
}

/* ---------- service ---------- */

@Injectable()
export class OtpService {
  constructor(private prisma: PrismaService) {}

  // 🔐 Security settings
  private OTP_TTL_MINUTES = 5;
  private MAX_SENDS_IN_WINDOW = 3;
  private SEND_WINDOW_MINUTES = 15;
  private MAX_FAILS = 5;
  private LOCK_MINUTES = 15;

  private generateCode() {
    const n = Math.floor(Math.random() * 1_000_000);
    return String(n).padStart(6, "0");
  }

  /* ---------- rate limit ---------- */

  private async assertCanSend(userId: string) {
    const u = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!u) throw new ForbiddenException("Invalid user");

    // locked?
    if (u.otpLockedUntil && new Date(u.otpLockedUntil) > now()) {
      throw new ForbiddenException("Too many attempts. Try later.");
    }

    if (!u.otpLastSentAt) return u;

    const diffMin =
      (now().getTime() - new Date(u.otpLastSentAt).getTime()) / 60000;

    // reset window
    if (diffMin > this.SEND_WINDOW_MINUTES) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { otpSendCount: 0 },
      });
      return this.prisma.user.findUnique({ where: { id: userId } });
    }

    if ((u.otpSendCount || 0) >= this.MAX_SENDS_IN_WINDOW) {
      throw new ForbiddenException("Too many codes sent. Try later.");
    }

    return u;
  }

  /* ---------- SEND ---------- */

  async sendOtp(
    userId: string,
    channel: "SMS" | "EMAIL",
    targetRaw: string
  ) {
    const u = await this.assertCanSend(userId);

    let target = targetRaw;
    let purpose: "PHONE_VERIFY" | "EMAIL_VERIFY";

    if (channel === "SMS") {
      if (!isPhone(targetRaw))
        throw new BadRequestException("Invalid phone number");
      target = normalizePhone(targetRaw);
      purpose = "PHONE_VERIFY";
    } else {
      if (!isEmail(targetRaw))
        throw new BadRequestException("Invalid email");
      target = normalizeEmail(targetRaw);
      purpose = "EMAIL_VERIFY";
    }

    const code = this.generateCode();
    const otpHash = await bcrypt.hash(code, 10);
    const expiresAt = new Date(
      now().getTime() + this.OTP_TTL_MINUTES * 60 * 1000
    );

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        otpHash,
        otpTarget: target,
        otpChannel: channel,
        otpPurpose: purpose,
        otpExpiresAt: expiresAt,
        otpFailCount: 0,
        otpLastSentAt: now(),
        otpSendCount: (u?.otpSendCount || 0) + 1,
      },
    });

    // 🔔 TEMP: replace later with Twilio / SendGrid
    if (channel === "SMS") {
      console.log("📲 SMS OTP:", target, code);
    } else {
      console.log("📧 EMAIL OTP:", target, code);
    }

    return { success: true, message: "Code sent" };
  }

  /* ---------- VERIFY ---------- */

  async verifyOtp(
    userId: string,
    channel: "SMS" | "EMAIL",
    targetRaw: string,
    code: string
  ) {
    const u = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!u) throw new ForbiddenException("Invalid user");

    if (u.otpLockedUntil && new Date(u.otpLockedUntil) > now()) {
      throw new ForbiddenException("Too many attempts. Try later.");
    }

    if (!u.otpHash || !u.otpExpiresAt || !u.otpTarget || !u.otpChannel) {
      throw new BadRequestException("No active code");
    }

    if (u.otpChannel !== channel) {
      throw new BadRequestException("Invalid code");
    }

    const target =
      channel === "SMS"
        ? normalizePhone(targetRaw)
        : normalizeEmail(targetRaw);

    if (u.otpTarget !== target) {
      throw new BadRequestException("Invalid code");
    }

    if (new Date(u.otpExpiresAt) < now()) {
      throw new BadRequestException("Code expired");
    }

    const ok = await bcrypt.compare(code, u.otpHash);
    if (!ok) {
      const fails = (u.otpFailCount || 0) + 1;

      if (fails >= this.MAX_FAILS) {
        await this.prisma.user.update({
          where: { id: userId },
          data: {
            otpFailCount: fails,
            otpLockedUntil: new Date(
              now().getTime() + this.LOCK_MINUTES * 60 * 1000
            ),
          },
        });
        throw new ForbiddenException("Too many attempts. Try later.");
      }

      await this.prisma.user.update({
        where: { id: userId },
        data: { otpFailCount: fails },
      });

      throw new BadRequestException("Invalid code");
    }

    // ✅ verified
    const data: any = {
      verifiedAt: now(),
      otpHash: null,
      otpTarget: null,
      otpChannel: null,
      otpPurpose: null,
      otpExpiresAt: null,
      otpFailCount: 0,
      otpLockedUntil: null,
    };

    if (channel === "SMS") data.phoneVerified = true;
    else data.emailVerified = true;

    await this.prisma.user.update({ where: { id: userId }, data });

    return { success: true, message: "Verified" };
  }
}
