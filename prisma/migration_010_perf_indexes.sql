CREATE INDEX IF NOT EXISTS idx_order_items_product_id
  ON public.order_items(product_id);

CREATE INDEX IF NOT EXISTS idx_users_purchaser_name_lower
  ON public.users (lower(purchaser_name));
