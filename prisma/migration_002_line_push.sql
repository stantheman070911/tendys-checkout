-- Migration: Add LINE push notification support
-- Run this against your Supabase database after migration.sql

-- ─── Add line_user_id to orders ──────────────────────────────
ALTER TABLE orders ADD COLUMN line_user_id TEXT;
