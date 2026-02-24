// ✅ FILE: src/config/env.ts
function must(name: string) {
  const v = process.env[name];
  if (!v || String(v).trim() === "") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return String(v).trim();
}

function mustMinLen(name: string, minLen: number) {
  const v = must(name);
  if (v.length < minLen) {
    throw new Error(`${name} is too short. Must be at least ${minLen} characters.`);
  }
  return v;
}

export const ENV = {
  NODE_ENV: process.env.NODE_ENV || "development",
  PORT: Number(process.env.PORT || 3000),

  // ✅ critical
  JWT_SECRET: mustMinLen("JWT_SECRET", 32), // 32+ chars minimum
  DATABASE_URL: must("DATABASE_URL"),

  // ✅ CORS / frontend
  FRONTEND_URL: must("FRONTEND_URL"),

  // optional integrations (only required if you use them)
  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME || "",
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY || "",
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET || "",

  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || "",
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || "",
  GOOGLE_CALLBACK_URL: process.env.GOOGLE_CALLBACK_URL || "",

  // AI Verification
  AI_ENABLED: (process.env.AI_ENABLED || "false").toLowerCase() === "true",
  AI_URL: process.env.AI_URL || "",
  AI_MIN_CONF: Number(process.env.AI_MIN_CONF || 0.6),
  AI_ADMIN_BYPASS: (process.env.AI_ADMIN_BYPASS || "false").toLowerCase() === "true",
  AI_FAIL_OPEN: (process.env.AI_FAIL_OPEN || "false").toLowerCase() === "true",
};
