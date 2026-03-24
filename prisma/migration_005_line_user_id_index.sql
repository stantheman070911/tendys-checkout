-- Add index on orders.line_user_id for LINE webhook message lookups
CREATE INDEX IF NOT EXISTS idx_orders_line_user_id ON orders (line_user_id);
