ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS purchaser_name text;

UPDATE public.users
SET purchaser_name = COALESCE(NULLIF(BTRIM(purchaser_name), ''), recipient_name)
WHERE purchaser_name IS NULL OR BTRIM(purchaser_name) = '';

CREATE TABLE IF NOT EXISTS public.saved_checkout_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nickname text NOT NULL UNIQUE,
  purchaser_name text,
  recipient_name text,
  phone text NOT NULL,
  address text,
  email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.saved_checkout_profiles (
  nickname,
  purchaser_name,
  recipient_name,
  phone,
  address,
  email,
  created_at,
  updated_at
)
SELECT DISTINCT ON (u.nickname)
  u.nickname,
  COALESCE(NULLIF(BTRIM(u.purchaser_name), ''), u.recipient_name),
  u.recipient_name,
  u.phone,
  u.address,
  u.email,
  u.created_at,
  u.updated_at
FROM public.users u
WHERE BTRIM(COALESCE(u.nickname, '')) <> ''
  AND BTRIM(COALESCE(u.phone, '')) <> ''
ORDER BY u.nickname, u.created_at DESC
ON CONFLICT (nickname) DO NOTHING;

ALTER TABLE public.users
DROP CONSTRAINT IF EXISTS users_nickname_key;

DROP INDEX IF EXISTS public.users_nickname_key;

CREATE INDEX IF NOT EXISTS users_nickname_idx ON public.users (nickname);
