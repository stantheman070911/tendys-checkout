-- Migration: Add notification context columns + skipped status
-- Run this against existing databases after migration.sql and migration_002_line_push.sql

ALTER TABLE public.notification_logs
  ADD COLUMN IF NOT EXISTS round_id uuid REFERENCES public.rounds(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS product_id uuid REFERENCES public.products(id) ON DELETE CASCADE;

ALTER TABLE public.notification_logs
  DROP CONSTRAINT IF EXISTS notification_logs_status_check;

ALTER TABLE public.notification_logs
  ADD CONSTRAINT notification_logs_status_check
  CHECK (status in ('success', 'failed', 'skipped'));

CREATE INDEX IF NOT EXISTS idx_notification_logs_round_id
  ON public.notification_logs(round_id);

CREATE INDEX IF NOT EXISTS idx_notification_logs_product_id
  ON public.notification_logs(product_id);
