// ✅ FILE: prisma/seed.js
// Keeps your Make seed + adds ListingPlan seeds (Standard + Featured + Dealer bulk) — Currency: XOF (CFA)

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  // ✅ existing Make seed (keep)
  await prisma.$runCommandRaw({
    insert: "Make",
    documents: [{ name: "Toyota" }, { name: "BMW" }, { name: "Mercedes-Benz" }],
  });

  // ✅ ListingPlan seeds (upsert) — XOF / CFA
  // Rules:
  // - Standard plans: increase how many cars a seller can post (listingLimit)
  // - Featured plans: used per-car (listingLimit = 0) and give featuredDays for that car
  const plans = [
    // ✅ Standard (private / normal sellers)
    {
      code: "FREE",
      name: "Standard",
      currency: "XOF",
      price: 0,
      listingLimit: 3,
      featuredDays: 0,
      isActive: true,
    },

    // ✅ Featured (pay per car to show on first page)
    {
      code: "FEATURED_7D",
      name: "Featured 7 Days",
      currency: "XOF",
      price: 5000,
      listingLimit: 0, // important: featured does not change user limit
      featuredDays: 7,
      isActive: true,
    },
    {
      code: "FEATURED_30D",
      name: "Featured 30 Days",
      currency: "XOF",
      price: 15000,
      listingLimit: 0,
      featuredDays: 30,
      isActive: true,
    },

    // ✅ Dealer bulk (subscription / package)
    {
      code: "DEALER_STARTER",
      name: "Dealer Starter",
      currency: "XOF",
      price: 15000,
      listingLimit: 20,
      featuredDays: 0,
      isActive: true,
    },
    {
      code: "DEALER_PRO",
      name: "Dealer Pro",
      currency: "XOF",
      price: 30000,
      listingLimit: 60,
      featuredDays: 0,
      isActive: true,
    },
    {
      code: "DEALER_ELITE",
      name: "Dealer Elite",
      currency: "XOF",
      price: 50000,
      listingLimit: 200,
      featuredDays: 0,
      isActive: true,
    },
  ];

  for (const p of plans) {
    await prisma.listingPlan.upsert({
      where: { code: p.code },
      update: {
        name: p.name,
        currency: p.currency,
        price: p.price,
        listingLimit: p.listingLimit,
        featuredDays: p.featuredDays,
        isActive: p.isActive,
      },
      create: {
        code: p.code,
        name: p.name,
        currency: p.currency,
        price: p.price,
        listingLimit: p.listingLimit,
        featuredDays: p.featuredDays,
        isActive: p.isActive,
      },
    });
  }

  console.log("✅ seed done");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());