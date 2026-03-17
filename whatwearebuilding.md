# 生鮮團購訂購系統 — MVP Spec 

小型生鮮團購的訂購 + 金流回報 + 出貨管理 + 供應商管理系統。
團主在 LINE 群組分享連結 → 用戶下單 + 匯款回報 → 團主確認付款 → 協調供應商到貨 → 確認出貨 + 通知。
內建類募資進度條，鼓勵揪團達標。

## 核心概念

- 取代 LINE 群組接龍 + Excel 手動記帳
- 用戶零註冊（暱稱識別，回訪自動帶入資料）
- 團購進度條（類 Kickstarter）驅動分享裂變
- Admin-only 登入，用戶端完全公開
- 完整訂單生命週期：下單 → 付款 → 確認 → 到貨通知 → 出貨

---

## 系統架構 Overview

```
LINE 群組貼文 (商品資訊 + Vercel 連結)
      ↓
用戶點連結 → Next.js 頁面（商品列表 + 進度條 + 購物車）
      ↓
送出訂單 → API Route（庫存檢查 + 運費計算 + submission_key 防重複）
      ↓
顯示銀行帳號 + 分享揪團 CTA
      ↓
用戶匯款 → 回報匯款（金額 + 帳號後五碼）
      ↓
Admin 後台 → 確認付款（單筆 / 批次）→ LINE + Email 通知
      ↓
Admin 供應商管理 → 商品到貨 → 通知相關客戶「已到達理貨中心」
      ↓
Admin 待出貨 → 確認寄出（單筆 / 批次）→ LINE + Email 出貨通知
```

### 四大模組

| 模組 | 職責 |
|------|------|
| User Storefront | 商品瀏覽、購物車、下單（含運費）、匯款回報、訂單查詢、揪團分享 |
| Admin Dashboard | 登入、儀表板、訂單管理（含批次確認）、CSV 匯出 |
| Shipment & Supplier | 待出貨管理、供應商管理、依商品分組檢視客戶、到貨/出貨通知 |
| Notification Layer | 付款確認 + 到貨通知 + 出貨通知，LINE Notify + Email，失敗記錄可查 |

---

## Tech Stack（已定案）

| Layer | Choice | 理由 |
|-------|--------|------|
| Framework | Next.js 14 (App Router) | 前後端一條龍，Vercel 部署最順 |
| Language | TypeScript | 型別安全，減少 runtime error |
| Styling | Tailwind CSS + shadcn/ui | 快速出 UI，mobile-first |
| Database | PostgreSQL via Supabase | 免費 tier 夠 MVP 用，內建 RLS |
| ORM | Prisma | Type-safe query，schema migration 方便 |
| Auth | Supabase Auth | Admin only（email/password），用戶端不需登入 |
| Hosting | Vercel | Serverless，免費 tier 足夠 |
| Email | Resend | 訂單確認 + 到貨 + 出貨通知信 |
| Notifications | LINE Notify | 簡單 POST API，不需 Messaging API 的複雜度 |

---

## User Flows

### Flow 1：用戶瀏覽 + 下單

1. 團主在 LINE 群組貼出連結（含 `?round=<id>`）
2. 用戶點開 → 看到本團商品列表，每個商品顯示：
   - 品名、單價、單位
   - 庫存剩餘（即時）
   - **團購進度條**（目前已訂 / 目標量，百分比）
   - 已達標商品顯示 🎉，未達標顯示橘色進度條
3. 用戶用 +/- 按鈕加入購物車（庫存上限檢查，到上限後 + 按鈕 disabled）
4. 底部浮動購物車欄顯示件數 + 金額 → 點「下一步」
5. 填寫資料頁：
   - LINE 暱稱（輸入後自動查詢：舊用戶 → 帶入姓名/電話/地址/Email；新用戶 → 手動填）
   - 收貨人姓名、電話、地址、Email
   - 取貨方式（宅配 / 面交點 A / 面交點 B）
   - **若選宅配 → 顯示「宅配到以上地址，運費 $XXX」**（金額由 Admin 在開團時設定）
   - 訂單摘要（品項 + 小計 + 運費 + 合計）
6. 點「送出訂單」→ 按鈕立即 disabled 防重複（client-side `submission_key`）
7. Server 驗證庫存 → 計算運費（宅配才加）→ 原子扣庫存 → 建立訂單 + 明細 → 回傳訂單資料

### Flow 2：匯款 + 回報

1. 訂單成立頁顯示：
   - 銀行帳號（銀行名、戶名、帳號、應付金額 — 含運費）
   - **分享揪團 CTA**（若有商品未達標）：複製連結按鈕 + LINE 分享按鈕
   - 「取消訂單」按鈕（僅 `pending_payment` 狀態可用）
2. 用戶匯款後 → 點「回報匯款」→ 填寫匯款金額 + 帳號後五碼 → 送出
3. 訂單狀態：`pending_payment` → `pending_confirm`
4. 等待確認頁顯示：訂單摘要 + 狀態 + 再次顯示分享揪團 CTA

### Flow 3：訂單查詢

1. 用戶進入 `/lookup` 頁面
2. 輸入 LINE 暱稱或訂單編號
3. 顯示匹配的所有訂單（含歷史），每筆顯示：
   - 訂單編號、狀態 badge、品項摘要、金額（含運費明細）
   - `pending_payment` 訂單可操作：前往匯款回報 / 取消訂單

### Flow 4：Admin 確認付款

1. Admin 登入（Supabase Auth，email/password）
2. 儀表板顯示：
   - 本團摘要（總訂單數、總營收、待確認數、待付款數、待出貨數）
   - **商品需求彙總**（供貨商採購用）：每個商品的總訂量 + 金額 + 供應商名稱
   - 通知發送狀態（每筆訂單的 LINE ✓/✗ + Email ✓/✗，按通知類型分類）
3. 訂單管理：
   - 篩選（全部 / 待付款 / 待確認 / 已確認 / 待出貨 / 已出貨 / 已取消）
   - 待確認訂單可勾選 → 批次確認
   - 點擊單筆訂單 → 查看明細 + 匯款資訊 + 金額比對 → 確認 or 取消
   - CSV 匯出
4. 確認後：
   - 訂單狀態 → `confirmed`，寫入 `confirmed_at`
   - 發送 LINE Notify + Resend Email（付款確認通知）
   - 記錄至 `notification_logs`（type: `payment_confirmed`）

### Flow 5：Admin 出貨管理（待出貨頁）

1. 待出貨頁列出所有 `confirmed` 狀態的訂單
2. 支援篩選、搜尋（by 暱稱 / 訂單編號）
3. 每筆顯示：訂單編號、收貨人、電話、地址/取貨點、品項、金額
4. 單筆確認寄出 or 勾選多筆 → 批次確認寄出
5. 確認寄出後：
   - 訂單狀態 → `shipped`，寫入 `shipped_at`
   - 發送 LINE Notify + Resend Email（出貨通知）
   - 記錄至 `notification_logs`（type: `shipment`）

### Flow 6：Admin 供應商管理

1. 供應商列表：名稱、聯絡人、電話、Email、關聯商品數
2. 新增 / 編輯 / 刪除供應商
3. 商品管理中，每個商品可關聯一個供應商
4. **依商品分組檢視客戶**：
   - 在儀表板的商品需求彙總 or 供應商管理頁，點擊某商品（例如「有機地瓜」）
   - 展開顯示：所有訂購該商品的客戶列表（暱稱、收貨人、電話、數量、訂單編號）
   - 用途：理貨分裝時，知道每個客戶要幾斤地瓜
5. **到貨通知**：
   - 在供應商管理頁或商品需求彙總，每個商品旁有「通知到貨」按鈕
   - 點擊後 → 系統找出本團所有訂購該商品的客戶（非取消訂單）
   - 發送 LINE Notify + Resend Email：「您訂購的【有機地瓜】已到達理貨中心，我們會盡快安排出貨！」
   - 記錄至 `notification_logs`（type: `product_arrival`）

### Flow 7：Admin 商品 + 開團管理

1. 商品管理：新增 / 編輯 / 上下架 / 設定庫存 + 目標數量 + 圖片 URL + **關聯供應商**
2. 開團管理：新開一團（名稱 + 截止時間 + **運費金額**）/ 立即截單 / 修改截止時間 / 修改運費
3. 截單後用戶端顯示「🚫 本團已截單」，無法新增訂單

---

## Database Schema

### `rounds`

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| name | TEXT | e.g., "第 12 團：三月第三週" |
| is_open | BOOLEAN | default `true` |
| deadline | TIMESTAMPTZ | nullable |
| shipping_fee | INTEGER | nullable，null = 免運 or 僅面交。宅配時加到訂單總額 |
| created_at | TIMESTAMPTZ | |

### `suppliers`

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| name | TEXT | 供應商名稱 |
| contact_name | TEXT | nullable，聯絡人 |
| phone | TEXT | nullable |
| email | TEXT | nullable |
| note | TEXT | nullable，備註 |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | auto-update trigger |

### `products`

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| round_id | UUID | FK → rounds.id, nullable |
| supplier_id | UUID | FK → suppliers.id, nullable |
| name | TEXT | 品名 |
| price | INTEGER | 單價（台幣） |
| unit | TEXT | "斤" / "盒" / "把" / "份" / "包" |
| is_active | BOOLEAN | default `true` |
| stock | INTEGER | nullable（null = 不限） |
| goal_qty | INTEGER | nullable，團購目標數量（進度條用） |
| image_url | TEXT | nullable |
| created_at | TIMESTAMPTZ | |

### `users`

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| nickname | TEXT | UNIQUE，LINE 暱稱作為識別 |
| recipient_name | TEXT | 收貨人姓名 |
| phone | TEXT | |
| address | TEXT | |
| email | TEXT | |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | auto-update trigger |

### `orders`

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| order_number | TEXT | UNIQUE, trigger-generated `ORD-YYYYMMDD-NNN` |
| user_id | UUID | FK → users.id |
| round_id | UUID | FK → rounds.id, nullable |
| total_amount | INTEGER | 訂單總金額（含運費） |
| shipping_fee | INTEGER | nullable，快照。宅配 = round.shipping_fee，面交 = null |
| status | TEXT | `pending_payment` / `pending_confirm` / `confirmed` / `shipped` / `cancelled` |
| payment_amount | INTEGER | 用戶回報的匯款金額 |
| payment_last5 | TEXT | 匯款帳號後五碼（len = 5） |
| payment_reported_at | TIMESTAMPTZ | |
| confirmed_at | TIMESTAMPTZ | |
| shipped_at | TIMESTAMPTZ | 確認寄出時間 |
| note | TEXT | nullable |
| pickup_location | TEXT | nullable，取貨點 |
| submission_key | UUID | UNIQUE，防重複提交 |
| created_at | TIMESTAMPTZ | |

### `order_items`

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| order_id | UUID | FK → orders.id, CASCADE |
| product_id | UUID | FK → products.id, SET NULL |
| product_name | TEXT | 快照 |
| unit_price | INTEGER | 快照 |
| quantity | INTEGER | check > 0 |
| subtotal | INTEGER | unit_price × quantity |

### `notification_logs`

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| order_id | UUID | FK → orders.id, CASCADE, **nullable** |
| channel | TEXT | `line` / `email` |
| type | TEXT | `payment_confirmed` / `shipment` / `product_arrival` |
| status | TEXT | `success` / `failed` |
| error_message | TEXT | nullable |
| created_at | TIMESTAMPTZ | |

### Helper View: `product_progress`

```sql
SELECT
  p.id, p.name, p.goal_qty, p.supplier_id,
  COALESCE(SUM(oi.quantity), 0) AS current_qty,
  ROUND(COALESCE(SUM(oi.quantity), 0)::numeric / NULLIF(p.goal_qty, 0) * 100, 1) AS progress_pct
FROM products p
LEFT JOIN order_items oi ON oi.product_id = p.id
LEFT JOIN orders o ON o.id = oi.order_id AND o.status != 'cancelled'
WHERE p.is_active = true
GROUP BY p.id;
```

### Helper View: `orders_by_product`

```sql
SELECT
  oi.product_id,
  oi.product_name,
  u.nickname,
  u.recipient_name,
  u.phone,
  oi.quantity,
  oi.subtotal,
  o.order_number,
  o.status,
  o.pickup_location
FROM order_items oi
JOIN orders o ON o.id = oi.order_id AND o.status != 'cancelled'
JOIN users u ON u.id = o.user_id
ORDER BY oi.product_name, u.nickname;
```

---

## 訂單狀態流

```
pending_payment ──用戶回報匯款──→ pending_confirm ──Admin確認付款──→ confirmed ──Admin確認寄出──→ shipped
       │                                                                                        ↓
       │                                                                              LINE Notify + Email
       │                                                                              (出貨通知)
       ↓
  用戶自行取消 → cancelled
  Admin 手動取消 → cancelled（任何狀態皆可）
```

### 通知類型

| 觸發時機 | type | 內容 |
|----------|------|------|
| Admin 確認付款 | `payment_confirmed` | 「訂單已確認，我們會盡快安排出貨」 |
| Admin 點「通知到貨」 | `product_arrival` | 「您訂購的【有機地瓜】已到達理貨中心」 |
| Admin 確認寄出 | `shipment` | 「訂單已出貨 / 已備妥可取貨」 |

---

## 團購進度條（類募資功能）

### 機制

- Admin 在商品管理設定 `goal_qty`（目標訂購量）
- `product_progress` view 即時計算 `current_qty`（排除已取消訂單）
- 用戶端每個商品卡片顯示進度條：
  - 未達標 → 橘色進度條 + "目標 30 斤" + "22/30 斤 (73%)"
  - 已達標 → 綠色進度條 + "🎉 已達標！"
  - 無目標 → 不顯示進度條
- 用戶加入購物車時，進度條即時更新（本地 optimistic：`current_qty + cart_qty`）

### 分享揪團 CTA

當任一商品未達標時，以下位置顯示分享面板：

| 位置 | 時機 |
|------|------|
| 商品列表頁底部 | 瀏覽時 |
| 訂單成立頁 | 下單後 |
| 匯款回報完成頁 | 回報後 |

面板內容：
- 標題：「🔥 幫忙揪團，一起達標！」
- 說明：「有些商品還沒達到開團目標，分享給朋友一起買更划算」
- 「📋 複製連結」按鈕 → `navigator.clipboard.writeText(url)`
- 「💬 分享到 LINE」按鈕 → LINE Social Plugin share URL
- 顯示完整連結供手動複製

---

## 運費機制

### Admin 設定

- 開團時設定 `shipping_fee`（整數，台幣）
- 可在開團管理頁修改（不影響已成立的訂單）
- 設為 null 或 0 = 免運

### 用戶端顯示

- 結帳頁取貨方式選擇：
  - 選「宅配到以上地址」→ 顯示 **「宅配到以上地址，運費 $XXX」**
  - 選面交點 → 不顯示運費
- 訂單摘要：品項小計 + 運費（如有）= 合計
- 訂單成立頁的應付金額 = 含運費的合計

### 資料處理

- `submit-order` API：
  - 若 `pickup_location` 為空（宅配）且 `round.shipping_fee > 0` → `order.shipping_fee = round.shipping_fee`，`order.total_amount += shipping_fee`
  - 若有 `pickup_location`（面交）→ `order.shipping_fee = null`
- **快照原則**：`order.shipping_fee` 記錄下單當時的運費，日後修改 round 運費不影響既有訂單

---

## 關鍵工程細節

### 庫存原子扣減

```sql
UPDATE products SET stock = stock - $qty WHERE id = $id AND stock >= $qty RETURNING *;
```

任一品項庫存不足 → 整筆訂單 transaction rollback。

### 防重複提交（submission_key）

1. Client 在結帳頁 mount 時生成 `crypto.randomUUID()`
2. 送出時一併傳 `submission_key`
3. Server: `INSERT ... ON CONFLICT (submission_key) DO NOTHING`
4. 影響行數 = 0 → 查詢既有訂單 → 回傳給 client
5. Client 不論新建或重複，都導向同一訂單確認頁

### 訂單編號生成（advisory lock）

```sql
CREATE FUNCTION generate_order_number() RETURNS trigger AS $$
DECLARE today_str text; seq integer;
BEGIN
  today_str := to_char(now() AT TIME ZONE 'Asia/Taipei', 'YYYYMMDD');
  PERFORM pg_advisory_xact_lock(hashtext('order_number_' || today_str));
  SELECT count(*) + 1 INTO seq FROM orders WHERE order_number LIKE 'ORD-' || today_str || '-%';
  NEW.order_number := 'ORD-' || today_str || '-' || lpad(seq::text, 3, '0');
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
```

### RLS 重點

| 風險 | 防護 |
|------|------|
| 匿名用戶修改他人訂單 | `orders` UPDATE policy constrains `using` AND `with check` |
| 匿名用戶讀取通知/供應商 | `notification_logs` + `suppliers` 僅 authenticated |
| 匿名用戶修改商品/團次 | `products` + `rounds` 寫入限 authenticated |

### LINE Notify

```
POST https://notify-api.line.me/api/notify
Authorization: Bearer <LINE_NOTIFY_TOKEN>
Content-Type: application/x-www-form-urlencoded
message=...
```

一個 token 對應一個群組或 1:1。完全免費。

### Email 模板（3 種）

| type | Subject | Content |
|------|---------|---------|
| `payment_confirmed` | 訂單確認 — ORD-XXX | 收貨人、明細、合計（含運費）、取貨方式 |
| `product_arrival` | 商品到貨通知 | 「您訂購的【商品名】已到達理貨中心，我們會盡快安排出貨！」 |
| `shipment` | 出貨通知 — ORD-XXX | 「您的訂單已出貨 / 已備妥可至取貨點領取」+ 明細 |

Plain HTML templates，不需 React Email。

---

## 依商品分組檢視（供理貨 + 供應商協調用）

### 使用場景

團主收到供應商送來的有機地瓜，需要知道：
1. 總共要幾斤地瓜？（商品需求彙總已有）
2. 每個客戶要幾斤？（需要展開明細）
3. 這些客戶的聯絡方式？（理貨通知用）

### 實作方式

- `orders_by_product` view 提供原始資料
- Admin 在儀表板商品需求彙總 or 供應商管理頁，點擊商品名稱
- 展開顯示該商品的所有客戶：暱稱、收貨人、電話、數量、訂單編號、出貨狀態
- 可作為理貨分裝的對照清單
- 搭配「通知到貨」按鈕，一鍵通知所有相關客戶

---

## 成本估算（MVP 階段）

假設：1 個團主，每團 30-50 筆訂單，每週一團

| 項目 | 估算 |
|------|------|
| Vercel | Free tier（Hobby）足夠 |
| Supabase | Free tier（500MB DB）足夠 |
| Resend | Free tier（100 emails/日）足夠 |
| LINE Notify | 完全免費 |
| **總計** | **$0/月** |

---

## MVP Scope

### 包含（Phase 1）

- [x] 用戶端：商品列表 + 進度條 + 購物車 + 結帳（含運費）
- [x] 用戶端：訂單確認 + 銀行帳號 + 匯款回報
- [x] 用戶端：訂單查詢 + 歷史
- [x] 用戶端：取消訂單（pending_payment only）
- [x] 用戶端：分享揪團 CTA
- [x] 用戶端：截止時間倒數 + 已截單提示
- [x] Admin：登入（Supabase Auth）
- [x] Admin：儀表板（摘要 + 商品需求彙總 with 供應商 + 通知狀態）
- [x] Admin：訂單管理（篩選 + 單筆/批次確認 + CSV 匯出）
- [x] Admin：待出貨管理（列表 + 單筆/批次確認寄出 + 出貨通知）
- [x] Admin：商品管理（CRUD + 庫存 + 目標 + 圖片 + 供應商關聯）
- [x] Admin：開團管理（開團/截單/截止時間/運費設定）
- [x] Admin：供應商管理（CRUD + 依商品分組檢視客戶 + 到貨通知）
- [x] 通知：3 種類型（付款確認 + 到貨 + 出貨）× 2 通道（LINE + Email）
- [x] 安全：RLS + stock atomic + submission_key + advisory lock
- [x] 取貨方式 + 運費計算

### 排除（Phase 2+）

- [ ] LINE LIFF 整合（用戶身份綁定）
- [ ] 線上金流（信用卡 / LINE Pay）
- [ ] 用戶端訂單修改（目前只能取消重下）
- [ ] 團次歷史歸檔 + 跨團報表
- [ ] 供貨商自動下單串接
- [ ] 多團主 / 多組織支援
- [ ] 商品圖片上傳（目前僅 URL）
- [ ] Push 通知提醒未付款用戶
- [ ] 物流追蹤串接
- [ ] Rate limiting
- [ ] i18n