-- migration_004_single_open_round.sql
-- Enforce at most one open round at the database level.
-- The partial unique index allows any number of rows with is_open = false
-- but only one row with is_open = true.

CREATE UNIQUE INDEX IF NOT EXISTS idx_rounds_single_open
  ON rounds (is_open)
  WHERE is_open = true;
