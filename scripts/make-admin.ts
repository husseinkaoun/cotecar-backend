import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const email = "husseinkaoun@icloud.com";

  const user = await prisma.user.update({
    where: { email },
    data: { role: "ADMIN" },
  });

  console.log("✅ User promoted to ADMIN:", user.email);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
