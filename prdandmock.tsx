// ============================================
// Mock Data Reference — for prisma/seed.ts
// ============================================
//
// This file contains mock data shapes used as reference for seeding
// and testing. The full DB schema, system flow, page structure, and
// env vars are documented in claude.md, whatwearebuilding.md, and roadmap.md.
// Do NOT duplicate that information here.

// --- Suppliers ---

const mockSuppliers = [
  { id: "s1", name: "阿土伯有機農場", contact: "陳阿土", phone: "0911-111-111", email: "farmer@org.tw", note: "週二、五送貨" },
  { id: "s2", name: "海鮮王批發", contact: "林海", phone: "0922-222-222", email: "sea@fish.tw", note: "需提前3天下單" },
];

// --- Products (linked to suppliers) ---

const mockProducts = [
  { id: 1, name: "有機地瓜", price: 60, unit: "斤", stock: 50, goal_qty: 30, current_qty: 22, image_url: null, supplier_id: "s1" },
  { id: 2, name: "空心菜", price: 35, unit: "把", stock: 40, goal_qty: 20, current_qty: 20, image_url: null, supplier_id: "s1" },
  { id: 3, name: "放山雞蛋", price: 120, unit: "盒", stock: 20, goal_qty: 15, current_qty: 8, image_url: null, supplier_id: "s1" },
  { id: 4, name: "芭樂", price: 50, unit: "斤", stock: 0, goal_qty: 25, current_qty: 25, image_url: null, supplier_id: "s1" },
  { id: 5, name: "鱸魚片", price: 180, unit: "份", stock: 10, goal_qty: null, current_qty: 3, image_url: null, supplier_id: "s2" },
];

// --- Round ---

const mockRound = {
  id: "r1",
  name: "第 12 團：三月第三週",
  is_open: true,
  deadline: "2026-03-19T20:00:00+08:00",
  shipping_fee: 60,
};

// --- Orders (covers all 4 status variations + shipping/pickup/notification combos) ---

const mockOrders = [
  {
    id: "ORD-20260317-001",
    nickname: "小美",
    name: "王小美",
    phone: "0912-345-678",
    address: "台北市信義區松仁路100號",
    pickup: null,
    email: "mei@gmail.com",
    items: [
      { name: "有機地瓜", qty: 3, price: 60 },
      { name: "放山雞蛋", qty: 2, price: 120 },
    ],
    subtotal: 420,
    shipping_fee: 60,
    total: 480,
    status: "pending_confirm",
    payAmount: 480,
    payLast5: "12345",
    paidAt: "2026-03-17 14:32",
    shippedAt: null,
    notif: [{ type: "payment_confirmed", line: "success", email: "success" }],
  },
  {
    id: "ORD-20260317-002",
    nickname: "阿明",
    name: "李阿明",
    phone: "0923-456-789",
    address: "新北市板橋區中山路50號",
    pickup: null,
    email: "ming@gmail.com",
    items: [
      { name: "鱸魚片", qty: 1, price: 180 },
      { name: "空心菜", qty: 5, price: 35 },
    ],
    subtotal: 355,
    shipping_fee: 60,
    total: 415,
    status: "pending_payment",
    payAmount: null,
    payLast5: null,
    paidAt: null,
    shippedAt: null,
    notif: [],
  },
  {
    id: "ORD-20260316-003",
    nickname: "Jenny",
    name: "陳珍妮",
    phone: "0934-567-890",
    address: "台中市西區民生路20號",
    pickup: "面交點A：中正路全家",
    email: "jenny@gmail.com",
    items: [{ name: "芭樂", qty: 4, price: 50 }],
    subtotal: 200,
    shipping_fee: null,
    total: 200,
    status: "confirmed",
    payAmount: 200,
    payLast5: "67890",
    paidAt: "2026-03-16 10:15",
    shippedAt: null,
    notif: [{ type: "payment_confirmed", line: "success", email: "failed" }],
  },
  {
    id: "ORD-20260315-004",
    nickname: "小美",
    name: "王小美",
    phone: "0912-345-678",
    address: "台北市信義區松仁路100號",
    pickup: null,
    email: "mei@gmail.com",
    items: [{ name: "空心菜", qty: 3, price: 35 }],
    subtotal: 105,
    shipping_fee: 60,
    total: 165,
    status: "shipped",
    payAmount: 165,
    payLast5: "12345",
    paidAt: "2026-03-15 09:20",
    shippedAt: "2026-03-16 16:00",
    notif: [
      { type: "payment_confirmed", line: "success", email: "success" },
      { type: "shipment", line: "success", email: "success" },
    ],
  },
];

// --- UI Reference Maps (used in constants/index.ts) ---

const statusMap = {
  pending_payment: "待付款",
  pending_confirm: "待確認",
  confirmed: "已確認",
  shipped: "已出貨",
  cancelled: "已取消",
};

const statusColor = {
  pending_payment: "bg-yellow-100 text-yellow-800",
  pending_confirm: "bg-blue-100 text-blue-800",
  confirmed: "bg-green-100 text-green-800",
  shipped: "bg-purple-100 text-purple-800",
  cancelled: "bg-red-100 text-red-800",
};

const notifTypeLabel = {
  payment_confirmed: "付款確認",
  shipment: "出貨通知",
  product_arrival: "到貨通知",
};
