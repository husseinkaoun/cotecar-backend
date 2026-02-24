// ✅ FILE: src/auth/otp.service.ts
import { Injectable, BadRequestException } from "@nestjs/common";
import * as crypto from "crypto";

@Injectable()
export class OtpService {
  // 6-digit code
  generateCode(): string {
    return String(Math.floor(100000 + Math.random() * 900000));
  }

  // Hash code (never store raw OTP)
  hash(code: string): string {
    return crypto.createHash("sha256").update(code).digest("hex");
  }

  // Compare
  verify(code: string, hash: string): boolean {
    return this.hash(code) === hash;
  }

  // Expire in minutes
  expiresAt(minutes = 10): Date {
    return new Date(Date.now() + minutes * 60 * 1000);
  }
}
