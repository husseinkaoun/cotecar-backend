// src/auth/admin.guard.ts
import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();

    // Fast path: role already present
    if (req.user?.role === "ADMIN") return true;

    // Fallback: check DB role by email
    const email = req.user?.email;
    if (!email) return false;

    const u = await this.prisma.user.findUnique({
      where: { email },
      select: { role: true },
    });

    return u?.role === "ADMIN";
  }
}
