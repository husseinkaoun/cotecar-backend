const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function run() {
  const user = await prisma.user.findUnique({
    where: { email: 'husseinkaoun@icloud.com' },
  });

  console.log('DB role =', user?.role, 'id =', user?.id);

  await prisma.$disconnect();
}

run().catch(console.error);
