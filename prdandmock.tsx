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
// 15. [RESOLVED] NotificationType now includes 'order_cancelled'
//     Fixed in types/index.ts, constants/index.ts, migration.sql,
//     lib/notifications/email.ts, and lib/notifications/send.ts.
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

import { useState, useEffect, useCallback, useRef } from "react";

const SUPP = [
  { id:"s1", name:"阿土伯有機農場", contact:"陳阿土", phone:"0911-111-111", email:"farmer@org.tw", note:"週二、五送貨" },
  { id:"s2", name:"海鮮王批發",     contact:"林海",   phone:"0922-222-222", email:"sea@fish.tw",  note:"需提前3天下單" },
];
const PRODS = [
  { id:1, name:"有機地瓜", price:60,  unit:"斤", stock:50, goal:30,   qty:22, sid:"s1" },
  { id:2, name:"空心菜",   price:35,  unit:"把", stock:40, goal:20,   qty:20, sid:"s1" },
  { id:3, name:"放山雞蛋", price:120, unit:"盒", stock:20, goal:15,   qty:8,  sid:"s1" },
  { id:4, name:"芭樂",     price:50,  unit:"斤", stock:0,  goal:25,   qty:25, sid:"s1" },
  { id:5, name:"鱸魚片",   price:180, unit:"份", stock:10, goal:null, qty:3,  sid:"s2" },
];
const ROUND_BASE = { id:"r1", name:"第12團：三月第三週", open:true, deadline:"2026-03-19T20:00:00+08:00" };
const PICKUP_POINTS = ["面交點A：中正路全家","面交點B：信義路麥當勞"];
const INIT_ORDERS = [
  { id:"ORD-001", nick:"小美",  name:"王小美", phone:"0912-345-678", addr:"台北市信義區松仁路100號",  pickup:null,              email:"mei@gmail.com",    items:[{n:"有機地瓜",q:3,p:60},{n:"放山雞蛋",q:2,p:120}], sub:420, fee:60,   total:480, status:"pending_confirm", paid:480,  last5:"12345", paidAt:"14:32", shipped:null, reason:null, notif:[{t:"payment_confirmed",L:1,E:1}] },
  { id:"ORD-002", nick:"阿明",  name:"李阿明", phone:"0923-456-789", addr:"新北市板橋區中山路50號",   pickup:null,              email:"ming@gmail.com",   items:[{n:"鱸魚片",q:1,p:180},{n:"空心菜",q:5,p:35}],    sub:355, fee:60,   total:415, status:"pending_payment", paid:null, last5:null,   paidAt:null,   shipped:null, reason:null, notif:[] },
  { id:"ORD-003", nick:"Jenny", name:"陳珍妮", phone:"0934-567-890", addr:"台中市西區民生路20號",     pickup:"面交點A：中正路全家", email:"jenny@gmail.com",  items:[{n:"芭樂",q:4,p:50}],                            sub:200, fee:null, total:200, status:"confirmed",       paid:200,  last5:"67890", paidAt:"10:15", shipped:null, reason:null, notif:[{t:"payment_confirmed",L:1,E:0}] },
  { id:"ORD-004", nick:"小美",  name:"王小美", phone:"0912-345-678", addr:"台北市信義區松仁路100號",  pickup:null,              email:"mei@gmail.com",    items:[{n:"空心菜",q:3,p:35}],                          sub:105, fee:60,   total:165, status:"shipped",          paid:165,  last5:"12345", paidAt:"09:20", shipped:"03/16 16:00", reason:null, notif:[{t:"payment_confirmed",L:1,E:1},{t:"shipment",L:1,E:1}] },
  { id:"ORD-005", nick:"阿花",  name:"張阿花", phone:"0945-678-901", addr:"高雄市左營區博愛路30號",   pickup:null,              email:"flower@gmail.com", items:[{n:"有機地瓜",q:2,p:60}],                        sub:120, fee:60,   total:180, status:"cancelled",        paid:null, last5:null,   paidAt:null,   shipped:null, reason:"客戶要求取消", notif:[{t:"order_cancelled",L:1,E:1}] },
];
const ST = {
  pending_payment: { label:"待付款",   cls:"bg-yellow-100 text-yellow-800" },
  pending_confirm: { label:"待確認",   cls:"bg-blue-100 text-blue-800" },
  partial:         { label:"部分付款", cls:"bg-orange-100 text-orange-800" },
  confirmed:       { label:"已確認",   cls:"bg-green-100 text-green-800" },
  shipped:         { label:"已出貨",   cls:"bg-purple-100 text-purple-800" },
  cancelled:       { label:"已取消",   cls:"bg-red-100 text-red-800" },
};

const Badge = ({ s }) => { const d=ST[s]||ST.pending_payment; return <span className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${d.cls}`}>{d.label}</span>; };

function ProgressBar({ cur, goal, unit }) {
  if (!goal) return null;
  const pct=Math.min(100,Math.round(cur/goal*100)), ok=cur>=goal;
  return (
    <div className="mt-1.5">
      <div className="flex justify-between text-xs mb-0.5">
        <span className={ok?"text-green-600 font-medium":"text-orange-500"}>{ok?"達標":`目標 ${goal}${unit}`}</span>
        <span className="text-gray-400">{cur}/{goal} ({pct}%)</span>
      </div>
      <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${ok?"bg-green-500":"bg-orange-400"}`} style={{width:`${pct}%`}}/>
      </div>
    </div>
  );
}

function DeadlineBanner({ roundFee }) {
  const dl=new Date(ROUND_BASE.deadline), diff=dl-new Date();
  const hrs=Math.max(0,Math.floor(diff/3600000)), mins=Math.max(0,Math.floor((diff%3600000)/60000));
  return ROUND_BASE.open ? (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-2.5 text-sm text-amber-800 text-center">
      <span className="font-medium">{ROUND_BASE.name}</span>　截止 {new Date(ROUND_BASE.deadline).toLocaleDateString("zh-TW")} {new Date(ROUND_BASE.deadline).toLocaleTimeString("zh-TW",{hour:"2-digit",minute:"2-digit"})}
      {hrs<48&&<span className="ml-2 text-red-600 font-bold">剩 {hrs}h {mins}m</span>}
    </div>
  ) : <div className="bg-red-50 border border-red-200 rounded-xl p-2.5 text-sm text-red-700 text-center font-medium">本團已截單</div>;
}

/* ── Lookup ─────────────────────────────────────────────────────── */
function Lookup({ onBack, orders }) {
  const [q,setQ]=useState(""), [res,setRes]=useState(null), [sel,setSel]=useState(null);
  const search=()=>{ const t=q.trim(); if(!t)return; setRes(orders.filter(o=>o.nick===t||o.id===t)); };
  if (sel) return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-gray-700 text-white p-3 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={()=>setSel(null)} className="text-xl leading-none">←</button>
        <span className="font-bold flex-1">訂單詳情</span><Badge s={sel.status}/>
      </header>
      <div className="max-w-lg mx-auto p-4 space-y-4">
        <div className="bg-white rounded-xl border p-4 space-y-3">
          <div><div className="font-bold">{sel.id}</div><div className="text-gray-500 text-sm">{sel.nick} ({sel.name}) · {sel.phone}</div></div>
          <div className="border-t pt-3 space-y-1 text-sm">
            {sel.items.map((i,idx)=><div key={idx} className="flex justify-between"><span>{i.n} ×{i.q}</span><span>${i.p*i.q}</span></div>)}
            {sel.fee>0&&<div className="flex justify-between text-blue-600"><span>運費</span><span>${sel.fee}</span></div>}
            <div className="border-t pt-1.5 font-bold flex justify-between"><span>合計</span><span>${sel.total}</span></div>
          </div>
          {sel.pickup&&<div className="text-sm text-purple-600 bg-purple-50 rounded-lg p-2">📍 {sel.pickup}</div>}
          {sel.shipped&&<div className="text-sm text-purple-600 bg-purple-50 rounded-lg p-2">📦 出貨：{sel.shipped}</div>}
          {sel.reason&&<div className="text-sm text-red-600 bg-red-50 rounded-lg p-2">取消：{sel.reason}</div>}
        </div>
        {sel.status==="pending_payment"&&<div className="flex gap-3">
          <button className="flex-1 bg-blue-600 text-white rounded-xl py-3 text-sm font-bold">前往匯款回報</button>
          <button className="flex-1 border-2 border-red-200 text-red-600 rounded-xl py-3 text-sm font-medium">取消訂單</button>
        </div>}
      </div>
    </div>
  );
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-gray-700 text-white p-3 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={onBack} className="text-xl leading-none">←</button>
        <span className="font-bold">訂單查詢</span>
      </header>
      <div className="max-w-lg mx-auto p-4 space-y-4">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-2.5 text-sm text-amber-800">輸入 LINE 暱稱或訂單編號。試「小美」</div>
        <div className="flex gap-2">
          <input value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>e.key==="Enter"&&search()} placeholder="LINE 暱稱 或 訂單編號" className="flex-1 border rounded-xl px-3 py-2.5 text-sm"/>
          <button onClick={search} className="bg-gray-800 text-white px-5 rounded-xl text-sm font-medium">查詢</button>
        </div>
        {res!==null&&res.length===0&&<div className="text-center py-10 text-gray-400">找不到相關訂單</div>}
        {res&&res.length>0&&<div className="space-y-2">
          <div className="text-xs text-gray-400">找到 {res.length} 筆，點擊查看詳情</div>
          {res.map(o=>(
            <div key={o.id} onClick={()=>setSel(o)} className="bg-white rounded-xl border p-3 cursor-pointer hover:border-gray-400 transition space-y-1.5">
              <div className="flex justify-between items-center"><div><span className="font-bold text-sm">{o.id}</span><span className="ml-2 text-gray-500 text-xs">{o.nick}</span></div><Badge s={o.status}/></div>
              <div className="text-xs text-gray-400">{o.items.map(i=>`${i.n}×${i.q}`).join("、")}</div>
              <div className="flex justify-between text-sm"><span>小計 ${o.sub}{o.fee?<span className="text-gray-400"> +${o.fee}運</span>:null}</span><span className="font-bold">合計 ${o.total}</span></div>
            </div>
          ))}
        </div>}
      </div>
    </div>
  );
}

/* ── User Flow ──────────────────────────────────────────────────── */
function UserFlow({ onBack, roundFee }) {
  const [step,setStep]=useState(0);
  const [cart,setCart]=useState({});
  const [nick,setNick]=useState(""), [found,setFound]=useState(false);
  const [info,setInfo]=useState({name:"",phone:"",addr:"",email:"",pickup:""});
  const [payAmt,setPayAmt]=useState(""), [payLast5,setPayLast5]=useState("");
  const [payConfirm,setPayConfirm]=useState(false);
  const [submitting,setSubmitting]=useState(false);

  const sub=Object.entries(cart).reduce((s,[id,q])=>{ const p=PRODS.find(x=>x.id===+id); return s+(p?p.price*q:0); },0);
  const fee=(!info.pickup&&roundFee)?roundFee:0;
  const total=sub+fee;
  const count=Object.values(cart).reduce((s,q)=>s+q,0);

  const add=id=>{ const p=PRODS.find(x=>x.id===id); if(!p||p.stock===0)return; setCart(c=>{ const cur=c[id]||0; if(p.stock&&cur>=p.stock)return c; return {...c,[id]:cur+1}; }); };
  const rem=id=>setCart(c=>({...c,[id]:Math.max(0,(c[id]||0)-1)}));
  const handleNick=v=>{ setNick(v); if(v==="小美"){setFound(true);setInfo({name:"王小美",phone:"0912-345-678",addr:"台北市信義區松仁路100號",email:"mei@gmail.com",pickup:""});}else{setFound(false);setInfo({name:"",phone:"",addr:"",email:"",pickup:""});} };

  if (step===0) return (
    <div className="min-h-screen bg-gray-50 pb-28">
      <header className="bg-green-700 text-white p-3 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={onBack} className="text-xl leading-none">←</button>
        <span className="font-bold flex-1 text-sm">{ROUND_BASE.name}</span>
      </header>
      <div className="max-w-lg mx-auto p-3 space-y-3">
        <DeadlineBanner roundFee={roundFee}/>
        <p className="text-xs text-center text-gray-400">宅配 +${roundFee} · 指定面交點免運費</p>
        {PRODS.map(p=>{
          const sold=p.stock===0, atMax=p.stock&&(cart[p.id]||0)>=p.stock;
          return (
            <div key={p.id} className={`bg-white rounded-xl border p-3 transition ${sold?"opacity-50":""}`}>
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-medium">{p.name}{sold&&<span className="ml-1.5 text-xs text-red-500 bg-red-50 px-1.5 py-0.5 rounded">已售完</span>}</div>
                  <div className="text-green-600 font-bold text-lg">${p.price}<span className="text-sm font-normal text-gray-400">/{p.unit}</span></div>
                  {p.stock&&!sold&&<div className="text-xs text-gray-400">庫存 {p.stock-(cart[p.id]||0)} {p.unit}</div>}
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={()=>rem(p.id)} disabled={sold||!(cart[p.id]>0)} className="w-9 h-9 rounded-full border-2 text-xl font-bold flex items-center justify-center disabled:opacity-20 hover:bg-gray-50">−</button>
                  <span className="w-7 text-center font-bold text-lg">{cart[p.id]||0}</span>
                  <button onClick={()=>add(p.id)} disabled={sold||atMax} className="w-9 h-9 rounded-full bg-green-600 text-white text-xl font-bold flex items-center justify-center disabled:opacity-20 hover:bg-green-700">+</button>
                </div>
              </div>
              <ProgressBar cur={p.qty+(cart[p.id]||0)} goal={p.goal} unit={p.unit}/>
              {atMax&&<p className="text-xs text-orange-500 mt-1">已達庫存上限</p>}
            </div>
          );
        })}
      </div>
      {count>0&&(
        <div className="fixed bottom-0 left-0 right-0 bg-green-700 text-white px-4 py-3 flex items-center justify-between shadow-2xl">
          <div>
            <span className="text-green-300 text-sm">{count} 件</span>
            <span className="font-bold text-2xl ml-2">${sub}</span>
            <span className="text-green-400 text-xs ml-2">宅配另加 ${roundFee}</span>
          </div>
          <button onClick={()=>setStep(1)} className="bg-white text-green-700 font-bold px-6 py-2.5 rounded-xl text-sm">結帳 →</button>
        </div>
      )}
    </div>
  );

  if (step===1) return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-green-700 text-white p-3 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={()=>setStep(0)} className="text-xl leading-none">←</button>
        <span className="font-bold">確認訂單</span>
      </header>
      <div className="max-w-lg mx-auto p-4 space-y-4">
        <div className="bg-white rounded-xl border p-4">
          <div className="font-medium text-gray-600 mb-2 text-sm">訂單明細</div>
          {Object.entries(cart).filter(([,q])=>q>0).map(([id,q])=>{ const p=PRODS.find(x=>x.id===+id); return <div key={id} className="flex justify-between text-sm py-0.5"><span>{p.name} ×{q}</span><span>${p.price*q}</span></div>; })}
          <div className="border-t mt-2 pt-2 space-y-1">
            <div className="flex justify-between text-sm text-gray-500"><span>商品小計</span><span>${sub}</span></div>
            {!info.pickup&&<div className="flex justify-between text-sm text-blue-600"><span>宅配運費</span><span>${roundFee}</span></div>}
            {info.pickup&&<div className="flex justify-between text-sm text-green-600"><span>面交免運</span><span>$0</span></div>}
            <div className="flex justify-between font-bold text-lg pt-1"><span>合計</span><span>${total}</span></div>
          </div>
        </div>
        <div className="bg-white rounded-xl border p-4 space-y-3">
          <div className="font-medium text-gray-600 text-sm">收貨資訊</div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">LINE 暱稱 <span className="text-gray-400">（輸入「小美」可自動帶入）</span></label>
            <div className="relative">
              <input value={nick} onChange={e=>handleNick(e.target.value)} placeholder="你在群組的暱稱" className={`w-full border rounded-xl px-3 py-2.5 text-sm pr-24 transition ${found?"border-green-400 bg-green-50":""}`}/>
              {found&&<span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-green-600 font-medium bg-green-100 px-2 py-0.5 rounded-full">已自動帶入</span>}
            </div>
          </div>
          {[["name","收貨人"],["phone","電話"],["email","Email"]].map(([f,l])=>(
            <div key={f}><label className="block text-xs text-gray-500 mb-1">{l}</label><input value={info[f]} onChange={e=>setInfo(p=>({...p,[f]:e.target.value}))} className="w-full border rounded-xl px-3 py-2.5 text-sm"/></div>
          ))}
          <div>
            <label className="block text-xs text-gray-500 mb-1">取貨方式</label>
            <select value={info.pickup} onChange={e=>setInfo(p=>({...p,pickup:e.target.value}))} className="w-full border rounded-xl px-3 py-2.5 text-sm bg-white">
              <option value="">宅配到府（+${roundFee} 運費）</option>
              {PICKUP_POINTS.map(pt=><option key={pt} value={pt}>{pt}（免運）</option>)}
            </select>
          </div>
          {!info.pickup&&(
            <div>
              <label className="block text-xs text-gray-500 mb-1">收貨地址</label>
              <input value={info.addr} onChange={e=>setInfo(p=>({...p,addr:e.target.value}))} placeholder="縣市、區、路、號" className="w-full border rounded-xl px-3 py-2.5 text-sm"/>
            </div>
          )}
        </div>
        <button onClick={()=>{ setSubmitting(true); setTimeout(()=>{ setStep(2); setSubmitting(false); },500); }} disabled={submitting||(!info.pickup&&!info.addr)} className="w-full bg-green-600 text-white rounded-xl py-4 font-bold text-lg disabled:opacity-50 hover:bg-green-700 transition">
          {submitting?"送出中…":`送出訂單 · $${total}`}
        </button>
        {!info.pickup&&!info.addr&&<p className="text-xs text-center text-gray-400">宅配請填寫收貨地址</p>}
      </div>
    </div>
  );

  if (step===2) return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-green-700 text-white p-3 sticky top-0 z-10"><span className="font-bold">訂單成立</span></header>
      <div className="max-w-lg mx-auto p-4 space-y-4">
        <div className="text-center py-4"><div className="text-5xl mb-2">✅</div><h2 className="font-bold text-xl">訂單已成立</h2><p className="text-gray-400 text-sm mt-1 font-mono">ORD-20260318-007</p></div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="font-bold text-blue-800 text-center mb-3 text-sm">匯款帳戶資訊</div>
          <div className="bg-white rounded-xl p-3 space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">銀行</span><span className="font-medium">中國信託 (822)</span></div>
            <div className="flex justify-between"><span className="text-gray-500">戶名</span><span className="font-medium">王大明</span></div>
            <div className="flex justify-between items-center"><span className="text-gray-500">帳號</span><span className="font-bold font-mono text-lg tracking-widest">1234-5678-9012</span></div>
            <div className="border-t pt-2">
              <div className="flex justify-between text-gray-400"><span>商品小計</span><span>${sub}</span></div>
              {fee>0&&<div className="flex justify-between text-blue-500"><span>宅配運費</span><span>${fee}</span></div>}
              {info.pickup&&<div className="flex justify-between text-green-600"><span>面交免運</span><span>$0</span></div>}
              <div className="flex justify-between font-bold text-green-700 text-2xl mt-1"><span>應付</span><span>${total}</span></div>
            </div>
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={()=>setStep(3)} className="flex-1 bg-blue-600 text-white rounded-xl py-3.5 font-bold">我已匯款，前往回報</button>
        </div>
        <div className="flex gap-3">
          <button onClick={()=>setStep(0)} className="flex-1 border-2 border-gray-200 rounded-xl py-2.5 text-sm font-medium text-gray-600">繼續選購</button>
          <button className="flex-1 border-2 border-red-100 text-red-500 rounded-xl py-2.5 text-sm">取消訂單</button>
        </div>
      </div>
    </div>
  );

  if (step===3&&!payConfirm) return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-green-700 text-white p-3 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={()=>setStep(2)} className="text-xl leading-none">←</button>
        <span className="font-bold">回報匯款</span>
      </header>
      <div className="max-w-lg mx-auto p-4 space-y-4">
        <div className="bg-gray-100 rounded-xl p-3 flex justify-between items-center text-sm">
          <span className="text-gray-500">ORD-20260318-007 · 應付</span>
          <span className="font-bold text-xl">${total}</span>
        </div>
        <div><label className="block text-sm font-medium text-gray-600 mb-1.5">匯款金額</label><input type="number" value={payAmt} onChange={e=>setPayAmt(e.target.value)} placeholder={String(total)} className="w-full border rounded-xl px-4 py-3.5 text-2xl font-bold" autoFocus/></div>
        <div><label className="block text-sm font-medium text-gray-600 mb-1.5">帳號後五碼</label><input maxLength={5} value={payLast5} onChange={e=>setPayLast5(e.target.value)} placeholder="56789" className="w-full border rounded-xl px-4 py-3.5 text-2xl font-bold tracking-widest"/></div>
        <button onClick={()=>setPayConfirm(true)} disabled={!payAmt||payLast5.length<5} className="w-full bg-green-600 text-white rounded-xl py-4 font-bold text-lg disabled:opacity-40">核對後確認送出 →</button>
      </div>
    </div>
  );

  if (step===3&&payConfirm) {
    const match=+payAmt===total;
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-green-700 text-white p-3 flex items-center gap-3 sticky top-0 z-10">
          <button onClick={()=>setPayConfirm(false)} className="text-xl leading-none">←</button>
          <span className="font-bold">確認送出</span>
        </header>
        <div className="max-w-lg mx-auto p-4 space-y-4">
          <div className={`rounded-xl p-4 border-2 ${match?"border-green-400 bg-green-50":"border-orange-300 bg-orange-50"}`}>
            <div className="font-bold text-center mb-3">{match?"✅ 金額吻合":"⚠️ 金額不符，請確認"}</div>
            <div className="space-y-2 text-sm bg-white rounded-xl p-3">
              <div className="flex justify-between"><span className="text-gray-500">訂單應付</span><span className="font-bold">${total}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">填寫匯款</span><span className={`font-bold ${match?"text-green-700":"text-orange-600"}`}>${payAmt}</span></div>
              <div className="flex justify-between border-t pt-2"><span className="text-gray-500">帳號後五碼</span><span className="font-bold font-mono tracking-widest">{payLast5}</span></div>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={()=>setPayConfirm(false)} className="flex-1 border-2 rounded-xl py-3 font-medium text-gray-600">← 修改</button>
            <button onClick={()=>setStep(4)} className="flex-1 bg-green-600 text-white rounded-xl py-3 font-bold">確認送出</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 text-center gap-6">
      <div className="text-5xl">⏳</div>
      <div><h2 className="font-bold text-xl">匯款回報完成</h2><p className="text-gray-400 text-sm mt-1">等待賣家確認，確認後收到 LINE + Email 通知</p></div>
      <div className="w-full max-w-sm bg-white rounded-xl border p-4 text-sm text-left space-y-2">
        <div className="flex justify-between"><span className="text-gray-400">訂單</span><span className="font-mono">ORD-20260318-007</span></div>
        <div className="flex justify-between"><span className="text-gray-400">狀態</span><span className="text-blue-600 font-medium">待確認</span></div>
        <div className="flex justify-between"><span className="text-gray-400">匯款</span><span>${payAmt||total}</span></div>
        <div className="flex justify-between"><span className="text-gray-400">後五碼</span><span className="font-mono tracking-widest">{payLast5}</span></div>
      </div>
      <div className="w-full max-w-sm space-y-2">
        <button onClick={()=>{ setStep(0); setCart({}); }} className="w-full bg-green-600 text-white rounded-xl py-3 font-bold">繼續選購</button>
        <button onClick={onBack} className="w-full border-2 rounded-xl py-3 text-sm text-gray-600">返回首頁</button>
      </div>
    </div>
  );
}

/* ── Cancel Dialog ──────────────────────────────────────────────── */
function CancelDialog({ order, onConfirm, onClose }) {
  const [reason,setReason]=useState("");
  const ref=useRef(null);
  useEffect(()=>{ ref.current?.focus(); },[]);
  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm p-5 space-y-4">
        <div className="font-bold text-lg">取消訂單</div>
        <div className="text-sm bg-gray-50 rounded-xl p-3 space-y-0.5">
          <div className="font-medium">{order.id} · {order.nick} ({order.name})</div>
          <div className="text-gray-500">{order.items.map(i=>`${i.n}×${i.q}`).join("、")}</div>
          <div className="font-bold text-lg">${order.total}</div>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">取消原因（選填）</label>
          <textarea ref={ref} value={reason} onChange={e=>setReason(e.target.value)} placeholder="例：客戶要求取消" className="w-full border rounded-xl px-3 py-2 text-sm h-20 resize-none"/>
        </div>
        <p className="text-xs text-gray-400">取消後自動發 LINE + Email 通知</p>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 border-2 rounded-xl py-2.5 font-medium text-gray-600">返回</button>
          <button onClick={()=>onConfirm(order.id,reason||"管理員取消")} className="flex-1 bg-red-600 text-white rounded-xl py-2.5 font-bold">確認取消</button>
        </div>
      </div>
    </div>
  );
}

/* ── POS Modal ──────────────────────────────────────────────────── */
function POSModal({ onClose, onSubmit, roundFee }) {
  const [data,setData]=useState({ nick:"", name:"", phone:"", pickup:"onsite", addr:"", fee:roundFee, items:{} });
  const nickRef=useRef(null);
  useEffect(()=>{ nickRef.current?.focus(); },[]);
  useEffect(()=>{ const h=e=>{ if(e.key==="Escape")onClose(); }; window.addEventListener("keydown",h); return ()=>window.removeEventListener("keydown",h); },[onClose]);

  const isDelivery = data.pickup === "delivery";
  const isOnsite   = data.pickup === "onsite";
  // 現場收款：no fee. 宅配：custom fee field. 面交點：0
  const displayFee = isDelivery ? (parseInt(data.fee)||0) : 0;
  const sub=Object.entries(data.items).reduce((s,[id,q])=>{ const p=PRODS.find(x=>x.id===+id); return s+(p?p.price*q:0); },0);
  const total=sub+displayFee;
  const valid=Object.values(data.items).some(q=>q>0)&&data.nick.trim()&&(!isDelivery||data.addr.trim());
  const setQty=(id,v)=>setData(p=>({...p,items:{...p.items,[id]:Math.max(0,parseInt(v)||0)}}));

  const handleSubmit=(quick)=>{
    const items=Object.entries(data.items).filter(([,q])=>q>0).map(([id,q])=>{ const p=PRODS.find(x=>x.id===+id); return {n:p.name,q:parseInt(q),p:p.price}; });
    if (!items.length||!data.nick.trim()) return;
    const itemSub=items.reduce((s,i)=>s+i.q*i.p,0);
    // 現場收款 = always no fee; 宅配 = roundFee; 面交 = 0
    const orderFee = (quick||!isDelivery) ? null : (parseInt(data.fee)||0);
    const orderTotal = itemSub + (orderFee||0);
    let pickupLabel = null;
    if (isOnsite)         pickupLabel = "現場取貨";
    else if (!isDelivery) pickupLabel = data.pickup; // named 面交 point
    onSubmit({
      nick:data.nick, name:data.name||data.nick, phone:data.phone||"—",
      addr:isDelivery?data.addr:"—",
      pickup:pickupLabel,
      items, sub:itemSub, fee:orderFee, total:orderTotal,
      quick
    });
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-md max-h-[92vh] flex flex-col">
        <div className="sticky top-0 bg-white border-b px-4 py-3 flex justify-between items-center rounded-t-2xl shrink-0">
          <span className="font-bold text-lg">代客下單 <span className="text-xs text-gray-400 font-normal">[Esc 關閉]</span></span>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400">✕</button>
        </div>
        <div className="overflow-y-auto p-4 space-y-4">
          {/* Customer info */}
          <div className="grid grid-cols-2 gap-2">
            <div className="col-span-2">
              <label className="block text-xs text-gray-500 mb-1">LINE 暱稱 *</label>
              <input ref={nickRef} value={data.nick} onChange={e=>setData(p=>({...p,nick:e.target.value}))} placeholder="暱稱" className="w-full border rounded-xl px-3 py-2.5 text-sm"/>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">姓名</label>
              <input value={data.name} onChange={e=>setData(p=>({...p,name:e.target.value}))} placeholder="收貨人" className="w-full border rounded-xl px-3 py-2 text-sm"/>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">電話</label>
              <input value={data.phone} onChange={e=>setData(p=>({...p,phone:e.target.value}))} placeholder="電話" className="w-full border rounded-xl px-3 py-2 text-sm"/>
            </div>
          </div>

          {/* Pickup method — 3 clear options */}
          <div>
            <label className="block text-xs text-gray-500 mb-1.5">取貨方式</label>
            <div className="grid grid-cols-3 gap-1.5 text-sm">
              {[
                ["onsite",   "現場取貨", "免運"],
                ["delivery", "宅配到府", `+$${roundFee}`],
                ...PICKUP_POINTS.map(pt=>[pt, pt.split("：")[0], "免運"]),
              ].map(([val,label,sub])=>(
                <button key={val} onClick={()=>setData(p=>({...p,pickup:val,addr:""}))}
                  className={`border-2 rounded-xl py-2 px-1 text-center transition ${data.pickup===val?"border-indigo-500 bg-indigo-50 text-indigo-700":"border-gray-200 text-gray-600 hover:border-gray-300"}`}>
                  <div className="font-medium text-xs">{label}</div>
                  <div className={`text-xs mt-0.5 ${data.pickup===val?"text-indigo-500":"text-gray-400"}`}>{sub}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Address + fee — only for delivery */}
          {isDelivery&&(
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">收貨地址 *</label>
                <input value={data.addr} onChange={e=>setData(p=>({...p,addr:e.target.value}))} placeholder="縣市、區、路、號" className="w-full border rounded-xl px-3 py-2.5 text-sm"/>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">宅配運費</label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-400">$</span>
                  <input type="number" min="0" value={data.fee} onChange={e=>setData(p=>({...p,fee:e.target.value}))} className="w-28 border rounded-xl px-3 py-2 text-sm font-bold"/>
                  {parseInt(data.fee)!==roundFee&&(
                    <button onClick={()=>setData(p=>({...p,fee:roundFee}))} className="text-xs text-gray-400 hover:text-blue-500 underline">還原預設 ${roundFee}</button>
                  )}
                </div>
                {parseInt(data.fee)!==roundFee&&<p className="text-xs text-orange-500 mt-1">預設運費 ${roundFee}，此單已手動調整</p>}
              </div>
            </div>
          )}

          {/* 現場收款 fee notice */}
          {isOnsite&&(
            <div className="bg-green-50 border border-green-200 rounded-xl p-2.5 text-xs text-green-700">
              現場取貨：客戶當面取貨，不計運費
            </div>
          )}

          {/* Products */}
          <div>
            <label className="block text-xs text-gray-500 mb-2">商品</label>
            <div className="space-y-2">
              {PRODS.filter(p=>p.stock>0).map(p=>(
                <div key={p.id} className="flex items-center gap-3 bg-gray-50 rounded-xl p-2.5">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">{p.name}</div>
                    <div className="text-xs text-gray-400">${p.price}/{p.unit}</div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button onClick={()=>setQty(p.id,(data.items[p.id]||0)-1)} className="w-8 h-8 rounded-full border bg-white text-lg flex items-center justify-center">−</button>
                    <input type="number" min="0" value={data.items[p.id]||""} onChange={e=>setQty(p.id,e.target.value)} placeholder="0" className="w-14 text-center border rounded-xl py-1.5 text-sm font-bold"/>
                    <button onClick={()=>setQty(p.id,(data.items[p.id]||0)+1)} className="w-8 h-8 rounded-full bg-indigo-600 text-white text-lg flex items-center justify-center">+</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Running total */}
          {sub>0&&(
            <div className="bg-gray-50 rounded-xl p-3 text-sm space-y-1">
              <div className="flex justify-between text-gray-500"><span>商品</span><span>${sub}</span></div>
              {isDelivery&&<div className="flex justify-between text-blue-600"><span>宅配運費</span><span>${roundFee}</span></div>}
              {!isDelivery&&<div className="flex justify-between text-green-600"><span>運費</span><span>免運</span></div>}
              <div className="flex justify-between font-bold text-xl border-t pt-1"><span>合計</span><span>${total}</span></div>
            </div>
          )}

          {/* Action buttons */}
          <button onClick={()=>handleSubmit(false)} disabled={!valid} className="w-full bg-indigo-600 text-white rounded-xl py-3 font-bold disabled:opacity-40">
            建立訂單（待付款）
          </button>
          {/* Quick-confirm only for non-delivery: customer is physically present */}
          {!isDelivery&&sub>0&&(
            <button onClick={()=>handleSubmit(true)} disabled={!valid} className="w-full border-2 border-green-500 text-green-700 rounded-xl py-2.5 font-bold disabled:opacity-40 text-sm">
              建立並現場收款 · ${sub}（免運費·直接確認）
            </button>
          )}
          {isDelivery&&sub>0&&(
            <p className="text-xs text-center text-gray-400">宅配訂單無法現場收款</p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Admin Flow ─────────────────────────────────────────────────── */
function AdminFlow({ onBack, roundFee, setRoundFee }) {
  const [orders,setOrders]=useState(INIT_ORDERS);
  const [tab,setTab]=useState("orders");
  const [filter,setFilter]=useState("all");
  const [search,setSearch]=useState("");
  const [expandedId,setExpandedId]=useState(null);
  const [batchSel,setBatchSel]=useState(new Set());
  const [shipBatchSel,setShipBatchSel]=useState(new Set());
  const [showPOS,setShowPOS]=useState(false);
  const [cancelTarget,setCancelTarget]=useState(null);
  const [arrivalSent,setArrivalSent]=useState(new Set());
  const [expandedProd,setExpandedProd]=useState(null);
  const [editingFee,setEditingFee]=useState(false);
  const [feeInput,setFeeInput]=useState(String(roundFee));
  const searchRef=useRef(null);

  useEffect(()=>{
    const TABS=["dashboard","orders","shipments","products","rounds","suppliers"];
    const h=e=>{
      if(["INPUT","TEXTAREA","SELECT"].includes(e.target.tagName))return;
      if(e.key==="/"){ e.preventDefault(); setTab("orders"); setTimeout(()=>searchRef.current?.focus(),50); }
      if(e.key==="n"||e.key==="N"){ e.preventDefault(); setShowPOS(true); }
      if(e.key==="Escape"){ setExpandedId(null); setBatchSel(new Set()); setShowPOS(false); }
      const n=parseInt(e.key); if(n>=1&&n<=6){ e.preventDefault(); setTab(TABS[n-1]); }
    };
    window.addEventListener("keydown",h); return ()=>window.removeEventListener("keydown",h);
  },[]);

  const filtered=orders.filter(o=>{
    if(filter!=="all"&&o.status!==filter)return false;
    const q=search.trim().toLowerCase(); if(!q)return true;
    return o.nick.toLowerCase().includes(q)||o.phone.includes(q)||o.id.toLowerCase().includes(q)||o.name.includes(q);
  });
  const pendingConfirm=orders.filter(o=>o.status==="pending_confirm");
  const confirmedOrders=orders.filter(o=>o.status==="confirmed");

  const confirmOrder  =id=>setOrders(p=>p.map(o=>o.id===id?{...o,status:"confirmed"}:o));
  const shipOrder     =id=>setOrders(p=>p.map(o=>o.id===id?{...o,status:"shipped",shipped:"03/18 18:00"}:o));
  const revertOrder   =id=>setOrders(p=>p.map(o=>o.id===id?{...o,status:"pending_payment"}:o));
  const markPartial   =id=>setOrders(p=>p.map(o=>o.id===id?{...o,status:"partial"}:o));
  const cancelOrder   =(id,reason)=>{ setOrders(p=>p.map(o=>o.id===id?{...o,status:"cancelled",reason}:o)); setExpandedId(null); };
  const batchConfirm  =()=>{ setOrders(p=>p.map(o=>batchSel.has(o.id)?{...o,status:"confirmed"}:o)); setBatchSel(new Set()); };
  const batchShip     =()=>{ setOrders(p=>p.map(o=>shipBatchSel.has(o.id)?{...o,status:"shipped",shipped:"03/18 18:00"}:o)); setShipBatchSel(new Set()); };
  const selectAllPending=()=>{ const ns=new Set(); pendingConfirm.forEach(o=>ns.add(o.id)); setBatchSel(ns); };

  const posSubmit=data=>{
    const {items,nick,name,phone,addr,pickup,sub,fee,total,quick}=data;
    setOrders(p=>[{
      id:`POS-${Date.now().toString().slice(-4)}`, nick, name, phone, addr,
      pickup:pickup||null, email:"", items, sub, fee, total,
      status:quick?"confirmed":"pending_payment",
      paid:quick?total:null, last5:null, paidAt:quick?"現場":null,
      shipped:null, reason:null, notif:[]
    },...p]);
    setShowPOS(false);
  };

  const saveFee=()=>{ const v=parseInt(feeInput); if(!isNaN(v)&&v>=0){ setRoundFee(v); } setEditingFee(false); };

  const itemAgg={};
  orders.filter(o=>o.status!=="cancelled").forEach(o=>o.items.forEach(i=>{ if(!itemAgg[i.n])itemAgg[i.n]={qty:0,rev:0}; itemAgg[i.n].qty+=i.q; itemAgg[i.n].rev+=i.q*i.p; }));
  const getCustomers=name=>{ const cs=[]; orders.filter(o=>o.status!=="cancelled").forEach(o=>o.items.forEach(i=>{ if(i.n===name)cs.push({nick:o.nick,name:o.name,phone:o.phone,qty:i.q,id:o.id}); })); return cs; };
  const deliveryOrders=confirmedOrders.filter(o=>!o.pickup);
  const pickupGroups=confirmedOrders.filter(o=>o.pickup).reduce((acc,o)=>{ acc[o.pickup]=acc[o.pickup]||[]; acc[o.pickup].push(o); return acc; },{});
  const sendArrival=name=>{ setArrivalSent(p=>new Set([...p,name])); setTimeout(()=>setArrivalSent(p=>{ const n=new Set(p); n.delete(name); return n; }),3000); };
  const TABS=[["dashboard","📊","儀表板"],["orders","📋","訂單"],["shipments","📦","出貨"],["products","🏷","商品"],["rounds","🔄","開團"],["suppliers","🏭","供應商"]];

  return (
    <div className="min-h-screen bg-gray-100">
      {cancelTarget&&<CancelDialog order={cancelTarget} onConfirm={(id,r)=>{cancelOrder(id,r);setCancelTarget(null);}} onClose={()=>setCancelTarget(null)}/>}
      {showPOS&&<POSModal onClose={()=>setShowPOS(false)} onSubmit={posSubmit} roundFee={roundFee}/>}

      {batchSel.size>0&&(
        <div className="fixed bottom-0 left-0 right-0 bg-indigo-700 text-white px-4 py-3 flex items-center justify-between z-40 shadow-2xl">
          <span className="font-medium text-sm">已選 <b>{batchSel.size}</b> 筆</span>
          <div className="flex gap-2">
            <button onClick={()=>setBatchSel(new Set())} className="px-3 py-1.5 border border-indigo-500 rounded-xl text-sm">清除 [Esc]</button>
            <button onClick={batchConfirm} className="px-4 py-1.5 bg-green-500 rounded-xl text-sm font-bold">批次確認付款</button>
          </div>
        </div>
      )}
      {shipBatchSel.size>0&&batchSel.size===0&&(
        <div className="fixed bottom-0 left-0 right-0 bg-purple-700 text-white px-4 py-3 flex items-center justify-between z-40 shadow-2xl">
          <span className="font-medium text-sm">已選 <b>{shipBatchSel.size}</b> 筆</span>
          <div className="flex gap-2">
            <button onClick={()=>setShipBatchSel(new Set())} className="px-3 py-1.5 border border-purple-500 rounded-xl text-sm">清除</button>
            <button onClick={batchShip} className="px-4 py-1.5 bg-white text-purple-700 rounded-xl text-sm font-bold">批次出貨</button>
          </div>
        </div>
      )}

      <header className="bg-indigo-700 text-white sticky top-0 z-20">
        <div className="max-w-2xl mx-auto px-3 pt-2 flex items-center gap-2">
          <button onClick={onBack} className="text-xl leading-none mr-1">←</button>
          <span className="font-bold text-sm flex-1">Admin 後台</span>
          <span className="text-xs text-indigo-300 hidden sm:block">/ 搜尋 · N 新增 · 1–6 切換</span>
          <button onClick={()=>setShowPOS(true)} className="bg-white text-indigo-700 px-3 py-1.5 rounded-xl text-sm font-bold shrink-0">+ 代客下單 [N]</button>
        </div>
        <div className="max-w-2xl mx-auto px-3 py-2 flex gap-1 overflow-x-auto">
          {TABS.map(([k,icon,label],i)=>(
            <button key={k} onClick={()=>setTab(k)} className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition ${tab===k?"bg-white text-indigo-700":"text-indigo-200 hover:bg-indigo-600"}`}>
              <span style={{fontSize:"12px"}}>{icon}</span> {label}
              {k==="orders"&&pendingConfirm.length>0&&<span className="bg-red-500 text-white rounded-full px-1.5 ml-0.5 text-xs leading-tight">{pendingConfirm.length}</span>}
              <span className={`text-xs ml-0.5 ${tab===k?"text-indigo-400":"text-indigo-500"}`}>[{i+1}]</span>
            </button>
          ))}
        </div>
      </header>

      <div className="max-w-2xl mx-auto p-3 space-y-3 pb-28">

        {/* DASHBOARD */}
        {tab==="dashboard"&&(
          <div className="space-y-3">
            <h3 className="font-bold text-gray-700 text-sm">{ROUND_BASE.name} · 宅配運費 ${roundFee}</h3>
            <div className="grid grid-cols-3 gap-2">
              {[
                ["總訂單",`${orders.length}`,null],
                ["總營收",`$${orders.filter(o=>o.status!=="cancelled").reduce((s,o)=>s+o.total,0)}`,null],
                ["待確認",`${pendingConfirm.length}`,()=>{setTab("orders");setFilter("pending_confirm");}],
                ["待付款",`${orders.filter(o=>o.status==="pending_payment").length}`,()=>{setTab("orders");setFilter("pending_payment");}],
                ["待出貨",`${confirmedOrders.length}`,()=>setTab("shipments")],
                ["已出貨",`${orders.filter(o=>o.status==="shipped").length}`,()=>{setTab("orders");setFilter("shipped");}],
              ].map(([l,v,fn],i)=>(
                <div key={i} onClick={fn||undefined} className={`bg-white rounded-xl border p-3 text-center transition ${fn?"cursor-pointer hover:border-indigo-400":""}`}>
                  <div className="text-xs text-gray-400 mb-0.5">{l}</div>
                  <div className="font-bold text-xl">{v}</div>
                  {fn&&<div className="text-xs text-indigo-400 mt-0.5">→</div>}
                </div>
              ))}
            </div>
            <div className="bg-white rounded-xl border p-4">
              <div className="font-medium text-sm mb-3 text-gray-700">商品需求彙總</div>
              {Object.entries(itemAgg).map(([name,d])=>{
                const p=PRODS.find(x=>x.name===name), sup=SUPP.find(s=>s.id===p?.sid), exp=expandedProd===name, customers=exp?getCustomers(name):[], sent=arrivalSent.has(name);
                return (
                  <div key={name} className="border-b last:border-0 py-2">
                    <div className="flex justify-between items-center">
                      <button onClick={()=>setExpandedProd(exp?null:name)} className="flex items-center gap-1 text-sm font-medium hover:text-indigo-600">
                        <span className="text-xs text-gray-400">{exp?"▼":"▶"}</span> {name}
                        {sup&&<span className="text-xs text-gray-400">({sup.name})</span>}
                      </button>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-indigo-600 text-sm">{d.qty}{p?.unit}</span>
                        <span className="text-xs text-gray-400">${d.rev}</span>
                        <button onClick={()=>sendArrival(name)} disabled={sent} className={`text-xs px-2 py-1 rounded-lg ${sent?"bg-green-100 text-green-700":"bg-orange-100 text-orange-700 hover:bg-orange-200"}`}>{sent?"✓ 通知":"📢"}</button>
                      </div>
                    </div>
                    {exp&&<div className="mt-2 ml-4 bg-gray-50 rounded-xl p-2.5 space-y-1">
                      {customers.map((c,i)=><div key={i} className="flex text-xs gap-2"><span className="w-12 font-medium">{c.nick}</span><span className="w-14">{c.name}</span><span className="flex-1 text-gray-400">{c.phone}</span><span className="font-bold text-indigo-600">{c.qty}{p?.unit}</span></div>)}
                    </div>}
                  </div>
                );
              })}
            </div>
            <div className="bg-white rounded-xl border p-4">
              <div className="font-medium text-sm mb-2 text-gray-700">通知狀態</div>
              {orders.filter(o=>o.notif?.length>0).map(o=>(
                <div key={o.id} className="flex justify-between items-center text-xs py-1.5 border-b last:border-0">
                  <span className="text-gray-500">{o.id} · {o.nick}</span>
                  <div className="flex gap-1">{o.notif.map((n,i)=>(
                    <span key={i} className="flex gap-0.5">
                      <span className={`px-1 py-0.5 rounded ${n.L?"bg-green-100 text-green-700":"bg-red-100 text-red-700"}`}>L{n.L?"✓":"✗"}</span>
                      <span className={`px-1 py-0.5 rounded ${n.E?"bg-green-100 text-green-700":"bg-red-100 text-red-700"}`}>E{n.E?"✓":"✗"}</span>
                    </span>
                  ))}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ORDERS */}
        {tab==="orders"&&(
          <div className="space-y-2">
            <div className="flex gap-2 items-center">
              <input ref={searchRef} value={search} onChange={e=>setSearch(e.target.value)} placeholder="搜尋 暱稱 / 電話 / 訂單號  [/]" className="flex-1 border rounded-xl px-3 py-2.5 text-sm"/>
              {search&&<button onClick={()=>setSearch("")} className="w-9 h-9 flex items-center justify-center border rounded-xl text-gray-400 hover:text-red-500">✕</button>}
            </div>
            <div className="flex gap-1.5 flex-wrap items-center">
              {["all","pending_payment","pending_confirm","confirmed","shipped","cancelled"].map(s=>(
                <button key={s} onClick={()=>setFilter(s)} className={`text-xs px-3 py-1.5 rounded-full transition ${filter===s?"bg-indigo-600 text-white":"bg-white border"}`}>
                  {s==="all"?"全部":ST[s]?.label}
                </button>
              ))}
              {pendingConfirm.length>0&&(filter==="all"||filter==="pending_confirm")&&(
                <button onClick={selectAllPending} className="text-xs px-3 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 ml-auto">全選待確認</button>
              )}
            </div>
            {filtered.length===0&&<div className="text-center py-10 text-gray-400">沒有符合的訂單</div>}
            {filtered.map(o=>{
              const exp=expandedId===o.id, amtOk=o.paid&&o.paid===o.total, amtOver=o.paid&&o.paid!==o.total;
              return (
                <div key={o.id} className={`bg-white rounded-xl border transition ${exp?"border-indigo-400 shadow-md":"hover:border-gray-300"}`}>
                  <div onClick={()=>setExpandedId(exp?null:o.id)} className="flex items-center gap-2 p-3 cursor-pointer select-none">
                    {(o.status==="pending_confirm"||o.status==="pending_payment")&&(
                      <input type="checkbox" checked={batchSel.has(o.id)} onChange={()=>setBatchSel(p=>{ const n=new Set(p); n.has(o.id)?n.delete(o.id):n.add(o.id); return n; })} onClick={e=>e.stopPropagation()} className="accent-indigo-600 w-4 h-4 shrink-0"/>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-xs text-gray-400">{o.id}</span>
                        <span className="font-semibold text-sm">{o.nick}</span>
                        {o.pickup&&<span className="text-xs text-purple-500 bg-purple-50 px-1.5 rounded">{o.pickup==="現場取貨"?"現場":"面交"}</span>}
                        {!o.pickup&&<span className="text-xs text-blue-400 bg-blue-50 px-1.5 rounded">宅配</span>}
                      </div>
                      <div className="text-xs text-gray-400 truncate">{o.items.map(i=>`${i.n}×${i.q}`).join("、")}</div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-bold text-sm">${o.total}</span>
                      <Badge s={o.status}/>
                      <span className="text-gray-300 text-xs">{exp?"▲":"▼"}</span>
                    </div>
                  </div>
                  {exp&&(
                    <div className="border-t px-3 pb-3 space-y-3">
                      <div className="pt-2 space-y-1 text-sm">
                        {o.items.map((i,idx)=><div key={idx} className="flex justify-between text-gray-600"><span>{i.n} ×{i.q}</span><span>${i.p*i.q}</span></div>)}
                        {o.fee>0&&<div className="flex justify-between text-blue-500"><span>宅配運費</span><span>${o.fee}</span></div>}
                        {o.pickup&&!o.fee&&<div className="flex justify-between text-green-500"><span>面交免運</span><span>$0</span></div>}
                        <div className="flex justify-between font-bold border-t pt-1"><span>合計</span><span>${o.total}</span></div>
                      </div>
                      {o.paid!=null&&(
                        <div className={`rounded-xl p-2.5 text-sm ${amtOk?"bg-green-50 border border-green-200":"bg-orange-50 border border-orange-200"}`}>
                          <div className="flex flex-wrap gap-4">
                            <span>{amtOk?"✅":"⚠️"} 匯款 <b>${o.paid}</b></span>
                            <span>後五碼 <b>{o.last5||"現場"}</b></span>
                            {o.paidAt&&<span className="text-gray-400">{o.paidAt}</span>}
                          </div>
                          {amtOver&&<div className="text-orange-700 text-xs mt-1">金額不符：訂單 ${o.total} ≠ 匯款 ${o.paid}</div>}
                        </div>
                      )}
                      <div className="text-xs text-gray-500 bg-gray-50 rounded-xl p-2.5 space-y-0.5">
                        <div><span className="font-medium">{o.name}</span> · {o.phone}</div>
                        {o.pickup?<div className="text-purple-600">📍 {o.pickup}</div>:<div className="text-blue-500">🚚 {o.addr}</div>}
                        {o.reason&&<div className="text-red-500 mt-0.5">{o.reason}</div>}
                        {o.shipped&&<div className="text-purple-600 mt-0.5">📦 {o.shipped}</div>}
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        {o.status==="pending_confirm"&&<>
                          <button onClick={()=>{confirmOrder(o.id);setExpandedId(null);}} className="flex-1 min-w-0 bg-green-600 text-white rounded-xl py-2.5 text-sm font-bold">✓ 確認付款</button>
                          <button onClick={()=>{revertOrder(o.id);setExpandedId(null);}} className="px-3 py-2.5 border rounded-xl text-sm text-gray-600" title="退回待付款">↩</button>
                          {amtOver&&<button onClick={()=>{markPartial(o.id);setExpandedId(null);}} className="px-3 py-2.5 bg-orange-100 text-orange-700 rounded-xl text-xs font-medium">部分</button>}
                          <button onClick={()=>setCancelTarget(o)} className="px-3 py-2.5 border border-red-200 rounded-xl text-sm text-red-500">✕</button>
                        </>}
                        {o.status==="pending_payment"&&<>
                          <button onClick={()=>{confirmOrder(o.id);setExpandedId(null);}} className="flex-1 bg-green-600 text-white rounded-xl py-2.5 text-sm font-bold">✓ 已現場收款</button>
                          <button onClick={()=>setCancelTarget(o)} className="px-3 py-2.5 border border-red-200 rounded-xl text-sm text-red-500">✕</button>
                        </>}
                        {o.status==="partial"&&<>
                          <button onClick={()=>{confirmOrder(o.id);setExpandedId(null);}} className="flex-1 bg-green-600 text-white rounded-xl py-2.5 text-sm font-bold">✓ 確認（尾款已收）</button>
                          <button onClick={()=>setCancelTarget(o)} className="px-3 py-2.5 border border-red-200 rounded-xl text-sm text-red-500">✕</button>
                        </>}
                        {o.status==="confirmed"&&<>
                          <button onClick={()=>{shipOrder(o.id);setExpandedId(null);}} className="flex-1 bg-purple-600 text-white rounded-xl py-2.5 text-sm font-bold">{o.pickup?"確認取貨 📍":"確認寄出 🚚"}</button>
                          <button onClick={()=>setCancelTarget(o)} className="px-3 py-2.5 border border-red-200 rounded-xl text-sm text-red-500">✕</button>
                        </>}
                        {o.status==="shipped"&&<span className="text-sm text-gray-400 py-2">出貨 {o.shipped}</span>}
                        {o.status==="cancelled"&&<span className="text-sm text-red-400 py-2">{o.reason}</span>}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* SHIPMENTS */}
        {tab==="shipments"&&(
          <div className="space-y-3">
            <div className="flex justify-between items-center"><h3 className="font-bold text-gray-700 text-sm">待出貨 ({confirmedOrders.length})</h3></div>
            {confirmedOrders.length===0&&<div className="text-center py-16 text-gray-400">目前沒有待出貨訂單</div>}
            {deliveryOrders.length>0&&(
              <div>
                <div className="text-xs font-bold text-gray-500 mb-2 flex items-center gap-2">🚚 宅配 <span className="bg-gray-200 rounded-full px-2 py-0.5">{deliveryOrders.length}</span></div>
                <div className="space-y-2">
                  {deliveryOrders.map(o=>(
                    <div key={o.id} className="bg-white rounded-xl border p-3 flex items-center gap-2">
                      <input type="checkbox" checked={shipBatchSel.has(o.id)} onChange={()=>setShipBatchSel(p=>{ const n=new Set(p); n.has(o.id)?n.delete(o.id):n.add(o.id); return n; })} className="accent-purple-600 w-4 h-4 shrink-0"/>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5"><span className="font-semibold text-sm">{o.nick}</span><span className="text-xs text-gray-400">{o.phone}</span></div>
                        <div className="text-xs text-gray-400 truncate">🏠 {o.addr}</div>
                        <div className="text-xs text-gray-400">{o.items.map(i=>`${i.n}×${i.q}`).join("、")}</div>
                      </div>
                      <div className="text-right shrink-0"><div className="font-bold">${o.total}</div><button onClick={()=>shipOrder(o.id)} className="mt-1 text-xs bg-purple-600 text-white px-3 py-1.5 rounded-lg">確認寄出</button></div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {Object.entries(pickupGroups).map(([pt,grp])=>(
              <div key={pt}>
                <div className="text-xs font-bold text-gray-500 mb-2 flex items-center gap-2">📍 {pt} <span className="bg-gray-200 rounded-full px-2 py-0.5">{grp.length}</span></div>
                <div className="space-y-2">
                  {grp.map(o=>(
                    <div key={o.id} className="bg-white rounded-xl border p-3 flex items-center gap-2">
                      <input type="checkbox" checked={shipBatchSel.has(o.id)} onChange={()=>setShipBatchSel(p=>{ const n=new Set(p); n.has(o.id)?n.delete(o.id):n.add(o.id); return n; })} className="accent-purple-600 w-4 h-4 shrink-0"/>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5"><span className="font-semibold text-sm">{o.nick}</span><span className="text-xs text-gray-400">{o.phone}</span></div>
                        <div className="text-xs text-gray-400">{o.items.map(i=>`${i.n}×${i.q}`).join("、")}</div>
                      </div>
                      <div className="text-right shrink-0"><div className="font-bold">${o.total}</div><button onClick={()=>shipOrder(o.id)} className="mt-1 text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg">確認取貨</button></div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* PRODUCTS */}
        {tab==="products"&&(
          <div className="space-y-3">
            <div className="flex justify-between items-center"><h3 className="font-bold text-gray-700 text-sm">商品管理</h3><button className="bg-indigo-600 text-white px-3 py-1.5 rounded-xl text-sm">+ 新增</button></div>
            {PRODS.map(p=>{ const sup=SUPP.find(s=>s.id===p.sid); return (
              <div key={p.id} className="bg-white rounded-xl border p-3">
                <div className="flex justify-between items-center">
                  <div><span className="font-medium">{p.name}</span><span className="text-gray-400 ml-2 text-sm">${p.price}/{p.unit}</span>{sup&&<span className="text-xs text-gray-400 ml-2">{sup.name}</span>}</div>
                  <div className="flex gap-2 items-center">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${p.stock===0?"bg-red-100 text-red-700":"bg-green-100 text-green-700"}`}>{p.stock===0?"售完":"上架"}</span>
                    <button className="text-xs text-gray-400 hover:text-blue-500">編輯</button>
                  </div>
                </div>
                <div className="flex gap-4 text-xs text-gray-400 mt-1"><span>庫存 {p.stock??"不限"}</span><span>目標 {p.goal||"—"}</span><span>已訂 {p.qty}</span></div>
                <ProgressBar cur={p.qty} goal={p.goal} unit={p.unit}/>
              </div>
            ); })}
          </div>
        )}

        {/* ROUNDS */}
        {tab==="rounds"&&(
          <div className="space-y-3">
            <h3 className="font-bold text-gray-700 text-sm">開團管理</h3>
            <div className="bg-white rounded-xl border p-4 space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-bold">{ROUND_BASE.name}</div>
                  <div className="text-xs text-gray-400 mt-0.5">截止 {new Date(ROUND_BASE.deadline).toLocaleString("zh-TW")}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-blue-500">宅配運費：</span>
                    {editingFee?(
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-gray-400">$</span>
                        <input type="number" min="0" value={feeInput} onChange={e=>setFeeInput(e.target.value)} onKeyDown={e=>{ if(e.key==="Enter")saveFee(); if(e.key==="Escape")setEditingFee(false); }} className="w-20 border rounded-lg px-2 py-1 text-sm font-bold" autoFocus/>
                        <button onClick={saveFee} className="text-xs bg-blue-600 text-white px-2.5 py-1 rounded-lg">儲存</button>
                        <button onClick={()=>setEditingFee(false)} className="text-xs text-gray-400">取消</button>
                      </div>
                    ):(
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-bold text-blue-600">${roundFee}</span>
                        <button onClick={()=>{ setFeeInput(String(roundFee)); setEditingFee(true); }} className="text-xs text-gray-400 hover:text-blue-500 underline">修改</button>
                      </div>
                    )}
                  </div>
                  {editingFee&&<p className="text-xs text-gray-400 mt-1">Enter 儲存 · Esc 取消 · 修改後立即生效於新訂單</p>}
                </div>
                <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700">開團中</span>
              </div>
              <div className="flex gap-2">
                <button className="flex-1 bg-red-600 text-white rounded-xl py-2 text-sm font-medium">截單</button>
                <button className="flex-1 border rounded-xl py-2 text-sm">改截止</button>
              </div>
            </div>
            <button className="w-full bg-indigo-600 text-white rounded-xl py-3 font-bold">+ 新開一團</button>
            <div className="bg-white rounded-xl border p-3">
              <div className="font-medium text-sm mb-2 text-gray-700">歷史記錄（最近 5 團）</div>
              {["第11團：三月第二週","第10團：三月第一週","第9團：二月第四週","第8團：二月第三週","第7團：二月第二週"].map((r,i)=>(
                <div key={i} className="flex justify-between text-sm text-gray-500 py-1.5 border-b last:border-0"><span>{r}</span><span className="text-xs text-gray-300">已截單</span></div>
              ))}
            </div>
          </div>
        )}

        {/* SUPPLIERS */}
        {tab==="suppliers"&&(
          <div className="space-y-3">
            <div className="flex justify-between items-center"><h3 className="font-bold text-gray-700 text-sm">供應商</h3><button className="bg-indigo-600 text-white px-3 py-1.5 rounded-xl text-sm">+ 新增</button></div>
            {SUPP.map(s=>{ const prods=PRODS.filter(p=>p.sid===s.id); return (
              <div key={s.id} className="bg-white rounded-xl border p-4 space-y-3">
                <div className="flex justify-between items-start">
                  <div><div className="font-bold">{s.name}</div><div className="text-xs text-gray-400">{s.contact} · {s.phone}</div>{s.note&&<div className="text-xs text-orange-500 mt-0.5">{s.note}</div>}</div>
                  <div className="flex gap-2 text-xs text-gray-400"><button className="hover:text-blue-500">編輯</button><button className="hover:text-red-500">刪除</button></div>
                </div>
                <div className="border-t pt-2 space-y-2">
                  {prods.map(p=>{ const agg=itemAgg[p.name], sent=arrivalSent.has(p.name); return (
                    <div key={p.id} className="flex justify-between items-center">
                      <span className="text-sm">{p.name} <span className="text-gray-400 text-xs">${p.price}/{p.unit}</span></span>
                      <div className="flex items-center gap-2">
                        {agg&&<span className="text-xs font-bold text-indigo-600">需{agg.qty}{p.unit}</span>}
                        <button onClick={()=>sendArrival(p.name)} disabled={sent} className={`text-xs px-2 py-1 rounded-lg ${sent?"bg-green-100 text-green-700":"bg-orange-100 text-orange-700"}`}>{sent?"✓":"📢 到貨"}</button>
                      </div>
                    </div>
                  ); })}
                </div>
              </div>
            ); })}
          </div>
        )}

      </div>
    </div>
  );
}

/* ── Root ───────────────────────────────────────────────────────── */
export default function App() {
  const [mode,setMode]=useState(null);
  const [roundFee,setRoundFee]=useState(60);
  const [orders]=useState(INIT_ORDERS);

  if (mode==="user")   return <UserFlow   onBack={()=>setMode(null)} roundFee={roundFee}/>;
  if (mode==="admin")  return <AdminFlow  onBack={()=>setMode(null)} roundFee={roundFee} setRoundFee={setRoundFee}/>;
  if (mode==="lookup") return <Lookup     onBack={()=>setMode(null)} orders={orders}/>;

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-sm w-full text-center space-y-3">
        <div className="text-4xl mb-1">🛒</div>
        <h1 className="text-2xl font-bold text-gray-800">生鮮團購系統</h1>
        <p className="text-gray-400 text-sm">v3.1 · 運費同步 · POS 修正版</p>
        <div className="space-y-2 pt-2">
          <button onClick={()=>setMode("user")}   className="w-full p-4 bg-green-600  text-white rounded-2xl text-base font-semibold hover:bg-green-700 transition">用戶端體驗</button>
          <button onClick={()=>setMode("admin")}  className="w-full p-4 bg-indigo-600 text-white rounded-2xl text-base font-semibold hover:bg-indigo-700 transition">Admin POS 後台</button>
          <button onClick={()=>setMode("lookup")} className="w-full p-4 bg-gray-700   text-white rounded-2xl text-base font-semibold hover:bg-gray-800 transition">訂單查詢</button>
        </div>
        <p className="text-xs text-gray-300 pt-1">目前宅配運費 <b className="text-gray-500">${roundFee}</b>（可在 Admin → 開團 修改）</p>
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
