import { Router } from "express";
import * as bcrypt from "bcryptjs";
import { PrismaService } from "../prisma";
import { JwtService } from "@nestjs/jwt";

export function authRoutes(prisma: PrismaService, jwt: JwtService) {
  const router = Router();

  // ✅ REGISTER
  router.post("/register", async (req, res) => {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ message: "email, password required" });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(400).json({ message: "Email already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // ✅ Prisma fields: email + password + role
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword, // store HASH in password
        role: "user",
      },
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const accessToken = jwt.sign({
      sub: user.id,
      email: user.email,
      role: user.role,
    });

    return res.json({ user, accessToken });
  });

  // ✅ LOGIN
  router.post("/login", async (req, res) => {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ message: "email, password required" });
    }

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // ✅ compare with user.password (hashed)
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const safeUser = {
      id: user.id,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };

    const accessToken = jwt.sign({
      sub: user.id,
      email: user.email,
      role: user.role,
    });

    return res.json({ user: safeUser, accessToken });
  });

  return router;
}
