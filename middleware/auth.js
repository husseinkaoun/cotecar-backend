import jwt from "jsonwebtoken";
import prisma from "../db.js";

export default async function protect(req, res, next) {
  try {
    const auth = req.headers.authorization;

    if (!auth || !auth.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Not authorized" });
    }

    const token = auth.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // ⚠️ IMPORTANT: your token MUST contain user id
    const user = await prisma.user.findUnique({
      where: { id: decoded.id }, // if this fails, see step 3
    });

    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    req.user = user;
    req.userId = user.id; // ✅ THIS IS WHAT verification.js NEEDS

    next();
  } catch (err) {
    console.error("Auth error:", err);
    res.status(401).json({ message: "Invalid token" });
  }
}
