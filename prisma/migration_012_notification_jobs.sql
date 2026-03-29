-- Durable notification outbox

create table if not exists public.notification_jobs (
  id uuid default gen_random_uuid() primary key,
  order_id uuid references public.orders(id) on delete cascade,
  round_id uuid references public.rounds(id) on delete cascade,
  product_id uuid references public.products(id) on delete cascade,
  recipient text not null,
  channel text not null check (channel in ('line','email')),
  type text not null check (type in ('payment_confirmed','shipment','product_arrival','order_cancelled')),
  payload jsonb not null,
  dedupe_key text unique not null,
  status text not null default 'pending'
    check (status in ('pending','processing','sent','failed')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  max_attempts integer not null default 3 check (max_attempts >= 1),
  available_at timestamptz not null default now(),
  locked_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sent_at timestamptz
);

create index if not exists idx_notification_jobs_order_id
  on public.notification_jobs(order_id);
create index if not exists idx_notification_jobs_round_id
  on public.notification_jobs(round_id);
create index if not exists idx_notification_jobs_product_id
  on public.notification_jobs(product_id);
create index if not exists idx_notification_jobs_status_available_at
  on public.notification_jobs(status, available_at);
create index if not exists idx_notification_jobs_round_status_created_at
  on public.notification_jobs(round_id, status, created_at desc);

create trigger trg_notification_jobs_updated_at
  before update on public.notification_jobs
  for each row
  execute function public.handle_updated_at();

alter table public.notification_jobs enable row level security;

create policy "Notif jobs admin select" on public.notification_jobs for select
  using (auth.role() = 'authenticated');

create policy "Notif jobs admin insert" on public.notification_jobs for insert
  with check (auth.role() = 'authenticated');

create policy "Notif jobs admin update" on public.notification_jobs for update
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');
