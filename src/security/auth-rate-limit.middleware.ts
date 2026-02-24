import { Injectable, NestMiddleware } from "@nestjs/common";
import { Request, Response, NextFunction } from "express";

const rateLimit = require("express-rate-limit");

// ✅ 5 attempts per 15 minutes per IP (login/register)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Too many attempts. Please wait 15 minutes and try again.",
  },
});

@Injectable()
export class AuthRateLimitMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    return authLimiter(req, res, next);
  }
}
