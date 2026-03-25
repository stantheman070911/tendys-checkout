ALTER TABLE users
  ADD COLUMN IF NOT EXISTS purchaser_name_lower TEXT,
  ADD COLUMN IF NOT EXISTS phone_digits TEXT,
  ADD COLUMN IF NOT EXISTS phone_last3 TEXT;

UPDATE users
SET
  purchaser_name_lower = LOWER(BTRIM(COALESCE(purchaser_name, ''))),
  phone_digits = REGEXP_REPLACE(COALESCE(phone, ''), '[^0-9]', '', 'g'),
  phone_last3 = RIGHT(REGEXP_REPLACE(COALESCE(phone, ''), '[^0-9]', '', 'g'), 3)
WHERE purchaser_name_lower IS NULL
   OR phone_digits IS NULL
   OR phone_last3 IS NULL;

CREATE INDEX IF NOT EXISTS idx_users_purchaser_name_lower_phone_last3
  ON users (purchaser_name_lower, phone_last3);
