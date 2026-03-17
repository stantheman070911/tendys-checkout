// ============================================
// 生鮮團購訂購系統 v2 — Full UX Prototype
// ============================================
//
// ## 系統流程
//
// LINE 群組貼文 (產品資訊 + Vercel 連結)
//   → 用戶點連結進入訂購頁
//   → 看到商品列表 + 團購進度條（目標達成率）
//   → 選擇商品、數量（購物車模式，庫存上限檢查）
//   → 輸入暱稱（自動帶入舊資料 or 新填）
//   → 填寫收貨人資訊（姓名、電話、地址/取貨點、Email）
//   → 看到運費（宅配才加，面交免運）
//   → 送出訂單（防重複提交）
//   → 顯示銀行帳號（含運費）+ 訂單摘要 + 分享揪團 CTA
//   → 用戶匯款後回報（金額 + 帳號後五碼）
//   → Admin 後台查帳 → 單筆或批次確認 → 付款確認通知
//   → Admin 供應商管理 → 商品到貨 → 到貨通知
//   → Admin 待出貨 → 確認寄出（單筆/批次）→ 出貨通知
//   → 通知皆發 LINE Notify + Resend Email（記錄至 notification_logs）
//
// ## Tech Stack
//
// | 項目       | 技術                          |
// |------------|-------------------------------|
// | Framework  | Next.js (App Router)       |
// | UI         | Tailwind CSS (簡潔 MVP)       |
// | Database   | Supabase (PostgreSQL)         |
// | Auth       | Supabase Auth (Admin only)    |
// | Hosting    | Vercel                        |
// | Email      | Resend                        |
// | 通知       | LINE Notify Webhook           |
//
// ## 資料庫 Schema (7 models)
//
// rounds:    id(uuid PK), name(text), is_open(bool), deadline(timestamptz|null),
//            shipping_fee(int|null), created_at
//
// suppliers: id(uuid PK), name(text), contact_name(text|null),
//            phone(text|null), email(text|null), note(text|null),
//            created_at, updated_at
//
// products:  id(uuid PK), round_id(FK→rounds|null), supplier_id(FK→suppliers|null),
//            name(text), price(int), unit(text), is_active(bool),
//            stock(int|null), goal_qty(int|null), image_url(text|null), created_at
//
// users:     id(uuid PK), nickname(text UNIQUE), recipient_name,
//            phone, address, email, created_at, updated_at
//
// orders:    id(uuid PK), order_number(text UNIQUE), user_id(FK→users),
//            round_id(FK→rounds|null), total_amount(int),
//            shipping_fee(int|null), status(text),
//            payment_amount(int), payment_last5(text),
//            payment_reported_at, confirmed_at, shipped_at,
//            note, created_at, pickup_location(text|null),
//            submission_key(uuid UNIQUE)
//
// order_items: id(uuid PK), order_id(FK→orders), product_id(FK→products),
//              product_name, unit_price, quantity, subtotal
//
// notification_logs: id(uuid PK), order_id(FK→orders|null), channel(text),
//                    type(text), status(text), error_message(text|null), created_at
//
// ## 訂單狀態流 (5 statuses)
//
// pending_payment → 用戶回報匯款 → pending_confirm → Admin 確認付款
//   → confirmed → Admin 確認寄出 → shipped
// pending_payment → 用戶自行取消 → cancelled
// 任何狀態 → Admin 可手動 → cancelled
//
// ## 通知類型 (3 types)
//
// payment_confirmed: Admin 確認付款後 → 「訂單已確認」
// product_arrival:   Admin 點「通知到貨」→ 「您訂購的【商品】已到達理貨中心」
// shipment:          Admin 確認寄出 → 「訂單已出貨」
//
// ## 頁面結構
//
// 用戶端:
//   /                  首頁：商品列表 + 進度條 + 購物車 + 結帳（含運費）
//   /order/[id]        訂單確認頁：摘要 + 銀行帳號 + 匯款回報 + 取消 + 分享
//   /lookup            訂單查詢（暱稱或訂單編號）+ 歷史訂單
//
// Admin 端:
//   /admin             登入頁
//   /admin/dashboard   儀表板：本團摘要 + 商品需求彙總（含供應商+展開客戶+到貨通知）
//   /admin/orders      訂單管理：列表、篩選、單筆/批次確認、CSV 匯出
//   /admin/shipments   待出貨：列表、單筆/批次確認寄出、出貨通知
//   /admin/products    商品管理：CRUD + 目標 + 圖片 + 供應商關聯
//   /admin/rounds      開團管理：開團 / 截單 / 截止時間 / 運費設定
//   /admin/suppliers   供應商管理：CRUD + 關聯商品 + 展開客戶 + 到貨通知
//
// ## 環境變數 (.env.local)
//
// NEXT_PUBLIC_SUPABASE_URL=
// NEXT_PUBLIC_SUPABASE_ANON_KEY=
// SUPABASE_SERVICE_ROLE_KEY=
// DATABASE_URL=                   # Supabase pooled (port 6543, runtime)
// DIRECT_URL=                     # Supabase direct (port 5432, migrations)
// RESEND_API_KEY=
// RESEND_FROM_EMAIL=
// LINE_NOTIFY_TOKEN=
// NEXT_PUBLIC_BANK_NAME=
// NEXT_PUBLIC_BANK_ACCOUNT=
// NEXT_PUBLIC_BANK_HOLDER=
// NEXT_PUBLIC_SITE_URL=
//
// ## 檔案結構
//
// app/
// ├── page.tsx                        # 用戶首頁
// ├── order/[id]/page.tsx             # 訂單確認+匯款回報+取消+分享
// ├── lookup/page.tsx                 # 訂單查詢+歷史
// ├── admin/
// │   ├── page.tsx                    # Admin 登入
// │   ├── dashboard/page.tsx          # 儀表板
// │   ├── orders/page.tsx             # 訂單管理
// │   ├── shipments/page.tsx          # 待出貨管理
// │   ├── products/page.tsx           # 商品管理
// │   ├── rounds/page.tsx             # 開團管理
// │   └── suppliers/page.tsx          # 供應商管理
// └── api/
//     ├── submit-order/route.ts       # 送出訂單（含 submission_key + 運費計算）
//     ├── report-payment/route.ts     # 匯款回報
//     ├── confirm-order/route.ts      # 確認付款 + 發通知
//     ├── batch-confirm/route.ts      # 批次確認付款
//     ├── confirm-shipment/route.ts   # 確認寄出（單筆/批次）+ 出貨通知
//     ├── notify-arrival/route.ts     # 到貨通知（by product → all customers）
//     ├── cancel-order/route.ts       # 用戶取消（僅 pending_payment）
//     ├── export-csv/route.ts         # CSV 匯出
//     ├── rounds/route.ts             # 開團 CRUD（含 shipping_fee）
//     ├── products/route.ts           # 商品 CRUD（含 supplier_id）
//     ├── suppliers/route.ts          # 供應商 CRUD
//     └── orders-by-product/route.ts  # 依商品分組 → 客戶清單
// lib/
// ├── db/
// │   ├── prisma.ts                   # globalThis singleton
// │   ├── users.ts
// │   ├── orders.ts
// │   ├── products.ts
// │   ├── rounds.ts
// │   ├── suppliers.ts
// │   └── notification-logs.ts
// ├── notifications/
// │   ├── line-notify.ts
// │   ├── email.ts                    # 3 templates: payment_confirmed, shipment, product_arrival
// │   └── send.ts                     # Orchestrator
// ├── auth/
// │   └── supabase-admin.ts
// └── utils.ts
// components/
// ├── ui/                             # shadcn/ui
// ├── ProductCard.tsx
// ├── ProgressBar.tsx
// ├── SharePanel.tsx
// ├── DeadlineBanner.tsx
// ├── OrderStatusBadge.tsx
// ├── CartBar.tsx
// ├── ShippingFeeNote.tsx
// └── OrderLookup.tsx
// types/index.ts
// constants/index.ts
// prisma/schema.prisma                # 7 models
// prisma/seed.ts
//
// ============================================

import { useState, useCallback } from "react";

// ============================================
// Mock Data
// ============================================

const mockSuppliers = [
  { id: "s1", name: "阿土伯有機農場", contact: "陳阿土", phone: "0911-111-111", email: "farmer@org.tw", note: "週二、五送貨" },
  { id: "s2", name: "海鮮王批發", contact: "林海", phone: "0922-222-222", email: "sea@fish.tw", note: "需提前3天下單" },
];

const mockProducts = [
  { id: 1, name: "有機地瓜", price: 60, unit: "斤", stock: 50, goal_qty: 30, current_qty: 22, image_url: null, supplier_id: "s1" },
  { id: 2, name: "空心菜", price: 35, unit: "把", stock: 40, goal_qty: 20, current_qty: 20, image_url: null, supplier_id: "s1" },
  { id: 3, name: "放山雞蛋", price: 120, unit: "盒", stock: 20, goal_qty: 15, current_qty: 8, image_url: null, supplier_id: "s1" },
  { id: 4, name: "芭樂", price: 50, unit: "斤", stock: 0, goal_qty: 25, current_qty: 25, image_url: null, supplier_id: "s1" },
  { id: 5, name: "鱸魚片", price: 180, unit: "份", stock: 10, goal_qty: null, current_qty: 3, image_url: null, supplier_id: "s2" },
];

const mockRound = { id: "r1", name: "第 12 團：三月第三週", is_open: true, deadline: "2026-03-19T20:00:00+08:00", shipping_fee: 60 };

const mockOrders = [
  { id: "ORD-20260317-001", nickname: "小美", name: "王小美", phone: "0912-345-678", address: "台北市信義區松仁路100號", pickup: null, email: "mei@gmail.com", items: [{ name: "有機地瓜", qty: 3, price: 60 }, { name: "放山雞蛋", qty: 2, price: 120 }], subtotal: 420, shipping_fee: 60, total: 480, status: "pending_confirm", payAmount: 480, payLast5: "12345", paidAt: "2026-03-17 14:32", shippedAt: null, notif: [{ type: "payment_confirmed", line: "success", email: "success" }] },
  { id: "ORD-20260317-002", nickname: "阿明", name: "李阿明", phone: "0923-456-789", address: "新北市板橋區中山路50號", pickup: null, email: "ming@gmail.com", items: [{ name: "鱸魚片", qty: 1, price: 180 }, { name: "空心菜", qty: 5, price: 35 }], subtotal: 355, shipping_fee: 60, total: 415, status: "pending_payment", payAmount: null, payLast5: null, paidAt: null, shippedAt: null, notif: [] },
  { id: "ORD-20260316-003", nickname: "Jenny", name: "陳珍妮", phone: "0934-567-890", address: "台中市西區民生路20號", pickup: "面交點A：中正路全家", email: "jenny@gmail.com", items: [{ name: "芭樂", qty: 4, price: 50 }], subtotal: 200, shipping_fee: null, total: 200, status: "confirmed", payAmount: 200, payLast5: "67890", paidAt: "2026-03-16 10:15", shippedAt: null, notif: [{ type: "payment_confirmed", line: "success", email: "failed" }] },
  { id: "ORD-20260315-004", nickname: "小美", name: "王小美", phone: "0912-345-678", address: "台北市信義區松仁路100號", pickup: null, email: "mei@gmail.com", items: [{ name: "空心菜", qty: 3, price: 35 }], subtotal: 105, shipping_fee: 60, total: 165, status: "shipped", payAmount: 165, payLast5: "12345", paidAt: "2026-03-15 09:20", shippedAt: "2026-03-16 16:00", notif: [{ type: "payment_confirmed", line: "success", email: "success" }, { type: "shipment", line: "success", email: "success" }] },
];

const statusMap = { pending_payment: "待付款", pending_confirm: "待確認", confirmed: "已確認", shipped: "已出貨", cancelled: "已取消" };
const statusColor = { pending_payment: "bg-yellow-100 text-yellow-800", pending_confirm: "bg-blue-100 text-blue-800", confirmed: "bg-green-100 text-green-800", shipped: "bg-purple-100 text-purple-800", cancelled: "bg-red-100 text-red-800" };
const notifTypeLabel = { payment_confirmed: "付款確認", shipment: "出貨通知", product_arrival: "到貨通知" };

// ============================================
// Shared Components
// ============================================

function ProgressBar({ current, goal, unit }) {
  if (!goal) return null;
  const pct = Math.min(100, Math.round((current / goal) * 100));
  const reached = current >= goal;
  return (
    <div className="mt-2">
      <div className="flex justify-between text-xs mb-1">
        <span className={reached ? "text-green-600 font-bold" : "text-orange-600"}>
          {reached ? "🎉 已達標！" : `目標 ${goal} ${unit}`}
        </span>
        <span className="text-gray-500">{current}/{goal} {unit} ({pct}%)</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2.5">
        <div className={`h-2.5 rounded-full transition-all ${reached ? "bg-green-500" : "bg-orange-400"}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function SharePanel({ round }) {
  const [copied, setCopied] = useState(false);
  const url = `https://yourshop.vercel.app/?round=${round.id}`;
  const copy = () => { navigator.clipboard?.writeText(url).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  const shareText = encodeURIComponent(`${round.name} 開團中！快來跟團 👉 ${url}`);
  return (
    <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 space-y-3">
      <div className="font-bold text-orange-800 text-center">🔥 幫忙揪團，一起達標！</div>
      <p className="text-xs text-orange-700 text-center">有些商品還沒達到開團目標，分享給朋友一起買更划算</p>
      <div className="flex gap-2">
        <button onClick={copy} className="flex-1 bg-white border border-orange-300 text-orange-700 rounded-lg py-2 text-sm font-medium hover:bg-orange-100 transition">
          {copied ? "✓ 已複製！" : "📋 複製連結"}
        </button>
        <a href={`https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(url)}&text=${shareText}`} target="_blank" rel="noreferrer" className="flex-1 bg-green-500 text-white rounded-lg py-2 text-sm font-medium text-center hover:bg-green-600 transition">
          💬 分享到 LINE
        </a>
      </div>
      <div className="bg-white rounded-lg p-2 text-xs text-gray-500 font-mono break-all">{url}</div>
    </div>
  );
}

function DeadlineBanner({ round }) {
  if (!round.is_open) return <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800 text-center font-bold">🚫 本團已截單</div>;
  const dl = new Date(round.deadline);
  const diff = dl - new Date();
  const hrs = Math.max(0, Math.floor(diff / 3600000));
  const mins = Math.max(0, Math.floor((diff % 3600000) / 60000));
  return (
    <div className="bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-lg p-3 text-sm text-orange-800 text-center">
      ⏰ <b>{round.name}</b> — 截止時間：{dl.toLocaleDateString("zh-TW")} {dl.toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" })}
      {hrs < 48 && <span className="ml-2 text-red-600 font-bold">（剩 {hrs}h {mins}m）</span>}
    </div>
  );
}

// ============================================
// App Root
// ============================================

export default function App() {
  const [mode, setMode] = useState(null);
  if (!mode) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-4 text-center">
        <h1 className="text-2xl font-bold text-gray-800">生鮮團購系統 v2</h1>
        <p className="text-gray-500 text-sm">含運費、出貨管理、供應商管理、到貨通知</p>
        <button onClick={() => setMode("user")} className="w-full p-4 bg-green-600 text-white rounded-xl text-lg font-medium hover:bg-green-700 transition">🛒 用戶端體驗</button>
        <button onClick={() => setMode("admin")} className="w-full p-4 bg-indigo-600 text-white rounded-xl text-lg font-medium hover:bg-indigo-700 transition">⚙️ Admin 端體驗</button>
        <button onClick={() => setMode("lookup")} className="w-full p-4 bg-gray-600 text-white rounded-xl text-lg font-medium hover:bg-gray-700 transition">🔍 訂單查詢</button>
      </div>
    </div>
  );
  if (mode === "user") return <UserFlow onBack={() => setMode(null)} />;
  if (mode === "lookup") return <LookupFlow onBack={() => setMode(null)} />;
  return <AdminFlow onBack={() => setMode(null)} />;
}

// ============================================
// LOOKUP FLOW
// ============================================

function LookupFlow({ onBack }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState(null);
  const search = () => {
    const q = query.trim();
    if (!q) return;
    setResults(mockOrders.filter(o => o.nickname === q || o.id === q));
  };
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gray-600 text-white p-3 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={onBack} className="text-xl">←</button>
        <span className="font-bold">訂單查詢</span>
      </div>
      <div className="max-w-lg mx-auto p-4 space-y-4">
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
          📌 輸入 LINE 暱稱或訂單編號。試「小美」看歷史訂單（含已出貨）
        </div>
        <div className="flex gap-2">
          <input value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === "Enter" && search()} placeholder="LINE 暱稱 或 訂單編號" className="flex-1 border rounded-lg px-3 py-2 text-sm" />
          <button onClick={search} className="bg-gray-800 text-white px-4 rounded-lg text-sm font-medium">查詢</button>
        </div>
        {results !== null && results.length === 0 && <div className="text-center py-8 text-gray-400">找不到相關訂單</div>}
        {results && results.length > 0 && (
          <div className="space-y-3">
            <div className="text-sm text-gray-500">找到 {results.length} 筆訂單</div>
            {results.map(o => (
              <div key={o.id} className="bg-white rounded-lg border p-3 space-y-2">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="font-bold text-sm">{o.id}</span>
                    <span className="ml-2 text-gray-500 text-xs">{o.nickname}</span>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full ${statusColor[o.status]}`}>{statusMap[o.status]}</span>
                </div>
                <div className="text-xs text-gray-500">{o.items.map(i => `${i.name}x${i.qty}`).join("、")}</div>
                <div className="flex justify-between text-sm">
                  <span>商品 <b>${o.subtotal}</b>{o.shipping_fee ? <span className="text-gray-400 ml-1">+ 運費 ${o.shipping_fee}</span> : null}</span>
                  <span className="font-bold">合計 ${o.total}</span>
                </div>
                {o.status === "shipped" && o.shippedAt && <div className="text-xs text-purple-600">📦 出貨時間：{o.shippedAt}</div>}
                {o.status === "pending_payment" && (
                  <div className="flex gap-2 mt-1">
                    <button className="text-xs bg-blue-600 text-white px-3 py-1 rounded">前往匯款回報</button>
                    <button className="text-xs border border-red-200 text-red-600 px-3 py-1 rounded hover:bg-red-50">取消訂單</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================
// USER FLOW
// ============================================

function UserFlow({ onBack }) {
  const [step, setStep] = useState(0);
  const [cart, setCart] = useState({});
  const [nickname, setNickname] = useState("");
  const [found, setFound] = useState(false);
  const [info, setInfo] = useState({ name: "", phone: "", address: "", email: "", pickup: "" });
  const [payAmount, setPayAmount] = useState("");
  const [payLast5, setPayLast5] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const itemsSubtotal = Object.entries(cart).reduce((s, [id, qty]) => {
    const p = mockProducts.find(x => x.id === +id);
    return s + (p ? p.price * qty : 0);
  }, 0);
  const isDelivery = !info.pickup;
  const shippingFee = isDelivery && mockRound.shipping_fee ? mockRound.shipping_fee : 0;
  const cartTotal = itemsSubtotal + shippingFee;
  const cartCount = Object.values(cart).reduce((s, q) => s + q, 0);

  const addToCart = useCallback((pid) => {
    const p = mockProducts.find(x => x.id === pid);
    if (!p || p.stock === 0) return;
    setCart(c => {
      const cur = c[pid] || 0;
      if (p.stock !== null && cur >= p.stock) return c;
      return { ...c, [pid]: cur + 1 };
    });
  }, []);

  const removeFromCart = useCallback((pid) => {
    setCart(c => ({ ...c, [pid]: Math.max(0, (c[pid] || 0) - 1) }));
  }, []);

  const handleNickname = (v) => {
    setNickname(v);
    if (v === "小美") {
      setFound(true);
      setInfo({ name: "王小美", phone: "0912-345-678", address: "台北市信義區松仁路100號", email: "mei@gmail.com", pickup: "" });
    } else {
      setFound(false);
      setInfo({ name: "", phone: "", address: "", email: "", pickup: "" });
    }
  };

  const handleSubmit = () => {
    if (submitting) return;
    setSubmitting(true);
    setTimeout(() => { setStep(2); setSubmitting(false); }, 600);
  };

  const anyUnderGoal = mockProducts.some(p => p.goal_qty && p.current_qty < p.goal_qty);
  const steps = ["選購商品", "填寫資料", "訂單成立", "回報匯款", "完成"];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-green-600 text-white p-3 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={onBack} className="text-xl">←</button>
        <span className="font-bold">用戶端模擬</span>
        <span className="ml-auto text-xs bg-green-800 px-2 py-1 rounded">Step {step + 1}/5</span>
      </div>
      <div className="flex px-3 py-2 bg-white border-b text-xs gap-1 overflow-x-auto">
        {steps.map((s, i) => (
          <div key={i} className={`flex-1 text-center py-1 rounded ${i === step ? "bg-green-100 text-green-700 font-bold" : i < step ? "text-green-500" : "text-gray-300"}`}>
            {i < step ? "✓" : ""} {s}
          </div>
        ))}
      </div>
      <div className="max-w-lg mx-auto p-4">

        {/* STEP 0: 商品選購 */}
        {step === 0 && (
          <div className="space-y-3">
            <DeadlineBanner round={mockRound} />
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
              📌 模擬情境：你在 LINE 群組看到連結，點進來選購。宅配運費 ${mockRound.shipping_fee}
            </div>
            <h2 className="font-bold text-lg">本週商品</h2>
            {mockProducts.map(p => {
              const soldOut = p.stock === 0;
              const atMax = p.stock !== null && (cart[p.id] || 0) >= p.stock;
              return (
                <div key={p.id} className={`bg-white rounded-lg border p-3 ${soldOut ? "opacity-50" : ""}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="font-medium">{p.name} {soldOut && <span className="text-red-500 text-xs ml-1">已售完</span>}</div>
                      <div className="text-green-600 font-bold">${p.price} / {p.unit}</div>
                      {p.stock !== null && !soldOut && <div className="text-xs text-gray-400">剩餘 {p.stock - (cart[p.id] || 0)} {p.unit}</div>}
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => removeFromCart(p.id)} disabled={soldOut} className="w-8 h-8 rounded-full border text-lg flex items-center justify-center hover:bg-gray-100 disabled:opacity-30">−</button>
                      <span className="w-6 text-center font-bold">{cart[p.id] || 0}</span>
                      <button onClick={() => addToCart(p.id)} disabled={soldOut || atMax} className="w-8 h-8 rounded-full bg-green-600 text-white text-lg flex items-center justify-center hover:bg-green-700 disabled:opacity-30 disabled:cursor-not-allowed">+</button>
                    </div>
                  </div>
                  <ProgressBar current={p.current_qty + (cart[p.id] || 0)} goal={p.goal_qty} unit={p.unit} />
                  {atMax && <div className="text-xs text-red-500 mt-1">已達庫存上限</div>}
                </div>
              );
            })}
            {anyUnderGoal && <SharePanel round={mockRound} />}
            {cartCount > 0 && (
              <div className="sticky bottom-4 bg-green-600 text-white rounded-xl p-4 flex justify-between items-center shadow-lg">
                <div><span className="text-green-200">共 {cartCount} 件</span> <span className="font-bold text-xl ml-2">${itemsSubtotal}</span></div>
                <button onClick={() => setStep(1)} className="bg-white text-green-700 font-bold px-6 py-2 rounded-lg">下一步 →</button>
              </div>
            )}
          </div>
        )}

        {/* STEP 1: 填資料 */}
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="font-bold text-lg">填寫收貨資訊</h2>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">LINE 暱稱</label>
              <input value={nickname} onChange={e => handleNickname(e.target.value)} placeholder="輸入你在社群的暱稱" className="w-full border rounded-lg px-3 py-2 text-sm" />
              {found && <p className="text-green-600 text-xs mt-1">✓ 找到了！已自動帶入你的資料</p>}
              {nickname && !found && <p className="text-gray-400 text-xs mt-1">新用戶，請填寫以下資料</p>}
              <p className="text-gray-400 text-xs mt-1">💡 試輸入「小美」看自動帶入效果</p>
            </div>
            {[["name", "收貨人姓名"], ["phone", "電話"], ["address", "地址"], ["email", "Email"]].map(([f, label]) => (
              <div key={f}>
                <label className="block text-sm font-medium text-gray-600 mb-1">{label}</label>
                <input value={info[f]} onChange={e => setInfo(p => ({ ...p, [f]: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
            ))}
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">取貨方式</label>
              <select value={info.pickup} onChange={e => setInfo(p => ({ ...p, pickup: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm">
                <option value="">宅配到以上地址</option>
                <option value="面交點A：中正路全家">面交點A：中正路全家</option>
                <option value="面交點B：民生路小七">面交點B：民生路小七</option>
              </select>
              {!info.pickup && mockRound.shipping_fee > 0 && (
                <div className="mt-2 bg-blue-50 border border-blue-200 rounded-lg p-2 text-sm text-blue-800">
                  🚚 宅配到以上地址，運費 <b>${mockRound.shipping_fee}</b>
                </div>
              )}
              {info.pickup && (
                <div className="mt-2 bg-green-50 border border-green-200 rounded-lg p-2 text-sm text-green-700">
                  📍 面交取貨，免運費
                </div>
              )}
            </div>
            <div className="bg-gray-50 rounded-lg p-3 text-sm">
              <div className="font-medium mb-2">訂單摘要</div>
              {Object.entries(cart).filter(([, q]) => q > 0).map(([id, qty]) => {
                const p = mockProducts.find(x => x.id === +id);
                return <div key={id} className="flex justify-between"><span>{p.name} x{qty}</span><span>${p.price * qty}</span></div>;
              })}
              {shippingFee > 0 && (
                <div className="flex justify-between text-blue-600 mt-1"><span>🚚 運費</span><span>${shippingFee}</span></div>
              )}
              <div className="border-t mt-2 pt-2 font-bold flex justify-between"><span>合計</span><span>${cartTotal}</span></div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setStep(0)} className="flex-1 border rounded-lg py-3 font-medium hover:bg-gray-50">← 返回</button>
              <button onClick={handleSubmit} disabled={submitting} className="flex-1 bg-green-600 text-white rounded-lg py-3 font-bold hover:bg-green-700 disabled:opacity-50">
                {submitting ? "送出中…" : "送出訂單"}
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: 訂單成立 */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="text-center py-4">
              <div className="text-4xl mb-2">✅</div>
              <h2 className="font-bold text-xl">訂單已成立！</h2>
              <p className="text-gray-500 text-sm">訂單編號：ORD-20260317-005</p>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-2">
              <div className="font-bold text-blue-800 text-center">請匯款至以下帳戶</div>
              <div className="bg-white rounded-lg p-3 space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-gray-500">銀行</span><span className="font-medium">中國信託 (822)</span></div>
                <div className="flex justify-between"><span className="text-gray-500">戶名</span><span className="font-medium">王大明</span></div>
                <div className="flex justify-between"><span className="text-gray-500">帳號</span><span className="font-bold text-lg tracking-wider">1234-5678-9012</span></div>
                <div className="border-t pt-1 mt-1">
                  <div className="flex justify-between text-gray-500"><span>商品小計</span><span>${itemsSubtotal}</span></div>
                  {shippingFee > 0 && <div className="flex justify-between text-blue-600"><span>🚚 運費</span><span>${shippingFee}</span></div>}
                  <div className="flex justify-between font-bold text-green-600 text-lg"><span>應付金額</span><span>${cartTotal}</span></div>
                </div>
              </div>
            </div>
            {anyUnderGoal && <SharePanel round={mockRound} />}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
              ⚠️ 匯款完成後請點下方按鈕回報，我們確認後會發通知給你
            </div>
            <button onClick={() => setStep(3)} className="w-full bg-blue-600 text-white rounded-lg py-3 font-bold hover:bg-blue-700">我已匯款，前往回報 →</button>
            <button className="w-full border border-red-200 text-red-600 rounded-lg py-2 text-sm hover:bg-red-50">還沒匯款？取消此訂單</button>
          </div>
        )}

        {/* STEP 3: 匯款回報 */}
        {step === 3 && (
          <div className="space-y-4">
            <h2 className="font-bold text-lg">回報匯款資訊</h2>
            <p className="text-gray-500 text-sm">訂單 ORD-20260317-005 ・應付 ${cartTotal}</p>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">匯款金額</label>
              <input type="number" value={payAmount} onChange={e => setPayAmount(e.target.value)} placeholder={`例：${cartTotal}`} className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">匯款帳號後五碼</label>
              <input maxLength={5} value={payLast5} onChange={e => setPayLast5(e.target.value)} placeholder="例：56789" className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <button onClick={() => setStep(4)} className="w-full bg-green-600 text-white rounded-lg py-3 font-bold hover:bg-green-700">送出回報</button>
          </div>
        )}

        {/* STEP 4: 等待確認 */}
        {step === 4 && (
          <div className="space-y-4 text-center py-6">
            <div className="text-4xl mb-2">⏳</div>
            <h2 className="font-bold text-xl">匯款已回報</h2>
            <p className="text-gray-500 text-sm">等待賣家確認中…<br />確認後會收到 LINE 通知 + Email</p>
            <div className="bg-gray-50 rounded-xl p-4 text-sm text-left space-y-1">
              <div className="flex justify-between"><span className="text-gray-500">訂單編號</span><span>ORD-20260317-005</span></div>
              <div className="flex justify-between"><span className="text-gray-500">狀態</span><span className="text-blue-600 font-medium">待確認</span></div>
              <div className="flex justify-between"><span className="text-gray-500">匯款金額</span><span>${payAmount || cartTotal}</span></div>
              {shippingFee > 0 && <div className="flex justify-between"><span className="text-gray-500">含運費</span><span>${shippingFee}</span></div>}
              <div className="flex justify-between"><span className="text-gray-500">帳號後五碼</span><span>{payLast5 || "56789"}</span></div>
            </div>
            {anyUnderGoal && <SharePanel round={mockRound} />}
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-800 mt-4">
              💡 用「訂單查詢」頁面，輸入暱稱隨時查看訂單狀態
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================
// ADMIN FLOW
// ============================================

function AdminFlow({ onBack }) {
  const [step, setStep] = useState(0);
  const [orders, setOrders] = useState(mockOrders);
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState(null);
  const [confirmed, setConfirmed] = useState(false);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [showCsv, setShowCsv] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [showAddSupplier, setShowAddSupplier] = useState(false);
  const [batchSelected, setBatchSelected] = useState(new Set());
  const [batchDone, setBatchDone] = useState(false);
  const [shipBatchSel, setShipBatchSel] = useState(new Set());
  const [shipBatchDone, setShipBatchDone] = useState(false);
  const [expandedProduct, setExpandedProduct] = useState(null);
  const [arrivalSent, setArrivalSent] = useState(new Set());

  const filtered = orders.filter(o => filter === "all" || o.status === filter);
  const pendingConfirm = orders.filter(o => o.status === "pending_confirm");
  const confirmedOrders = orders.filter(o => o.status === "confirmed");

  const itemAgg = {};
  orders.filter(o => o.status !== "cancelled").forEach(o => {
    o.items.forEach(i => {
      if (!itemAgg[i.name]) itemAgg[i.name] = { qty: 0, revenue: 0 };
      itemAgg[i.name].qty += i.qty;
      itemAgg[i.name].revenue += i.qty * i.price;
    });
  });

  const getCustomersByProduct = (productName) => {
    const customers = [];
    orders.filter(o => o.status !== "cancelled").forEach(o => {
      o.items.forEach(i => {
        if (i.name === productName) customers.push({ nickname: o.nickname, name: o.name, phone: o.phone, qty: i.qty, orderId: o.id, status: o.status });
      });
    });
    return customers;
  };

  const toggleBatch = (id) => setBatchSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleShipBatch = (id) => setShipBatchSel(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const handleBatchConfirm = () => {
    setOrders(prev => prev.map(o => batchSelected.has(o.id) ? { ...o, status: "confirmed" } : o));
    setBatchDone(true);
    setTimeout(() => { setBatchDone(false); setBatchSelected(new Set()); }, 2000);
  };

  const handleBatchShip = () => {
    setOrders(prev => prev.map(o => shipBatchSel.has(o.id) ? { ...o, status: "shipped", shippedAt: "2026-03-17 18:00" } : o));
    setShipBatchDone(true);
    setTimeout(() => { setShipBatchDone(false); setShipBatchSel(new Set()); }, 2000);
  };

  const handleArrivalNotify = (productName) => {
    setArrivalSent(prev => new Set([...prev, productName]));
    setTimeout(() => setArrivalSent(prev => { const n = new Set(prev); n.delete(productName); return n; }), 3000);
  };

  const supplierForProduct = (productName) => {
    const p = mockProducts.find(x => x.name === productName);
    return p ? mockSuppliers.find(s => s.id === p.supplier_id) : null;
  };

  const tabs = [["dashboard", "📊 儀表板"], ["orders", "📋 訂單"], ["shipments", "📦 待出貨"], ["products", "🏷️ 商品"], ["rounds", "🔄 開團"], ["suppliers", "🏭 供應商"]];

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-indigo-600 text-white p-3 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={onBack} className="text-xl">←</button>
        <span className="font-bold">Admin 後台模擬</span>
      </div>
      <div className="max-w-2xl mx-auto p-4">

        {/* Login */}
        {step === 0 && (
          <div className="max-w-sm mx-auto space-y-4 mt-8">
            <h2 className="font-bold text-xl text-center">Admin 登入</h2>
            <div><label className="block text-sm font-medium text-gray-600 mb-1">Email</label><input defaultValue="admin@shop.com" className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
            <div><label className="block text-sm font-medium text-gray-600 mb-1">密碼</label><input type="password" defaultValue="password123" className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
            <button onClick={() => setStep(1)} className="w-full bg-indigo-600 text-white rounded-lg py-3 font-bold hover:bg-indigo-700">登入</button>
          </div>
        )}

        {/* Main Admin */}
        {step === 1 && !selected && (
          <div className="space-y-3">
            <div className="flex gap-1.5 mb-2 flex-wrap">
              {tabs.map(([k, label]) => (
                <button key={k} onClick={() => setActiveTab(k)} className={`px-2.5 py-1.5 rounded-lg text-xs font-medium ${activeTab === k ? "bg-indigo-600 text-white" : "bg-white border"}`}>{label}</button>
              ))}
            </div>

            {/* ===== DASHBOARD ===== */}
            {activeTab === "dashboard" && (
              <div className="space-y-3">
                <h3 className="font-bold">本團摘要 — {mockRound.name}</h3>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    ["總訂單", `${orders.length} 筆`],
                    ["總營收", `$${orders.filter(o => o.status !== "cancelled").reduce((s, o) => s + o.total, 0)}`],
                    ["待確認", `${pendingConfirm.length} 筆`],
                    ["待付款", `${orders.filter(o => o.status === "pending_payment").length} 筆`],
                    ["待出貨", `${confirmedOrders.length} 筆`],
                    ["已出貨", `${orders.filter(o => o.status === "shipped").length} 筆`],
                  ].map(([label, val], i) => (
                    <div key={i} className="bg-white rounded-lg border p-3 text-center">
                      <div className="text-xs text-gray-500">{label}</div>
                      <div className="font-bold text-lg">{val}</div>
                    </div>
                  ))}
                </div>

                <div className="bg-white rounded-lg border p-4">
                  <div className="font-bold text-sm mb-3">📦 商品需求彙總（供貨商採購用）</div>
                  <div className="space-y-2">
                    {Object.entries(itemAgg).map(([name, data]) => {
                      const p = mockProducts.find(x => x.name === name);
                      const sup = supplierForProduct(name);
                      const expanded = expandedProduct === name;
                      const customers = expanded ? getCustomersByProduct(name) : [];
                      const sent = arrivalSent.has(name);
                      return (
                        <div key={name} className="border-b pb-2">
                          <div className="flex justify-between items-center text-sm">
                            <button onClick={() => setExpandedProduct(expanded ? null : name)} className="font-medium text-left hover:text-indigo-600 flex items-center gap-1">
                              <span className="text-xs">{expanded ? "▼" : "▶"}</span> {name}
                              {sup && <span className="text-xs text-gray-400 ml-1">({sup.name})</span>}
                            </button>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-indigo-600">{data.qty} {p?.unit || "份"}</span>
                              <span className="text-gray-400">(${data.revenue})</span>
                              <button onClick={() => handleArrivalNotify(name)} disabled={sent} className={`text-xs px-2 py-1 rounded ${sent ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700 hover:bg-orange-200"}`}>
                                {sent ? "✓ 已通知" : "📢 到貨"}
                              </button>
                            </div>
                          </div>
                          {expanded && (
                            <div className="mt-2 ml-4 bg-gray-50 rounded-lg p-2 space-y-1">
                              <div className="text-xs text-gray-500 flex gap-3 font-medium border-b pb-1 mb-1">
                                <span className="w-14">暱稱</span><span className="w-16">收貨人</span><span className="w-24">電話</span><span className="w-10 text-right">數量</span><span className="flex-1 text-right">訂單</span>
                              </div>
                              {customers.map((c, i) => (
                                <div key={i} className="text-xs flex gap-3 items-center">
                                  <span className="w-14 font-medium">{c.nickname}</span>
                                  <span className="w-16">{c.name}</span>
                                  <span className="w-24 text-gray-500">{c.phone}</span>
                                  <span className="w-10 text-right font-bold text-indigo-600">{c.qty}</span>
                                  <span className="flex-1 text-right text-gray-400">{c.orderId}</span>
                                </div>
                              ))}
                              {sent && <div className="text-xs text-green-600 mt-1">📢 已發送到貨通知：「您訂購的【{name}】已到達理貨中心」→ {customers.length} 位客戶</div>}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="bg-white rounded-lg border p-4">
                  <div className="font-bold text-sm mb-3">📡 通知發送狀態</div>
                  <div className="space-y-2 text-sm">
                    {orders.filter(o => o.notif && o.notif.length > 0).map(o => (
                      <div key={o.id} className="flex justify-between items-center border-b pb-2">
                        <span className="text-gray-600 text-xs">{o.id}</span>
                        <div className="flex gap-1 flex-wrap justify-end">
                          {o.notif.map((n, i) => (
                            <span key={i} className="text-xs">
                              <span className="text-gray-400 mr-1">{notifTypeLabel[n.type]}:</span>
                              <span className={`px-1.5 py-0.5 rounded ${n.line === "success" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>L{n.line === "success" ? "✓" : "✗"}</span>
                              {" "}
                              <span className={`px-1.5 py-0.5 rounded ${n.email === "success" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>E{n.email === "success" ? "✓" : "✗"}</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ===== ORDERS ===== */}
            {activeTab === "orders" && (
              <>
                <div className="flex gap-1.5 items-center flex-wrap">
                  {["all", "pending_payment", "pending_confirm", "confirmed", "shipped", "cancelled"].map(s => (
                    <button key={s} onClick={() => setFilter(s)} className={`text-xs px-2.5 py-1 rounded-full ${filter === s ? "bg-indigo-600 text-white" : "bg-white border"}`}>
                      {s === "all" ? "全部" : statusMap[s]}
                      {s === "pending_confirm" && pendingConfirm.length > 0 && ` 🔴${pendingConfirm.length}`}
                    </button>
                  ))}
                  <button onClick={() => setShowCsv(true)} className="ml-auto text-xs px-3 py-1 bg-gray-800 text-white rounded-full">📥 CSV</button>
                </div>

                {pendingConfirm.length > 0 && (filter === "all" || filter === "pending_confirm") && (
                  <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 flex justify-between items-center">
                    <div className="text-sm text-indigo-800">已選 <b>{batchSelected.size}</b> 筆</div>
                    <button onClick={handleBatchConfirm} disabled={batchSelected.size === 0} className="text-xs bg-green-600 text-white px-3 py-1 rounded-lg disabled:opacity-30">
                      {batchDone ? "✓ 已確認！" : "批次確認付款"}
                    </button>
                  </div>
                )}

                {showCsv && (
                  <div className="bg-gray-800 text-green-400 rounded-lg p-3 text-xs font-mono">
                    <div className="text-white mb-1">📄 orders_export.csv（含運費欄位）</div>
                    訂單編號,暱稱,收貨人,電話,地址,取貨,商品,小計,運費,合計,狀態
                    <button onClick={() => setShowCsv(false)} className="block mt-2 text-gray-400 underline">關閉</button>
                  </div>
                )}

                {filtered.map(o => (
                  <div key={o.id} onClick={() => { if (o.status === "pending_confirm") setSelected(o); }} className={`bg-white rounded-lg border p-3 space-y-2 ${o.status === "pending_confirm" ? "cursor-pointer hover:border-indigo-400 border-indigo-200" : ""}`}>
                    <div className="flex items-start gap-2">
                      {o.status === "pending_confirm" && (
                        <input type="checkbox" checked={batchSelected.has(o.id)} onChange={() => toggleBatch(o.id)} onClick={e => e.stopPropagation()} className="mt-1 accent-indigo-600" />
                      )}
                      <div className="flex-1">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="font-bold text-sm">{o.id}</span>
                            <span className="ml-2 text-gray-500 text-xs">{o.nickname}</span>
                            {o.pickup && <span className="ml-1 text-xs text-purple-600">📍</span>}
                          </div>
                          <span className={`text-xs px-2 py-1 rounded-full ${statusColor[o.status]}`}>{statusMap[o.status]}</span>
                        </div>
                        <div className="text-xs text-gray-500">{o.items.map(i => `${i.name}x${i.qty}`).join("、")}</div>
                        <div className="flex justify-between text-sm">
                          <span>${o.subtotal}{o.shipping_fee ? <span className="text-gray-400">+${o.shipping_fee}運</span> : ""} = <b>${o.total}</b></span>
                          {o.payAmount && <span className="text-blue-600 text-xs">匯${o.payAmount}/{o.payLast5}</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </>
            )}

            {/* ===== SHIPMENTS ===== */}
            {activeTab === "shipments" && (
              <div className="space-y-3">
                <h3 className="font-bold">待出貨管理</h3>
                {confirmedOrders.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">目前沒有待出貨的訂單</div>
                ) : (
                  <>
                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 flex justify-between items-center">
                      <div className="text-sm text-purple-800">已選 <b>{shipBatchSel.size}</b> 筆</div>
                      <button onClick={handleBatchShip} disabled={shipBatchSel.size === 0} className="text-xs bg-purple-600 text-white px-3 py-1 rounded-lg disabled:opacity-30">
                        {shipBatchDone ? "✓ 已出貨！" : "📦 批次確認寄出"}
                      </button>
                    </div>
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 text-xs text-amber-800">
                      📌 確認寄出後會自動發 LINE + Email 出貨通知
                    </div>
                    {confirmedOrders.map(o => (
                      <div key={o.id} className="bg-white rounded-lg border p-3 space-y-2">
                        <div className="flex items-start gap-2">
                          <input type="checkbox" checked={shipBatchSel.has(o.id)} onChange={() => toggleShipBatch(o.id)} className="mt-1 accent-purple-600" />
                          <div className="flex-1">
                            <div className="flex justify-between items-start">
                              <div>
                                <span className="font-bold text-sm">{o.id}</span>
                                <span className="ml-2 text-gray-500 text-xs">{o.nickname}</span>
                              </div>
                              <span className={`text-xs px-2 py-1 rounded-full ${statusColor[o.status]}`}>{statusMap[o.status]}</span>
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              <span className="font-medium">{o.name}</span> ・ {o.phone}
                            </div>
                            <div className="text-xs text-gray-500">
                              {o.pickup ? <span className="text-purple-600">📍 {o.pickup}</span> : <span>🏠 {o.address}</span>}
                            </div>
                            <div className="text-xs text-gray-500 mt-1">{o.items.map(i => `${i.name}x${i.qty}`).join("、")}</div>
                            <div className="flex justify-between items-center mt-1">
                              <span className="text-sm font-bold">${o.total}</span>
                              <button onClick={() => setOrders(prev => prev.map(x => x.id === o.id ? { ...x, status: "shipped", shippedAt: "2026-03-17 18:00" } : x))} className="text-xs bg-purple-600 text-white px-3 py-1 rounded hover:bg-purple-700">
                                確認寄出
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}

            {/* ===== PRODUCTS ===== */}
            {activeTab === "products" && (
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <h3 className="font-bold">商品列表</h3>
                  <button onClick={() => setShowAdd(!showAdd)} className="text-sm bg-indigo-600 text-white px-3 py-1 rounded-lg">+ 新增</button>
                </div>
                {showAdd && (
                  <div className="bg-white border-2 border-dashed border-indigo-300 rounded-lg p-3 space-y-2">
                    <div className="grid grid-cols-3 gap-2">
                      <input placeholder="品名" className="border rounded px-2 py-1 text-sm" />
                      <input placeholder="單價" type="number" className="border rounded px-2 py-1 text-sm" />
                      <select className="border rounded px-2 py-1 text-sm"><option>斤</option><option>盒</option><option>把</option><option>份</option><option>包</option></select>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input placeholder="庫存" type="number" className="border rounded px-2 py-1 text-sm" />
                      <input placeholder="目標數量" type="number" className="border rounded px-2 py-1 text-sm" />
                    </div>
                    <select className="w-full border rounded px-2 py-1 text-sm">
                      <option value="">選擇供應商（選填）</option>
                      {mockSuppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                    <input placeholder="圖片網址（選填）" className="w-full border rounded px-2 py-1 text-sm" />
                    <div className="flex gap-2">
                      <button onClick={() => setShowAdd(false)} className="flex-1 bg-indigo-600 text-white rounded py-1 text-sm">儲存</button>
                      <button onClick={() => setShowAdd(false)} className="flex-1 border rounded py-1 text-sm">取消</button>
                    </div>
                  </div>
                )}
                {mockProducts.map(p => {
                  const sup = mockSuppliers.find(s => s.id === p.supplier_id);
                  return (
                    <div key={p.id} className="bg-white rounded-lg border p-3 space-y-2">
                      <div className="flex justify-between items-center">
                        <div>
                          <span className="font-medium">{p.name}</span>
                          <span className="text-gray-500 ml-2 text-sm">${p.price}/{p.unit}</span>
                          {sup && <span className="ml-2 text-xs text-gray-400">🏭 {sup.name}</span>}
                        </div>
                        <div className="flex gap-2 items-center">
                          <span className={`text-xs px-2 py-1 rounded ${p.stock === 0 ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
                            {p.stock === 0 ? "售完" : "上架"}
                          </span>
                          <button className="text-xs text-gray-400 hover:text-blue-500">編輯</button>
                        </div>
                      </div>
                      <div className="flex gap-4 text-xs text-gray-500">
                        <span>庫存：{p.stock === null ? "不限" : p.stock}</span>
                        <span>目標：{p.goal_qty || "—"}</span>
                        <span>已訂：{p.current_qty}</span>
                      </div>
                      <ProgressBar current={p.current_qty} goal={p.goal_qty} unit={p.unit} />
                    </div>
                  );
                })}
              </div>
            )}

            {/* ===== ROUNDS ===== */}
            {activeTab === "rounds" && (
              <div className="space-y-3">
                <h3 className="font-bold">開團管理</h3>
                <div className="bg-white rounded-lg border p-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="font-bold">{mockRound.name}</div>
                      <div className="text-xs text-gray-500">截止：{new Date(mockRound.deadline).toLocaleString("zh-TW")}</div>
                      <div className="text-xs text-blue-600 mt-1">🚚 宅配運費：${mockRound.shipping_fee}</div>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full ${mockRound.is_open ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                      {mockRound.is_open ? "開團中" : "已截單"}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button className="flex-1 bg-red-600 text-white rounded-lg py-2 text-sm font-medium">截單</button>
                    <button className="flex-1 border rounded-lg py-2 text-sm font-medium">改截止</button>
                    <button className="flex-1 border rounded-lg py-2 text-sm font-medium">改運費</button>
                  </div>
                </div>
                <button className="w-full bg-indigo-600 text-white rounded-lg py-3 font-bold">+ 新開一團</button>
                <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-500 space-y-1">
                  <div className="font-medium text-gray-700">說明</div>
                  <div>• 開團設定名稱、截止時間、宅配運費</div>
                  <div>• 運費修改不影響已成立訂單（快照機制）</div>
                  <div>• 截單後用戶端顯示「本團已截單」</div>
                </div>
              </div>
            )}

            {/* ===== SUPPLIERS ===== */}
            {activeTab === "suppliers" && (
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <h3 className="font-bold">供應商管理</h3>
                  <button onClick={() => setShowAddSupplier(!showAddSupplier)} className="text-sm bg-indigo-600 text-white px-3 py-1 rounded-lg">+ 新增</button>
                </div>
                {showAddSupplier && (
                  <div className="bg-white border-2 border-dashed border-indigo-300 rounded-lg p-3 space-y-2">
                    <input placeholder="供應商名稱" className="w-full border rounded px-2 py-1 text-sm" />
                    <div className="grid grid-cols-2 gap-2">
                      <input placeholder="聯絡人" className="border rounded px-2 py-1 text-sm" />
                      <input placeholder="電話" className="border rounded px-2 py-1 text-sm" />
                    </div>
                    <input placeholder="Email" className="w-full border rounded px-2 py-1 text-sm" />
                    <input placeholder="備註" className="w-full border rounded px-2 py-1 text-sm" />
                    <div className="flex gap-2">
                      <button onClick={() => setShowAddSupplier(false)} className="flex-1 bg-indigo-600 text-white rounded py-1 text-sm">儲存</button>
                      <button onClick={() => setShowAddSupplier(false)} className="flex-1 border rounded py-1 text-sm">取消</button>
                    </div>
                  </div>
                )}
                {mockSuppliers.map(s => {
                  const products = mockProducts.filter(p => p.supplier_id === s.id);
                  return (
                    <div key={s.id} className="bg-white rounded-lg border p-4 space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-bold">{s.name}</div>
                          <div className="text-xs text-gray-500">{s.contact} ・ {s.phone}</div>
                          {s.email && <div className="text-xs text-gray-400">{s.email}</div>}
                          {s.note && <div className="text-xs text-orange-600 mt-1">📝 {s.note}</div>}
                        </div>
                        <div className="flex gap-2">
                          <button className="text-xs text-gray-400 hover:text-blue-500">編輯</button>
                          <button className="text-xs text-gray-400 hover:text-red-500">刪除</button>
                        </div>
                      </div>
                      <div className="border-t pt-2">
                        <div className="text-xs font-medium text-gray-600 mb-2">關聯商品（{products.length} 項）</div>
                        {products.map(p => {
                          const agg = itemAgg[p.name];
                          const expKey = `sup-${s.id}-${p.name}`;
                          const expanded = expandedProduct === expKey;
                          const customers = expanded ? getCustomersByProduct(p.name) : [];
                          const sent = arrivalSent.has(p.name);
                          return (
                            <div key={p.id} className="mb-2">
                              <div className="flex justify-between items-center text-sm">
                                <button onClick={() => setExpandedProduct(expanded ? null : expKey)} className="hover:text-indigo-600 flex items-center gap-1 text-left">
                                  <span className="text-xs">{expanded ? "▼" : "▶"}</span>
                                  {p.name} <span className="text-gray-400 text-xs">${p.price}/{p.unit}</span>
                                </button>
                                <div className="flex items-center gap-2">
                                  {agg && <span className="text-xs font-bold text-indigo-600">需{agg.qty}{p.unit}</span>}
                                  <button onClick={() => handleArrivalNotify(p.name)} disabled={sent} className={`text-xs px-2 py-1 rounded ${sent ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700 hover:bg-orange-200"}`}>
                                    {sent ? "✓ 已通知" : "📢 到貨"}
                                  </button>
                                </div>
                              </div>
                              {expanded && customers.length > 0 && (
                                <div className="mt-1 ml-4 bg-gray-50 rounded-lg p-2 space-y-1">
                                  {customers.map((c, i) => (
                                    <div key={i} className="text-xs flex justify-between">
                                      <span>{c.nickname} ({c.name}) ・ {c.phone}</span>
                                      <span className="font-bold text-indigo-600">{c.qty} {p.unit}</span>
                                    </div>
                                  ))}
                                  {sent && <div className="text-xs text-green-600 mt-1">📢 「您訂購的【{p.name}】已到達理貨中心」→ {customers.length} 位</div>}
                                </div>
                              )}
                              <ProgressBar current={p.current_qty} goal={p.goal_qty} unit={p.unit} />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ===== ORDER DETAIL ===== */}
        {step === 1 && selected && !confirmed && (
          <div className="space-y-4">
            <h2 className="font-bold text-lg">確認付款</h2>
            <div className="bg-white rounded-xl border p-4 space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-bold">{selected.id}</div>
                  <div className="text-gray-500 text-sm">{selected.nickname} ({selected.name})</div>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full ${statusColor[selected.status]}`}>{statusMap[selected.status]}</span>
              </div>
              <div className="border-t pt-3 space-y-1 text-sm">
                <div className="font-medium mb-2">訂購明細</div>
                {selected.items.map((item, i) => (
                  <div key={i} className="flex justify-between"><span>{item.name} x{item.qty}</span><span>${item.price * item.qty}</span></div>
                ))}
                {selected.shipping_fee > 0 && <div className="flex justify-between text-blue-600"><span>🚚 運費</span><span>${selected.shipping_fee}</span></div>}
                <div className="border-t mt-2 pt-2 font-bold flex justify-between"><span>合計</span><span>${selected.total}</span></div>
              </div>
              <div className="border-t pt-3 space-y-1 text-sm">
                <div className="font-medium mb-2">匯款資訊</div>
                <div className="flex justify-between"><span className="text-gray-500">金額</span><span className="font-bold text-blue-600">${selected.payAmount}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">後五碼</span><span className="font-bold">{selected.payLast5}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">時間</span><span>{selected.paidAt}</span></div>
                {selected.payAmount === selected.total ? (
                  <div className="bg-green-50 text-green-700 rounded-lg p-2 text-xs mt-2">✅ 金額吻合（${selected.total} = ${selected.payAmount}）</div>
                ) : (
                  <div className="bg-red-50 text-red-700 rounded-lg p-2 text-xs mt-2">⚠️ 不符！訂單 ${selected.total} ≠ 匯款 ${selected.payAmount}</div>
                )}
              </div>
              <div className="border-t pt-3 space-y-1 text-sm">
                <div className="font-medium mb-2">收貨</div>
                <div className="flex justify-between"><span className="text-gray-500">姓名</span><span>{selected.name}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">電話</span><span>{selected.phone}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">地址</span><span className="text-right max-w-48">{selected.address}</span></div>
                {selected.pickup ? (
                  <div className="flex justify-between"><span className="text-gray-500">取貨</span><span className="text-purple-600">{selected.pickup}</span></div>
                ) : (
                  <div className="flex justify-between"><span className="text-gray-500">配送</span><span className="text-blue-600">宅配（運費 ${selected.shipping_fee}）</span></div>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setSelected(null)} className="flex-1 border rounded-lg py-3 font-medium hover:bg-gray-50">← 返回</button>
              <button onClick={() => setConfirmed(true)} className="flex-1 bg-green-600 text-white rounded-lg py-3 font-bold hover:bg-green-700">✓ 確認付款</button>
            </div>
            <button onClick={() => setSelected(null)} className="w-full border border-red-200 text-red-600 rounded-lg py-2 text-sm hover:bg-red-50">✕ 取消訂單</button>
          </div>
        )}

        {/* ===== CONFIRM RESULT ===== */}
        {step === 1 && selected && confirmed && (
          <div className="space-y-4 py-6">
            <div className="text-center">
              <div className="text-4xl mb-2">🎉</div>
              <h2 className="font-bold text-xl">訂單已確認！</h2>
              <p className="text-gray-500 text-sm mt-1">{selected.id}</p>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-2">
              <div className="font-bold text-green-800">💬 LINE Notify</div>
              <div className="bg-white rounded-lg p-3 text-sm font-mono text-gray-700 space-y-0.5">
                <div className="text-green-600 font-bold">【訂單確認】</div>
                <div>Hi {selected.nickname}，訂單已確認！</div>
                <div>{selected.id}</div>
                <div>{selected.items.map(i => `${i.name}x${i.qty}`).join("、")}</div>
                <div>${selected.total}（含運費 ${selected.shipping_fee || 0}）</div>
              </div>
              <p className="text-xs text-green-600">type=payment_confirmed, line=success</p>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-2">
              <div className="font-bold text-blue-800">📧 Email → {selected.email}</div>
              <div className="bg-white rounded-lg p-3 text-sm space-y-1">
                <div className="font-bold">訂單確認 — {selected.id}</div>
                <div className="bg-gray-50 rounded p-2 text-xs mt-1">
                  {selected.items.map((item, i) => (
                    <div key={i} className="flex justify-between"><span>{item.name} x{item.qty}</span><span>${item.price * item.qty}</span></div>
                  ))}
                  {selected.shipping_fee > 0 && <div className="flex justify-between text-blue-600"><span>運費</span><span>${selected.shipping_fee}</span></div>}
                  <div className="border-t mt-1 pt-1 font-bold flex justify-between"><span>合計</span><span>${selected.total}</span></div>
                </div>
              </div>
              <p className="text-xs text-blue-600">type=payment_confirmed, email=success</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-4 text-xs text-gray-600 space-y-1">
              <div className="font-medium text-sm text-gray-800">系統摘要</div>
              {["pending_confirm → confirmed", "confirmed_at 已寫入", "LINE Notify ✓ (payment_confirmed)", "Email ✓ (payment_confirmed)", "下一步：到貨通知 → 確認寄出"].map((t, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 bg-green-500 rounded-full flex items-center justify-center text-white text-xs shrink-0">✓</span>{t}
                </div>
              ))}
            </div>
            <button onClick={() => { setSelected(null); setConfirmed(false); }} className="w-full bg-indigo-600 text-white rounded-lg py-3 font-bold hover:bg-indigo-700">← 返回後台</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================
// Supabase Migration SQL v2
// (Run in Supabase SQL Editor)
// ============================================
//
// -- 0. Rounds 開團表
// create table public.rounds (
//   id uuid default gen_random_uuid() primary key,
//   name text not null,
//   is_open boolean not null default true,
//   deadline timestamptz,
//   shipping_fee integer,            -- NEW: 宅配運費 (null = 免運)
//   created_at timestamptz default now()
// );
//
// -- 1. Suppliers 供應商表
// create table public.suppliers (
//   id uuid default gen_random_uuid() primary key,
//   name text not null,
//   contact_name text,
//   phone text,
//   email text,
//   note text,
//   created_at timestamptz default now(),
//   updated_at timestamptz default now()
// );
//
// -- 2. Products 商品表
// create table public.products (
//   id uuid default gen_random_uuid() primary key,
//   round_id uuid references public.rounds(id) on delete set null,
//   supplier_id uuid references public.suppliers(id) on delete set null,
//   name text not null,
//   price integer not null check (price > 0),
//   unit text not null default '份',
//   is_active boolean not null default true,
//   stock integer,
//   goal_qty integer,
//   image_url text,
//   created_at timestamptz default now()
// );
//
// -- 3. Users 用戶表
// create table public.users (
//   id uuid default gen_random_uuid() primary key,
//   nickname text unique not null,
//   recipient_name text,
//   phone text,
//   address text,
//   email text,
//   created_at timestamptz default now(),
//   updated_at timestamptz default now()
// );
//
// -- 4. Orders 訂單表
// create table public.orders (
//   id uuid default gen_random_uuid() primary key,
//   order_number text unique not null,
//   user_id uuid references public.users(id) on delete set null,
//   round_id uuid references public.rounds(id) on delete set null,
//   total_amount integer not null default 0,
//   shipping_fee integer,            -- NEW: 快照運費 (null = 面交免運)
//   status text not null default 'pending_payment'
//     check (status in ('pending_payment','pending_confirm','confirmed','shipped','cancelled')),
//   payment_amount integer,
//   payment_last5 text check (payment_last5 is null or length(payment_last5) = 5),
//   payment_reported_at timestamptz,
//   confirmed_at timestamptz,
//   shipped_at timestamptz,          -- NEW: 確認寄出時間
//   note text,
//   pickup_location text,
//   submission_key uuid unique,
//   created_at timestamptz default now()
// );
//
// -- 5. Order Items 訂單明細表
// create table public.order_items (
//   id uuid default gen_random_uuid() primary key,
//   order_id uuid references public.orders(id) on delete cascade not null,
//   product_id uuid references public.products(id) on delete set null,
//   product_name text not null,
//   unit_price integer not null,
//   quantity integer not null check (quantity > 0),
//   subtotal integer not null
// );
//
// -- 6. Notification Logs 通知記錄表
// create table public.notification_logs (
//   id uuid default gen_random_uuid() primary key,
//   order_id uuid references public.orders(id) on delete cascade,  -- nullable for arrival
//   channel text not null check (channel in ('line','email')),
//   type text not null check (type in ('payment_confirmed','shipment','product_arrival')),
//   status text not null check (status in ('success','failed')),
//   error_message text,
//   created_at timestamptz default now()
// );
//
// -- Indexes
// create index idx_rounds_is_open on public.rounds(is_open);
// create index idx_products_round_id on public.products(round_id);
// create index idx_products_supplier_id on public.products(supplier_id);
// create index idx_products_is_active on public.products(is_active);
// create index idx_orders_status on public.orders(status);
// create index idx_orders_user_id on public.orders(user_id);
// create index idx_orders_round_id on public.orders(round_id);
// create index idx_orders_created_at on public.orders(created_at desc);
// create index idx_order_items_order_id on public.order_items(order_id);
// create index idx_notification_logs_order_id on public.notification_logs(order_id);
// create index idx_notification_logs_type on public.notification_logs(type);
//
// -- Auto-generate order number with advisory lock
// create or replace function public.generate_order_number()
// returns trigger as $$
// declare
//   today_str text;
//   seq integer;
// begin
//   today_str := to_char(now() at time zone 'Asia/Taipei', 'YYYYMMDD');
//   perform pg_advisory_xact_lock(hashtext('order_number_' || today_str));
//   select count(*) + 1 into seq
//   from public.orders
//   where order_number like 'ORD-' || today_str || '-%';
//   new.order_number := 'ORD-' || today_str || '-' || lpad(seq::text, 3, '0');
//   return new;
// end;
// $$ language plpgsql;
//
// create trigger trg_generate_order_number
//   before insert on public.orders
//   for each row
//   when (new.order_number is null or new.order_number = '')
//   execute function public.generate_order_number();
//
// -- Auto-update updated_at (users + suppliers)
// create or replace function public.handle_updated_at()
// returns trigger as $$
// begin
//   new.updated_at = now();
//   return new;
// end;
// $$ language plpgsql;
//
// create trigger trg_users_updated_at
//   before update on public.users
//   for each row
//   execute function public.handle_updated_at();
//
// create trigger trg_suppliers_updated_at
//   before update on public.suppliers
//   for each row
//   execute function public.handle_updated_at();
//
// -- RLS Policies
//
// -- Rounds: read everyone, write admin
// alter table public.rounds enable row level security;
// create policy "Rounds select" on public.rounds for select using (true);
// create policy "Rounds admin" on public.rounds for all
//   using (auth.role() = 'authenticated')
//   with check (auth.role() = 'authenticated');
//
// -- Suppliers: admin only
// alter table public.suppliers enable row level security;
// create policy "Suppliers admin select" on public.suppliers for select
//   using (auth.role() = 'authenticated');
// create policy "Suppliers admin write" on public.suppliers for all
//   using (auth.role() = 'authenticated')
//   with check (auth.role() = 'authenticated');
//
// -- Products: read everyone, write admin
// alter table public.products enable row level security;
// create policy "Products select" on public.products for select using (true);
// create policy "Products admin" on public.products for all
//   using (auth.role() = 'authenticated')
//   with check (auth.role() = 'authenticated');
//
// -- Users: anyone read/create/update
// alter table public.users enable row level security;
// create policy "Users select" on public.users for select using (true);
// create policy "Users insert" on public.users for insert with check (true);
// create policy "Users update" on public.users for update using (true) with check (true);
//
// -- Orders: read/create anyone, anon update only payment report, admin update all
// alter table public.orders enable row level security;
// create policy "Orders select" on public.orders for select using (true);
// create policy "Orders insert" on public.orders for insert with check (true);
// create policy "Orders anon payment report" on public.orders for update
//   using (status = 'pending_payment')
//   with check (
//     status = 'pending_confirm'
//     and payment_amount is not null
//     and payment_last5 is not null
//   );
// create policy "Orders admin update" on public.orders for update
//   using (auth.role() = 'authenticated')
//   with check (auth.role() = 'authenticated');
//
// -- Order items: read/create anyone
// alter table public.order_items enable row level security;
// create policy "Order items select" on public.order_items for select using (true);
// create policy "Order items insert" on public.order_items for insert with check (true);
//
// -- Notification logs: admin only
// alter table public.notification_logs enable row level security;
// create policy "Notif logs admin select" on public.notification_logs for select
//   using (auth.role() = 'authenticated');
// create policy "Notif logs admin insert" on public.notification_logs for insert
//   with check (auth.role() = 'authenticated');
//
// -- Helper view: product progress (crowdfunding bar)
// create or replace view public.product_progress as
// select
//   p.id as product_id,
//   p.name,
//   p.goal_qty,
//   p.supplier_id,
//   coalesce(sum(oi.quantity), 0) as current_qty,
//   case
//     when p.goal_qty is null then null
//     when p.goal_qty = 0 then 100
//     else round(coalesce(sum(oi.quantity), 0)::numeric / p.goal_qty * 100, 1)
//   end as progress_pct
// from public.products p
// left join public.order_items oi on oi.product_id = p.id
// left join public.orders o on o.id = oi.order_id and o.status != 'cancelled'
// where p.is_active = true
// group by p.id, p.name, p.goal_qty, p.supplier_id;
//
// -- Helper view: orders by product (for customer-per-item list)
// create or replace view public.orders_by_product as
// select
//   oi.product_id,
//   oi.product_name,
//   u.nickname,
//   u.recipient_name,
//   u.phone,
//   oi.quantity,
//   oi.subtotal,
//   o.order_number,
//   o.status,
//   o.pickup_location
// from public.order_items oi
// join public.orders o on o.id = oi.order_id and o.status != 'cancelled'
// join public.users u on u.id = o.user_id
// order by oi.product_name, u.nickname;