import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  private safeUserSelect = {
    id: true,
    email: true,
    role: true,
    fullName: true,
    phone: true,
    whatsapp: true,
    city: true,
    sellerType: true,
    address: true,
    lat: true,
    lng: true,
    createdAt: true,
    updatedAt: true,
    verification: true,
  } as const;

  private getIds(user: any) {
    const id = user?.userId || user?.id || user?.sub || null;
    const email = user?.email || null;
    return { id, email };
  }

  async getMe(user: any) {
    const { id, email } = this.getIds(user);

    if (id) {
      return this.prisma.user.findUnique({
        where: { id },
        select: this.safeUserSelect,
      });
    }

    if (email) {
      return this.prisma.user.findUnique({
        where: { email },
        select: this.safeUserSelect,
      });
    }

    // ✅ don't let prisma crash the server
    throw new UnauthorizedException("Invalid token payload (missing id/email)");
  }

  async updateMe(user: any, body: any) {
    const { id, email } = this.getIds(user);

    const toNumberOrUndefined = (v: any) => {
      if (typeof v === "number") return Number.isFinite(v) ? v : undefined;
      if (typeof v === "string" && v.trim() !== "") {
        const n = Number(v);
        return Number.isFinite(n) ? n : undefined;
      }
      return undefined;
    };

    const data = {
      fullName:
        typeof body.fullName === "string" ? body.fullName.trim() : undefined,
      phone: typeof body.phone === "string" ? body.phone.trim() : undefined,
      whatsapp:
        typeof body.whatsapp === "string" ? body.whatsapp.trim() : undefined,
      city: typeof body.city === "string" ? body.city.trim() : undefined,
      sellerType:
        body.sellerType === "DEALER" || body.sellerType === "PRIVATE"
          ? body.sellerType
          : undefined,
      address:
        typeof body.address === "string" ? body.address.trim() : undefined,
      lat: toNumberOrUndefined(body.lat),
      lng: toNumberOrUndefined(body.lng),
    };

    if (id) {
      return this.prisma.user.update({
        where: { id },
        data,
        select: this.safeUserSelect,
      });
    }

    if (email) {
      return this.prisma.user.update({
        where: { email },
        data,
        select: this.safeUserSelect,
      });
    }

    throw new UnauthorizedException("Invalid token payload (missing id/email)");
  }
}
