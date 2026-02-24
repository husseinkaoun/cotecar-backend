import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = "husseinkaoun@icloud.com";
  const newPassword = "123456";

  const hash = await bcrypt.hash(newPassword, 10);

  const user = await prisma.user.update({
    where: { email },
    data: { password: hash },
    select: { id: true, email: true },
  });

  console.log("✅ Password reset successful");
  console.log("👉 Email:", user.email);
  console.log("👉 TEMP PASSWORD:", newPassword);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
