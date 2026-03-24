-- Remove per-order access codes after switching public access to
-- recipient_name + phone_last3.

ALTER TABLE public.orders
DROP CONSTRAINT IF EXISTS orders_access_code_key;

ALTER TABLE public.orders
DROP CONSTRAINT IF EXISTS orders_access_code_length_check;

ALTER TABLE public.orders
DROP COLUMN IF EXISTS access_code;
