-- ============================================
-- Supabase Migration SQL — 生鮮團購訂購系統 v2
-- Run in Supabase SQL Editor (Dashboard → SQL)
-- ============================================

-- 0. Rounds 開團表
create table public.rounds (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  is_open boolean not null default true,
  deadline timestamptz,
  shipping_fee integer,
  created_at timestamptz default now()
);

-- 1. Suppliers 供應商表
create table public.suppliers (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  contact_name text,
  phone text,
  email text,
  note text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2. Products 商品表
create table public.products (
  id uuid default gen_random_uuid() primary key,
  round_id uuid references public.rounds(id) on delete set null,
  supplier_id uuid references public.suppliers(id) on delete set null,
  name text not null,
  price integer not null check (price > 0),
  unit text not null default '份',
  is_active boolean not null default true,
  stock integer,
  goal_qty integer,
  image_url text,
  created_at timestamptz default now()
);

-- 3. Users 用戶表
create table public.users (
  id uuid default gen_random_uuid() primary key,
  nickname text unique not null,
  recipient_name text,
  phone text,
  address text,
  email text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 4. Orders 訂單表
create table public.orders (
  id uuid default gen_random_uuid() primary key,
  order_number text unique not null,
  user_id uuid references public.users(id) on delete set null,
  round_id uuid references public.rounds(id) on delete set null,
  total_amount integer not null default 0,
  shipping_fee integer,
  status text not null default 'pending_payment'
    check (status in ('pending_payment','pending_confirm','confirmed','shipped','cancelled')),
  payment_amount integer,
  payment_last5 text check (payment_last5 is null or length(payment_last5) = 5),
  payment_reported_at timestamptz,
  confirmed_at timestamptz,
  shipped_at timestamptz,
  note text,
  pickup_location text,
  cancel_reason text,
  submission_key uuid unique,
  line_user_id text,
  created_at timestamptz default now()
);

-- 5. Order Items 訂單明細表
create table public.order_items (
  id uuid default gen_random_uuid() primary key,
  order_id uuid references public.orders(id) on delete cascade not null,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  unit_price integer not null,
  quantity integer not null check (quantity > 0),
  subtotal integer not null
);

-- 6. Notification Logs 通知記錄表
create table public.notification_logs (
  id uuid default gen_random_uuid() primary key,
  order_id uuid references public.orders(id) on delete cascade,
  round_id uuid references public.rounds(id) on delete cascade,
  product_id uuid references public.products(id) on delete cascade,
  channel text not null check (channel in ('line','email')),
  type text not null check (type in ('payment_confirmed','shipment','product_arrival','order_cancelled')),
  status text not null check (status in ('success','failed','skipped')),
  error_message text,
  created_at timestamptz default now()
);

-- ============================================
-- Indexes (not on columns with UNIQUE constraint)
-- ============================================

create index idx_rounds_is_open on public.rounds(is_open);
create index idx_products_round_id on public.products(round_id);
create index idx_products_supplier_id on public.products(supplier_id);
create index idx_products_is_active on public.products(is_active);
create index idx_orders_status on public.orders(status);
create index idx_orders_user_id on public.orders(user_id);
create index idx_orders_round_id on public.orders(round_id);
create index idx_orders_created_at on public.orders(created_at desc);
create index idx_order_items_order_id on public.order_items(order_id);
create index idx_notification_logs_order_id on public.notification_logs(order_id);
create index idx_notification_logs_round_id on public.notification_logs(round_id);
create index idx_notification_logs_product_id on public.notification_logs(product_id);
create index idx_notification_logs_type on public.notification_logs(type);

-- ============================================
-- Triggers
-- ============================================

-- Auto-generate order number with advisory lock
create or replace function public.generate_order_number()
returns trigger as $$
declare
  today_str text;
  seq integer;
begin
  today_str := to_char(now() at time zone 'Asia/Taipei', 'YYYYMMDD');
  perform pg_advisory_xact_lock(hashtext('order_number_' || today_str));
  select count(*) + 1 into seq
  from public.orders
  where order_number like 'ORD-' || today_str || '-%';
  new.order_number := 'ORD-' || today_str || '-' || lpad(seq::text, 3, '0');
  return new;
end;
$$ language plpgsql;

create trigger trg_generate_order_number
  before insert on public.orders
  for each row
  when (new.order_number is null or new.order_number = '')
  execute function public.generate_order_number();

-- Auto-update updated_at (users + suppliers)
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_users_updated_at
  before update on public.users
  for each row
  execute function public.handle_updated_at();

create trigger trg_suppliers_updated_at
  before update on public.suppliers
  for each row
  execute function public.handle_updated_at();

-- ============================================
-- RLS Policies
-- ============================================

-- Rounds: read everyone, write admin
alter table public.rounds enable row level security;
create policy "Rounds select" on public.rounds for select using (true);
create policy "Rounds admin" on public.rounds for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- Suppliers: admin only
alter table public.suppliers enable row level security;
create policy "Suppliers admin select" on public.suppliers for select
  using (auth.role() = 'authenticated');
create policy "Suppliers admin write" on public.suppliers for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- Products: read everyone, write admin
alter table public.products enable row level security;
create policy "Products select" on public.products for select using (true);
create policy "Products admin" on public.products for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- Users: anyone read/create/update
alter table public.users enable row level security;
create policy "Users select" on public.users for select using (true);
create policy "Users insert" on public.users for insert with check (true);
create policy "Users update" on public.users for update using (true) with check (true);

-- Orders: read/create anyone, anon update only payment report, admin update all
alter table public.orders enable row level security;
create policy "Orders select" on public.orders for select using (true);
create policy "Orders insert" on public.orders for insert with check (true);
create policy "Orders anon payment report" on public.orders for update
  using (status = 'pending_payment')
  with check (
    status = 'pending_confirm'
    and payment_amount is not null
    and payment_last5 is not null
  );
create policy "Orders admin update" on public.orders for update
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- Order items: read/create anyone
alter table public.order_items enable row level security;
create policy "Order items select" on public.order_items for select using (true);
create policy "Order items insert" on public.order_items for insert with check (true);

-- Notification logs: admin only
alter table public.notification_logs enable row level security;
create policy "Notif logs admin select" on public.notification_logs for select
  using (auth.role() = 'authenticated');
create policy "Notif logs admin insert" on public.notification_logs for insert
  with check (auth.role() = 'authenticated');

-- ============================================
-- Helper Views
-- ============================================

-- Product progress (crowdfunding bar)
create or replace view public.product_progress as
select
  p.id as product_id,
  p.name,
  p.goal_qty,
  p.supplier_id,
  coalesce(sum(oi.quantity) filter (where o.id is not null), 0) as current_qty,
  case
    when p.goal_qty is null then null
    when p.goal_qty = 0 then 100
    else round((coalesce(sum(oi.quantity) filter (where o.id is not null), 0))::numeric / p.goal_qty * 100, 1)
  end as progress_pct
from public.products p
left join public.order_items oi on oi.product_id = p.id
left join public.orders o on o.id = oi.order_id and o.status != 'cancelled'
where p.is_active = true
group by p.id, p.name, p.goal_qty, p.supplier_id;

-- Orders by product (customer-per-item list)
create or replace view public.orders_by_product as
select
  oi.product_id,
  oi.product_name,
  u.nickname,
  u.recipient_name,
  u.phone,
  oi.quantity,
  oi.subtotal,
  o.order_number,
  o.status,
  o.pickup_location,
  o.round_id
from public.order_items oi
join public.orders o on o.id = oi.order_id and o.status != 'cancelled'
join public.users u on u.id = o.user_id
order by oi.product_name, u.nickname;
