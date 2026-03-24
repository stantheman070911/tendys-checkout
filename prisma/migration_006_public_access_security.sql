-- Harden public access and move user-facing order access to per-order codes

ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS access_code text;

UPDATE public.orders
SET access_code = upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12))
WHERE access_code IS NULL;

ALTER TABLE public.orders
ALTER COLUMN access_code SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'orders_access_code_key'
  ) THEN
    ALTER TABLE public.orders
    ADD CONSTRAINT orders_access_code_key UNIQUE (access_code);
  END IF;
END $$;

ALTER TABLE public.orders
DROP CONSTRAINT IF EXISTS orders_access_code_length_check;

ALTER TABLE public.orders
ADD CONSTRAINT orders_access_code_length_check
CHECK (length(access_code) = 12);

DROP POLICY IF EXISTS "Users select" ON public.users;
DROP POLICY IF EXISTS "Users insert" ON public.users;
DROP POLICY IF EXISTS "Users update" ON public.users;
DROP POLICY IF EXISTS "Orders select" ON public.orders;
DROP POLICY IF EXISTS "Orders insert" ON public.orders;
DROP POLICY IF EXISTS "Orders anon payment report" ON public.orders;
DROP POLICY IF EXISTS "Orders admin update" ON public.orders;
DROP POLICY IF EXISTS "Order items select" ON public.order_items;
DROP POLICY IF EXISTS "Order items insert" ON public.order_items;

CREATE POLICY "Users admin" ON public.users FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Orders admin" ON public.orders FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Order items admin" ON public.order_items FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');
