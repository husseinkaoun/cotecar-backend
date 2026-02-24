import { PrismaClient } from "@prisma/client";
import { CATALOG_DATA } from "../src/catalog/catalog.data";

const prisma = new PrismaClient();

function clean(s: any) {
  return String(s || "").trim();
}

async function main() {
  let upserts = 0;

  for (const item of CATALOG_DATA || []) {
    const make = clean(item?.brand);
    if (!make) continue;

    const models = Array.from(
      new Set((item?.models || []).map((m: any) => clean(m)).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b));

    await prisma.catalogMake.upsert({
      where: { make },
      update: { models },
      create: { make, models },
    });

    upserts++;
  }

  const total = await prisma.catalogMake.count();
  console.log("✅ Seed done");
  console.log("Upserts:", upserts);
  console.log("Total makes in DB:", total);
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
