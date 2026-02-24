import jwt from "jsonwebtoken";

export function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return res.status(401).json({ message: "Missing token" });

    const payload = jwt.verify(token, process.env.JWT_SECRET);

    // normalize user id key (some code uses userId)
    req.user = {
      id: payload.id || payload.userId || payload.sub,
      email: payload.email,
      role: payload.role || "USER",
    };

    if (!req.user.id) return res.status(401).json({ message: "Invalid token" });

    next();
  } catch {
    return res.status(401).json({ message: "Invalid token" });
  }
}
