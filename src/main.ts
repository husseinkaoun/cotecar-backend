// ✅ FILE: src/main.ts
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { ValidationPipe } from "@nestjs/common";
import * as express from "express";
import type { Request, Response } from "express"; // ✅ ADD THIS
import * as path from "path";
import * as fs from "fs";
import { ENV } from "./config/env";

const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

async function bootstrap() {
  const app = await NestFactory.create(AppModule);


  console.log("NEST DATABASE_URL =", process.env.DATABASE_URL);



  // ✅ Render / proxy support (needed for secure cookies + correct IP)
  (app as any).set("trust proxy", 1);

  // ✅ Global DTO validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    })
  );

  // ✅ Security headers






app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);








  // ✅ Global rate limiting
  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 300,
      standardHeaders: true,
      legacyHeaders: false,
    })
  );

  // ✅ Body size limits
  app.use(express.json({ limit: "100mb" }));
  app.use(express.urlencoded({ limit: "100mb", extended: true }));
  app.use(express.raw({ limit: "100mb" }));

  // ✅ Secure CORS configuration (production-safe)
  app.enableCors({
    origin: ENV.FRONTEND_URL,
    credentials: true,
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  });

  const UPLOADS_DIR = path.join(process.cwd(), "uploads");

  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }

  if (!fs.existsSync(path.join(UPLOADS_DIR, "verification"))) {
    fs.mkdirSync(path.join(UPLOADS_DIR, "verification"), { recursive: true });
  }

  console.log("CWD:", process.cwd());
  console.log("UPLOADS_DIR:", UPLOADS_DIR);

  // ✅ IMPORTANT ORDER:
  // 1) Block verification images publicly
  app.use("/uploads/verification", (_req: Request, res: Response) =>
    res.status(403).send("Forbidden")
  );

  // 2) Allow other uploads publicly (car images, etc.)
  app.use("/uploads", express.static(UPLOADS_DIR));

  await app.listen(ENV.PORT);

  console.log(`\n✅ Backend running on http://localhost:${ENV.PORT}`);
  console.log(`🔐 Helmet + Rate Limit enabled`);
  console.log(`📏 Global body limit set to 100mb\n`);
}

bootstrap();
