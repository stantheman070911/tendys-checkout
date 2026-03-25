import { prisma } from "../lib/db/prisma";

const SEED_ROUND_NAME = "3月生鮮團購";
const SEED_SUPPLIER_NAMES = ["小農地瓜園", "健康養雞場"];
const SEED_USER_NICKNAMES = ["Test User 1", "Test User 2", "Test User 3"];

async function main() {
  // Clean up previous seed data (named fixtures only)
  await prisma.orderItem.deleteMany({
    where: { order: { round: { name: SEED_ROUND_NAME } } },
  });
  await prisma.notificationLog.deleteMany({
    where: { round: { name: SEED_ROUND_NAME } },
  });
  await prisma.order.deleteMany({
    where: { round: { name: SEED_ROUND_NAME } },
  });
  await prisma.product.deleteMany({
    where: { round: { name: SEED_ROUND_NAME } },
  });
  await prisma.round.deleteMany({ where: { name: SEED_ROUND_NAME } });
  await prisma.supplier.deleteMany({
    where: { name: { in: SEED_SUPPLIER_NAMES } },
  });
  await prisma.user.deleteMany({
    where: { nickname: { in: SEED_USER_NICKNAMES } },
  });
  await prisma.savedCheckoutProfile.deleteMany({
    where: { nickname: { in: SEED_USER_NICKNAMES } },
  });

  // 1. Round with shipping fee
  // Close any pre-existing open rounds to satisfy single-open-round constraint
  await prisma.round.updateMany({
    where: { is_open: true },
    data: { is_open: false },
  });

  const round = await prisma.round.create({
    data: {
      name: SEED_ROUND_NAME,
      is_open: true,
      shipping_fee: 60,
      pickup_option_a: "台北車站面交",
      pickup_option_b: "板橋車站面交",
      deadline: new Date("2026-04-01T23:59:59+08:00"),
    },
  });

  // 2. Suppliers
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

  // 3. Products (5 total, linked to suppliers)
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
        goal_qty: null,
      },
    ],
  });

  // 4. Test users (3 stable users for smoke testing)
  await prisma.user.createMany({
    data: [
      {
        nickname: "Test User 1",
        purchaser_name: "王小明",
        recipient_name: "王小明",
        phone: "0900-000-001",
        address: "台北市信義區測試路 1 號",
        email: "test1@example.com",
      },
      {
        nickname: "Test User 2",
        purchaser_name: "林美玲",
        recipient_name: "林美玲",
        phone: "0900-000-002",
        address: "台中市西屯區測試路 2 號",
      },
      {
        nickname: "Test User 3",
        purchaser_name: "陳大華",
        recipient_name: "陳大華",
        phone: "0900-000-003",
        address: "高雄市前鎮區測試路 3 號",
        email: "test3@example.com",
      },
    ],
  });

  await prisma.savedCheckoutProfile.createMany({
    data: [
      {
        nickname: "Test User 1",
        purchaser_name: "王小明",
        recipient_name: "王小明",
        phone: "0900-000-001",
        address: "台北市信義區測試路 1 號",
        email: "test1@example.com",
      },
      {
        nickname: "Test User 2",
        purchaser_name: "林美玲",
        recipient_name: "林美玲",
        phone: "0900-000-002",
        address: "台中市西屯區測試路 2 號",
      },
      {
        nickname: "Test User 3",
        purchaser_name: "陳大華",
        recipient_name: "陳大華",
        phone: "0900-000-003",
        address: "高雄市前鎮區測試路 3 號",
        email: "test3@example.com",
      },
    ],
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
