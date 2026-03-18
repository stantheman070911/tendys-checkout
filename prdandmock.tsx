// ============================================
// Mock Data Reference — for prisma/seed.ts
// ============================================
//
// This file contains mock data shapes used as reference for seeding
// and testing. The full DB schema, system flow, page structure, and
// env vars are documented in claude.md, whatwearebuilding.md, and roadmap.md.
// Do NOT duplicate that information here.
//
// ============================================
// UX AUDIT — REQUIRED UPDATES (2026-03-18)
// ============================================
//
// The following gaps were identified between whatwearebuilding.md spec
// and this prototype. Each must be addressed when building real pages.
//
// --- USER FLOW ---
//
// 1. CartBar missing shipping fee hint
//    Location: UserFlow step 0, sticky bottom bar
//    Fix: Add small text "宅配另加運費 $60" next to the total
//    Spec ref: whatwearebuilding.md UX 要點 #1
//
// 2. Payment report missing confirmation step
//    Location: UserFlow step 3 (回報匯款)
//    Fix: After user fills amount + last5, show confirmation summary
//    comparing order total vs reported amount BEFORE submit.
//    Add a "確認送出" step instead of going straight to submit.
//    Spec ref: whatwearebuilding.md Flow 2 step 2, UX 要點 #3
//
// 3. Missing "繼續選購" button on order confirmation
//    Location: UserFlow step 2 (訂單成立)
//    Fix: Add "繼續選購" link back to storefront (same round)
//    Spec ref: whatwearebuilding.md UX 要點 #5
//
// 4. Lookup results not clickable
//    Location: LookupFlow results list
//    Fix: Each order card should be clickable → navigate to /order/[id]
//    Spec ref: whatwearebuilding.md Flow 3 step 3, UX 要點 #4
//
// --- ADMIN FLOW ---
//
// 5. Dashboard stat cards not clickable
//    Location: AdminFlow dashboard, grid cards
//    Fix: "待確認 N筆" → click navigates to orders tab with pending_confirm filter
//    "待出貨 N筆" → click navigates to shipments tab
//    Spec ref: whatwearebuilding.md UX Admin #1
//
// 6. Missing search bar in admin orders
//    Location: AdminFlow orders tab
//    Fix: Add search input above filter tabs (暱稱 / 電話 / 訂單編號)
//    Support real-time filtering as user types
//    Spec ref: whatwearebuilding.md UX Admin #2
//
// 7. Missing POS "代客下單" button
//    Location: AdminFlow orders tab
//    Fix: Add "+ 代客下單" button that opens inline order form
//    (product selection + customer info + pickup method)
//    After submit: order created as pending_payment
//    Then offer "已現場收款" for instant quick-confirm
//    Spec ref: whatwearebuilding.md Flow 7
//
// 8. Missing quick-confirm (POS cash payment)
//    Location: AdminFlow order detail
//    Fix: For pending_payment orders, add "已現場收款" button
//    that calls quick-confirm API (pending_payment → confirmed, skip pending_confirm)
//    Spec ref: whatwearebuilding.md Flow 7 step 4, claude.md quick-confirm API
//
// 9. Missing admin cancel with reason
//    Location: AdminFlow order detail (cancel button)
//    Fix: When admin clicks cancel, show dialog with optional reason textarea
//    Cancel should work from ANY status (not just pending_payment)
//    Sends cancellation notification (LINE + Email)
//    Spec ref: whatwearebuilding.md Flow 8
//
// 10. Shipments not grouped by pickup method
//     Location: AdminFlow shipments tab
//     Fix: Group confirmed orders into collapsible sections:
//     "宅配" section, "面交點A" section, "面交點B" section
//     Spec ref: whatwearebuilding.md Flow 5, UX Admin #3
//
// 11. Shipment button text should differentiate pickup method
//     Location: AdminFlow shipments tab, per-order confirm button
//     Fix: 宅配 orders → "確認寄出", 面交 orders → "確認取貨"
//     Both set status to shipped, but label differentiates for clarity
//     Spec ref: whatwearebuilding.md terminology, roadmap.md Phase 6
//
// 12. Missing print buttons
//     Location: AdminFlow order detail, shipments tab, dashboard
//     Fix: Add "列印出貨單" per order, "列印全部" on shipments page,
//     "列印理貨清單" on dashboard product aggregation
//     Use @media print CSS for print-optimized layout
//     Spec ref: whatwearebuilding.md Flow 10
//
// 13. Missing round history
//     Location: AdminFlow rounds tab
//     Fix: Show last 5 historical rounds below current round
//     Spec ref: whatwearebuilding.md Flow 11 step 4
//
// 14. Remove embedded SQL at bottom of file
//     The Supabase migration SQL duplicates schema from whatwearebuilding.md
//     and claude.md. Remove to eliminate drift risk.
//     Schema source of truth: whatwearebuilding.md + prisma/schema.prisma
//
// --- CROSS-CUTTING ---
//
// 15. NotificationType must include 'order_cancelled'
//     The notifTypeLabel map is correct (has all 4 types).
//     Ensure types/index.ts also includes order_cancelled.
//
// 16. Touch targets: Ensure all interactive elements ≥ 44px on mobile
//     Several buttons (filter tabs, checkbox areas) are smaller than 44px
//
// ============================================

// --- Suppliers ---

const mockSuppliers = [
  { id: "s1", name: "阿土伯有機農場", contact_name: "陳阿土", phone: "0911-111-111", email: "farmer@org.tw", note: "週二、五送貨" },
  { id: "s2", name: "海鮮王批發", contact_name: "林海", phone: "0922-222-222", email: "sea@fish.tw", note: "需提前3天下單" },
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

// --- Orders (covers 5 status variations + shipping/pickup/notification combos) ---

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
  {
    id: "ORD-20260315-005",
    nickname: "阿花",
    name: "張阿花",
    phone: "0945-678-901",
    address: "高雄市左營區博愛路30號",
    pickup: null,
    email: "flower@gmail.com",
    items: [{ name: "有機地瓜", qty: 2, price: 60 }],
    subtotal: 120,
    shipping_fee: 60,
    total: 180,
    status: "cancelled",
    payAmount: null,
    payLast5: null,
    paidAt: null,
    shippedAt: null,
    cancel_reason: "客戶要求取消",
    notif: [{ type: "order_cancelled", line: "success", email: "success" }],
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
  order_cancelled: "取消通知",
};

// ============================================
// Prototype UI Components (reference for building real pages)
// ============================================

import { useState, useCallback } from "react";

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
                          <div className="text-xs text-gray-500">{s.contact_name} ・ {s.phone}</div>
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
// Supabase Migration SQL — REMOVED
// ============================================
// Schema is defined in:
//   - whatwearebuilding.md (canonical DB schema tables)
//   - prisma/schema.prisma (Prisma models)
//   - prisma/migration.sql (full migration with RLS, triggers, views)
//
// Key fix needed in migration: notification_logs.type CHECK must include
// all 4 values: 'payment_confirmed', 'shipment', 'product_arrival', 'order_cancelled'
// (previously only had 3, missing order_cancelled)
