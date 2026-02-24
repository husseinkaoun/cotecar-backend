import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";

type AuthPayload = { id: string; role: string };

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";

    if (!token) return res.status(401).json({ message: "Not authenticated" });

    const payload = jwt.verify(token, process.env.JWT_SECRET as string) as AuthPayload;
    (req as any).user = payload;

    next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}
