import { prisma } from "../lib/db/prisma";

async function main() {
  console.log("Seeding dev data...");

  // 1. Create a round with shipping fee
  const round = await prisma.round.create({
    data: {
      name: "3月生鮮團購",
      is_open: true,
      shipping_fee: 60,
      deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
    },
  });

  console.log(`Created Round: ${round.name}`);

  // 2. Create suppliers
  const supplier1 = await prisma.supplier.create({
    data: {
      name: "小農地瓜園",
      contact_name: "王老闆",
      phone: "0912-345-678",
      email: "farm1@test.com",
    },
  });

  const supplier2 = await prisma.supplier.create({
    data: {
      name: "健康養雞場",
      contact_name: "林阿姨",
      phone: "0987-654-321",
    },
  });

  console.log("Created Suppliers");

  // 3. Create products
  await prisma.product.createMany({
    data: [
      {
        round_id: round.id,
        supplier_id: supplier1.id,
        name: "台農57號黃金地瓜",
        price: 150,
        unit: "袋 (3kg)",
        stock: 50,
        goal_qty: 20,
        image_url: "https://example.com/sweet-potato.jpg",
      },
      {
        round_id: round.id,
        supplier_id: supplier1.id,
        name: "紫心地瓜",
        price: 180,
        unit: "袋 (3kg)",
        stock: 30,
        goal_qty: 15,
      },
      {
        round_id: round.id,
        supplier_id: supplier2.id,
        name: "放牧土雞蛋",
        price: 250,
        unit: "盒 (20顆)",
        stock: 100,
        goal_qty: 50,
        image_url: "https://example.com/eggs.jpg",
      },
      {
        round_id: round.id,
        supplier_id: supplier2.id,
        name: "去骨雞腿肉",
        price: 320,
        unit: "包 (500g)",
        stock: 40,
        goal_qty: 30,
      },
      {
        round_id: round.id,
        supplier_id: null,
        name: "無毒高山高麗菜",
        price: 120,
        unit: "顆",
        stock: 80,
        goal_qty: null, // Unlimited
      },
    ],
  });

  console.log("Created Products");

  // 4. Create test users
  await prisma.user.createMany({
    data: [
      {
        nickname: "Test User 1",
        recipient_name: "Test Name 1",
        phone: "0900-000-001",
        address: "台北市信義區測試路 1 號",
      },
      {
        nickname: "Test User 2",
        recipient_name: "Test Name 2",
        phone: "0900-000-002",
      },
    ],
  });

  console.log("Created Dev Users");
  console.log("Seeding complete!");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
