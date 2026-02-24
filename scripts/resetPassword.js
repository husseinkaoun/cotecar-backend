import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = "husseinkaoun@icloud.com";
  const newPassword = process.env.NEW_PASS;

  if (!newPassword) {
    console.log("❌ Missing NEW_PASS environment variable.");
    console.log('✅ Set it in PowerShell like this:  $env:NEW_PASS="YourNewPasswordHere"');
    process.exit(1);
  }

  const hash = await bcrypt.hash(newPassword, 10);

  const user = await prisma.user.update({
    where: { email },
    data: { password: hash },
    select: { id: true, email: true },
  });

  console.log("✅ Password updated for:", user.email);
}

main()
  .catch((e) => {
    console.error("❌ Reset error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
